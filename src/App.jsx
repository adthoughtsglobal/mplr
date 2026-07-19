import { onMount } from "solid-js";
import * as Tone from "tone";
import LibraryPane from "./components/LibraryPane.jsx";
import RightPane from "./components/RightPane.jsx";
import FloatingPlayer from "./components/FloatingPlayer.jsx";
import VisualizerPage from "./components/VisualizerPage.jsx";
import Tooltip from "./components/Tooltip.jsx";
import { updateTitle } from "./lib/titlebar.js";

export default function App() {
    onMount(() => {
        document.body.addEventListener("click", () => Tone.start(), { once: true });
        updateTitle();
    });

    return (
        <>
            <div class="page1 page">
                <div class="app_body">
                    <LibraryPane />
                    <div class="seperator" />
                    <RightPane />
                </div>
                <FloatingPlayer />
            </div>
            {/* <VisualizerPage /> */}
            <Tooltip />
        </>
    );
}
