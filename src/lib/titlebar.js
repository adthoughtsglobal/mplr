import { createEffect } from "solid-js";
import { store, currentTrack } from "../store/store.js";
import { formatTime } from "./track.js";

let offset = 0;

function buildText() {
    const t = currentTrack();
    if (!t) return "";
    return [t.title, t.artist, formatTime(t.duration)].filter(Boolean).join(" • ");
}

let running = false;

export function updateTitle() {
    if (running) return;
    running = true;

    createEffect(() => {
        void store.currentIndex;
        void store.library;
        offset = 0;
    });

    let last = performance.now();

    function loop(now) {
        const delta = now - last;
        last = now;

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}