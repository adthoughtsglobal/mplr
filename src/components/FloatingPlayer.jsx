import { createMemo } from "solid-js";
import { store, setStore, currentTrack } from "../store/store.js";
import { engine, REPEAT_ALL } from "../store/player.js";
import { formatTime } from "../lib/track.js";
import Slider from "./Slider.jsx";

function format(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = h ? String(m).padStart(2, "0") : String(m);
    const ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function FloatingPlayer() {
    const seekPercent = createMemo(() =>
        store.duration > 0 ? (store.currentTime / store.duration) * 100 : 0
    );

    function togglePage2() {
        const page2 = document.querySelector(".page2");
        const btn = document.querySelector("#page2toggler .icon");
        if (store.page === 1) {
            document.body.scrollTo({ top: 0, behavior: "smooth" });
            setStore("page", 0);
            if (btn) btn.style.transform = "rotate(0deg)";
        } else {
            page2?.scrollIntoView({ behavior: "smooth" });
            setStore("page", 1);
            if (btn) btn.style.transform = "rotate(180deg)";
        }
    }

    return (
        <div class="floating_player">
            <div class="slider_container main">
                <div class="current-time">{format(store.currentTime)}</div>
                <Slider
                    class="seek_slider"
                    min={0}
                    max={100}
                    value={seekPercent()}
                    onChange={v => engine.seekToPercent(v)}
                />
                <div class="total-duration">{format(store.duration)}</div>
            </div>

            <div class="player_controls">
                <div class="info pane">
                    <img src={currentTrack()?.cover || ""} class="cover" alt="" />
                    <div class="data">
                        <div class="track_name">
                            <i class="icon">music_note</i> <span>{currentTrack()?.title || ""}</span>
                        </div>
                        <div class="artist">
                            <i class="icon">artist</i> <span>{currentTrack()?.artist || ""}</span>
                        </div>
                    </div>
                </div>

                <div class="playback_controls pane">
                    <div
                        class="btn"
                        classList={{ active: store.repeat !== 0 }}
                        data-tooltip="Repeat Track"
                        onClick={() => engine.toggleRepeat()}
                    >
                        <div class="icon">{store.repeat === REPEAT_ALL ? "repeat" : "repeat"}</div>
                    </div>
                    <div class="btn" data-tooltip="Rewind 5 Seconds" onClick={() => engine.seekBy(-5)}>
                        <div class="icon">replay_5</div>
                    </div>
                    <div class="btn" data-tooltip="Previous Track" onClick={() => engine.prev()}>
                        <div class="icon">skip_previous</div>
                    </div>
                    <div class="btn" data-tooltip="Play / Pause" onClick={() => engine.togglePlay()}>
                        <div class="icon">{store.playing ? "pause" : "play_arrow"}</div>
                    </div>
                    <div class="btn" data-tooltip="Next Track" onClick={() => engine.next()}>
                        <div class="icon">skip_next</div>
                    </div>
                    <div class="btn" data-tooltip="Forward 5 Seconds" onClick={() => engine.seekBy(5)}>
                        <div class="icon">forward_5</div>
                    </div>
                    <div
                        class="btn"
                        classList={{ active: store.shuffle }}
                        data-tooltip="Shuffle"
                        onClick={() => engine.toggleShuffle()}
                    >
                        <div class="icon">shuffle</div>
                    </div>
                </div>

                <div class="additional_controls pane">
                    <div class="btn">
                        <div class="icon">no_sound</div>
                        <div class="slider_container">
                            <Slider
                                class="volume_slider"
                                min={0}
                                max={100}
                                value={store.volume * 100}
                                onInput={v => engine.setVolume(v / 100)}
                            />
                        </div>
                    </div>
                    <div class="btn" id="page2toggler" onClick={togglePage2}>
                        <div class="icon">keyboard_arrow_up</div>
                        <div class="volume_slider" />
                    </div>
                </div>
            </div>
        </div>
    );
}
