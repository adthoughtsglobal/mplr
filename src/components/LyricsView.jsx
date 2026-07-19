import { For, createEffect } from "solid-js";
import { store } from "../store/store.js";

export default function LyricsView() {
    let lineRefs = [];

    createEffect(() => {
        const i = store.activeLyricIndex;
        const el = lineRefs[i];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return (
        <div id="lyrics">
            <For each={store.lyrics}>
                {(line, i) => (
                    <div
                        class="line"
                        classList={{ active: i() === store.activeLyricIndex }}
                        ref={el => (lineRefs[i()] = el)}
                    >
                        {line.text || "..."}
                    </div>
                )}
            </For>
        </div>
    );
}
