import * as Tone from "tone";
import { store, setStore, produce, REPEAT_OFF, REPEAT_ALL, REPEAT_ONE } from "./store.js";
import { buildTracks, parseLRC, formatTime } from "../lib/track.js";

class EffectsManager {
    constructor(destination) {
        this.destination = destination;
        this.effects = new Map();
        this.registry = {
            reverb: { label: "Reverb", create: () => new Tone.Reverb({ decay: 3, wet: 0.3 }) },
            delay: { label: "Delay", create: () => new Tone.FeedbackDelay("8n", 0.3) },
            chorus: { label: "Chorus", create: () => new Tone.Chorus(4, 2.5, 0.5) },
            distortion: { label: "Distortion", create: () => new Tone.Distortion(0.4) }
        };
    }

    connectSource(source) {
        this.source = source;
        this._rebuildChain();
    }

    toggle(key) {
        if (!this.registry[key]) return;
        if (this.effects.has(key)) {
            this.effects.get(key).dispose();
            this.effects.delete(key);
        } else {
            const fx = this.registry[key].create();
            fx.start?.();
            this.effects.set(key, fx);
        }
        this._rebuildChain();
    }

    list() {
        return Object.entries(this.registry).map(([key, v]) => ({
            key, label: v.label, active: this.effects.has(key)
        }));
    }

    _rebuildChain() {
        if (!this.source) return;
        this.source.disconnect();
        let node = this.source;
        for (const fx of this.effects.values()) {
            node.connect(fx);
            node = fx;
        }
        node.connect(this.destination);
    }
}

class PlayerEngine {
    constructor() {
        this.player = new Tone.Player();
        this.effects = new EffectsManager(Tone.getDestination());
        this.effects.connectSource(this.player);

        this.startTime = 0;
        this.pauseOffset = 0;


        this._activeLyricIndex = -1;
        this._tick();
    }

    async loadLibrary(files) {
        setStore("loadingLibrary", true);
        const tracks = await buildTracks(files);
        setStore(produce(s => {
            s.library = tracks;
            s.currentIndex = tracks.length ? 0 : -1;
            s.queue = [];
        }));
        setStore("loadingLibrary", false);
    }

    addToQueueNext(track) {
        setStore("queue", q => [track, ...q]);
    }

    removeFromQueue(index) {
        setStore("queue", q => q.filter((_, i) => i !== index));
    }

    current() {
        return store.library[store.currentIndex] ?? null;
    }

    async play(index = store.currentIndex) {
        await Tone.start();
        if (!store.library.length) return;
        if (index < 0 || index >= store.library.length) return;

        const isNewTrack = index !== store.currentIndex;
        setStore("currentIndex", index);

        const track = this.current();
        if (!track) return;

        if (this.player.buffer) this.player.stop();
        this.player.dispose();

        this.player = new Tone.Player();
        this.effects.connectSource(this.player);

        this.player.onended = () => this.next();

        await this.player.load(track.url);
        await this._loadLyrics(track);

        if (isNewTrack) this.pauseOffset = 0;

        this.startTime = Tone.now();
        this.player.start(Tone.now(), this.pauseOffset);
        setStore("playing", true);
    }

    pause() {
        if (this.player.state !== "started") return;
        this.pauseOffset += Tone.now() - this.startTime;
        this.player.stop();
        setStore("playing", false);
    }

    resume() {
        if (!this.current()) return;
        this.startTime = Tone.now();
        this.player.start(Tone.now(), this.pauseOffset);
        setStore("playing", true);
    }

    togglePlay() {
        if (this.player.state === "started") this.pause();
        else this.resume();
    }

    async playByTrack(track) {
        const index = store.library.indexOf(track);
        if (index === -1) return;

        await this.play(index);
    }

    async next() {
        if (store.queue.length) {
            const nextTrack = store.queue[0];
            setStore("queue", q => q.slice(1));
            await this.playByTrack(nextTrack);
            return;
        }

        if (!store.library.length) return;

        let idx;
        if (store.shuffle) {
            idx = Math.floor(Math.random() * store.library.length);
        } else {
            idx = store.currentIndex + 1;
        }

        if (idx >= store.library.length) {
            if (store.repeat === REPEAT_ALL) idx = 0;
            else return;
        }

        await this.play(idx);
    }

    async prev() {
        if (!store.library.length) return;
        let idx = store.currentIndex - 1;
        if (idx < 0) idx = store.repeat === REPEAT_ALL ? store.library.length - 1 : 0;
        await this.play(idx);
    }

    seek(sec) {
        if (!this.current()) return;

        const wasPlaying = this.player.state === "started";

        if (wasPlaying) {
            this.player.stop();
        }

        this.pauseOffset = Math.max(0, sec);

        if (wasPlaying) {
            this.startTime = Tone.now();
            this.player.start(Tone.now(), this.pauseOffset);
        }

        setStore("currentTime", this.pauseOffset);
    }

    seekBy(delta) {
        this.seek(this.getCurrentTime() + delta);
    }

    seekToPercent(percent) {
        const track = this.current();
        if (!track?.duration) return;
        this.seek((percent / 100) * track.duration);
    }

    getCurrentTime() {
        if (this.player.state !== "started") return this.pauseOffset;
        return this.pauseOffset + (Tone.now() - this.startTime);
    }

    setVolume(v) {
        const vol = Math.max(0, Math.min(1, v));
        setStore("volume", vol);
        this.player.volume.value = Tone.gainToDb(vol);
    }

    toggleShuffle() {
        setStore("shuffle", s => !s);
    }

    toggleRepeat() {
        setStore("repeat", r => (r + 1) % 3);
    }

    clearLibrary() {
        if (this.player.state === "started") {
            this.player.stop();
        }

        this.pauseOffset = 0;
        this.startTime = 0;
        this._activeLyricIndex = -1;

        setStore(produce(s => {
            s.library = [];
            s.queue = [];
            s.currentIndex = -1;
            s.playing = false;
            s.currentTime = 0;
            s.duration = 0;
            s.lyrics = [];
            s.activeLyricIndex = -1;
        }));
    }

    async _loadLyrics(track) {
        this._activeLyricIndex = -1;
        setStore(produce(s => { s.lyrics = []; s.activeLyricIndex = -1; }));
        if (!track.lrcFile) return;
        const lyrics = await parseLRC(track.lrcFile);
        setStore("lyrics", lyrics);
    }

    _syncLyrics(currentTime) {
        const lyrics = store.lyrics;
        if (!lyrics.length) return;

        const i = lyrics.findIndex((l, idx) => {
            const next = lyrics[idx + 1];
            return currentTime >= l.time && (!next || currentTime < next.time);
        });

        if (i === -1 || i === this._activeLyricIndex) return;
        this._activeLyricIndex = i;
        setStore("activeLyricIndex", i);
    }

    _tick() {
        requestAnimationFrame(() => this._tick());

        const track = this.current();
        if (!track) return;

        const current = this.getCurrentTime();
        const total = track.duration || 0;

        if (
            store.playing &&
            total > 0 &&
            current >= total - 0.1 &&
            !this._advancing
        ) {
            this._advancing = true;
            this.next().finally(() => {
                this._advancing = false;
            });
        }

        setStore(produce(s => {
            s.currentTime = current;
            s.duration = total;
        }));

        this._syncLyrics(current);
    }
}

export const engine = new PlayerEngine();
export { formatTime, REPEAT_OFF, REPEAT_ALL, REPEAT_ONE };
