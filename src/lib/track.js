import { gradientFromHash } from "./gradient.js";

export function isAudio(file) {
    return file.type.startsWith("audio/");
}

export function parseFileName(name) {
    let base = name.replace(/\.[^/.]+$/, "");
    base = base.replace(/^\|\s*/, "").trim();

    if (base.includes(" - ")) {
        const [left, ...rest] = base.split(" - ");
        const artistCandidate = left.trim();
        const wordCount = artistCandidate.split(/\s+/).length;

        if (wordCount <= 2) {
            return { artist: artistCandidate, title: rest.join(" - ").trim() };
        }
    }
    return { title: base };
}

export function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function parseMeta(file) {
    return new Promise(resolve => {
        jsmediatags.read(file, {
            onSuccess: ({ tags }) => {
                resolve({
                    title: tags?.title || null,
                    artist: tags?.artist || null,
                    picture: tags?.picture
                        ? { data: tags.picture.data, format: tags.picture.format }
                        : null
                });
            },
            onError: () => resolve({})
        });
    });
}

let nextId = 1;

export class Track {
    constructor(file) {
        this.id = nextId++;
        this.file = file;
        this.title = file.name;
        this.artist = "Unknown";
        this.duration = 0;
        this.cover = null;
        this.url = null;
        this.lrcFile = null;
    }

    async parse() {
        if (!isAudio(this.file)) return this;
        this.url = URL.createObjectURL(this.file);

        try {
            const meta = (await parseMeta(this.file)) || {};

            if (meta.title || meta.artist) {
                this.title = meta.title || this.title;
                this.artist = meta.artist || this.artist;
            } else {
                const parsed = parseFileName(this.file.name);
                this.title = parsed.title || this.title;
                this.artist = parsed.artist || this.artist;
            }

            this.duration = await new Promise(resolve => {
                const audio = document.createElement("audio");
                audio.src = this.url;
                audio.preload = "metadata";
                audio.onloadedmetadata = () => resolve(audio.duration || 0);
                audio.onerror = () => resolve(0);
            });

            if (meta.picture?.data && meta.picture?.format) {
                const bytes = new Uint8Array(meta.picture.data);
                const blob = new Blob([bytes], { type: meta.picture.format });
                this.cover = URL.createObjectURL(blob);
            } else {
                const key = (this.title || "") + (this.artist || "") || this.file.name;
                this.cover = gradientFromHash(key);
            }
        } catch {
            this.cover = gradientFromHash(this.file.name);
        }

        return this;
    }
}

export function attachLyrics(tracks, files) {
    const lrcMap = new Map();
    files.forEach(f => {
        if (f.name.toLowerCase().endsWith(".lrc")) {
            lrcMap.set(f.name.replace(/\.lrc$/i, ""), f);
        }
    });
    tracks.forEach(track => {
        const base = track.file.name.replace(/\.[^/.]+$/, "");
        if (lrcMap.has(base)) track.lrcFile = lrcMap.get(base);
    });
}

export async function parseLRC(file) {
    const text = await file.text();
    const result = [];

    for (const line of text.split("\n")) {
        const matches = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
        const lyric = line.replace(/\[.*?\]/g, "").trim();
        matches.forEach(m => {
            result.push({ time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: lyric });
        });
    }
    return result.sort((a, b) => a.time - b.time);
}

export async function buildTracks(files) {
    const tracks = files.map(f => new Track(f));
    await Promise.all(tracks.map(t => t.parse()));
    attachLyrics(tracks, files);
    return tracks;
}
