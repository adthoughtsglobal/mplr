import { createStore, produce } from "solid-js/store";
import { createSignal } from "solid-js";

export const REPEAT_OFF = 0;
export const REPEAT_ALL = 1;
export const REPEAT_ONE = 2;

const [store, setStore] = createStore({
    library: [],
    queue: [], 
    currentIndex: -1, 
    playing: false,
    shuffle: false,
    repeat: REPEAT_OFF,
    volume: 0.99,
    currentTime: 0,
    duration: 0,
    lyrics: [],
    activeLyricIndex: -1,
    page: 0,
    loadingLibrary: false,
    viz: {
        name: "wave",
        sensitivity: 1.5,
        smoothing: 0.82,
        glow: 1.0,
        speed: 0.8,
        barCount: 120,
        colorPrimary: "#a78bfa",
        colorAccent: "#f472b6"
    }
});

export function currentTrack() {
    return store.library[store.currentIndex] ?? null;
}

export { store, setStore, produce };

export const [tooltip, setTooltip] = createSignal({ text: "", x: 0, y: 0, visible: false });
