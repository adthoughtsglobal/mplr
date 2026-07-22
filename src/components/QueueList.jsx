import { For } from "solid-js";
import { store } from "../store/store.js";
import { engine } from "../store/player.js";

export default function QueueList() {
    function playAndRemove(track, index) {
        engine.removeFromQueue(index);
        engine.playByTrack(track);
    }

    return (
        <div id="queue" class="list">
            <For each={store.queue} fallback={
                    <small className="emptyText">Click on <span className="icon">subdirectory_arrow_right</span> to add music to queue</small>
                }>
                {(track, i) => (
                    <div
                        class="track"
                        onClick={() => playAndRemove(track, i())}
                    >
                        <div class="cover">
                            <img src={track.cover} alt="" />
                        </div>

                        <div class="data">
                            <div class="meta">
                                <div class="track_name">{track.title}</div>
                                <div class="artist">{track.artist}</div>
                            </div>

                            <div class="extra">
                                <div class="actions">
                                    <div
                                        class="btn remove"
                                        data-tooltip="Remove"
                                        onClick={e => {
                                            e.stopPropagation();
                                            engine.removeFromQueue(i());
                                        }}
                                    >
                                        <span class="icon">close</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </For>
        </div>
    );
}