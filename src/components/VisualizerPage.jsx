import { onMount, onCleanup, For } from "solid-js";
import { VisualizerEngine } from "../visualizers/vizengine.js";
import { engine as playerEngine } from "../store/player.js";
import { store } from "../store/store.js";

const VIZ_OPTIONS = [
    { key: "wave", label: "Waveform" },
    { key: "bars", label: "Bars" },
    { key: "circular", label: "Circular" },
    { key: "particles", label: "Particles" }
];

export default function VisualizerPage() {
    let canvasRef;
    let vizEngine;

    onMount(() => {
        vizEngine = new VisualizerEngine(canvasRef, playerEngine, {
            fftSize: 2048,
            sensitivity: store.viz.sensitivity,
            smoothing: store.viz.smoothing,
            colorPrimary: store.viz.colorPrimary,
            colorAccent: store.viz.colorAccent,
            glow: store.viz.glow,
            speed: store.viz.speed,
            barCount: store.viz.barCount
        });

        vizEngine.loadVisualizer(store.viz.name);
        vizEngine.start();
    });

    onCleanup(() => vizEngine?.destroy());

    function selectViz(name) {
        vizEngine?.loadVisualizer(name);
    }

    return (
        <div class="page page2">
            <canvas id="vizcanvas" ref={canvasRef} />
            <div class="headerbar" style={{ position: "absolute", bottom: "1em", left: "50%", transform: "translateX(-50%)", "z-index": 10 }}>
                <For each={VIZ_OPTIONS}>
                    {opt => (
                        <div class="textbtn" data-viz={opt.key} onClick={() => selectViz(opt.key)}>
                            <span>{opt.label}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
