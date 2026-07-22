import { For, createSignal, createMemo } from "solid-js";
import { store } from "../store/store.js";
import { engine } from "../store/player.js";
import { isAudio } from "../lib/track.js";
import TrackRow from "./TrackRow.jsx";

import { authenticateRotur, initRoturStatus } from "../lib/roturStatus.js";


function rselectFolder() {
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

function rselectFiles() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "audio/*";

    input.onchange = () => {
        const files = Array.from(input.files || []);
        engine.loadLibrary(files);
    };

    input.click();
}

function ImportButton() {
    const [open, setOpen] = createSignal(false);

    const selectFolder = () => {
        setOpen(false);
        rselectFolder();
    };

    const selectFiles = () => {
        setOpen(false);
        rselectFiles();
    };

    return (
        <div class="dropdown btn">
            <div
                class="btn"
                data-tooltip="Import music"
                onClick={() => setOpen(!open())}
            >
                <div class="icon">music_note_add</div>
            </div>

            {open() && (
                <div class="dropdown-menu">
                    <div class="dropdown-item" onClick={selectFolder}>
                        Import Folder
                    </div>
                    <div class="dropdown-item" onClick={selectFiles}>
                        Import Files
                    </div>
                    <div class="dropdown-item" onClick={engine.clearLibrary}>
                        Clear Imports
                    </div>
                </div>
            )}
        </div>
    );
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
                        data-tooltip="Share Rich Presence to Rotur"
                        onClick={async () => {
                            await authenticateRotur();
                            initRoturStatus();
                        }}
                    >
                        <div class="icon">full_coverage</div>
                    </div>
                    <div
                        class="btn"
                        onClick={() => setView(view() === "list" ? "grid" : "list")}
                        data-tooltip="Change view"
                    >
                        <div class="icon">
                            {view() === "list" ? "grid_view" : "view_list"}
                        </div>
                    </div>

                    <ImportButton />
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
                <For each={filtered()} fallback={
                    <small className="emptyText">Click on <span className="icon">music_note_add</span> to add music</small>
                }>
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