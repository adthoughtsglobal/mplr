import { For, createSignal, createMemo } from "solid-js";
import { store } from "../store/store.js";
import { engine } from "../store/player.js";
import { isAudio } from "../lib/track.js";
import TrackRow from "./TrackRow.jsx";


function selectFolder() {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = () => {
        const files = Array.from(input.files || []);
        engine.loadLibrary(files);
    };
    input.click();
}

export default function LibraryPane() {
    const [query, setQuery] = createSignal("");
    const [view, setView] = createSignal("list");

    const filtered = createMemo(() => {
        const q = query().trim().toLowerCase();
        const tracks = store.library.filter(t => isAudio(t.file));

        if (!q) return tracks;

        return tracks.filter(
            t =>
                t.title.toLowerCase().includes(q) ||
                t.artist.toLowerCase().includes(q)
        );
    });

    return (
        <div class="pane files">
            <div class="headerbar">
                <h1>All Music</h1>

                <div class="actions x">
                    <div
                        class="btn"
                        onClick={() => setView(view() === "list" ? "grid" : "list")}
                    >
                        <div class="icon">
                            {view() === "list" ? "grid_view" : "view_list"}
                        </div>
                    </div>

                    <div class="btn" onClick={selectFolder}>
                        <div class="icon">music_note_add</div>
                    </div>
                </div>
            </div>

            <div class="searchbar">
                <input
                    type="text"
                    placeholder="Search list..."
                    value={query()}
                    onInput={e => setQuery(e.currentTarget.value)}
                />
                <div class="icon">search</div>
            </div>

            <div
                id="music_list"
                classList={{
                    list: true,
                    grid: view() === "grid"
                }}
            >
                <For each={filtered()}>
                    {track => (
                        <TrackRow
                            track={track}
                            showActive
                            onPlayNext={t => engine.addToQueueNext(t)}
                        />
                    )}
                </For>
            </div>
        </div>
    );
}