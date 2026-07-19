import { createSignal, For } from "solid-js";
import QueueList from "./QueueList.jsx";
import LyricsView from "./LyricsView.jsx";
import InfoView from "./InfoView.jsx";

const TABS = [
    { key: "queue", label: "Queue", icon: "music_note_add" },
    { key: "lyrics", label: "Lyrics", icon: "lyrics" },
    { key: "info", label: "Info", icon: "info" }
];

export default function RightPane() {
    const [active, setActive] = createSignal("queue");

    return (
        <div class="pane queue">
            <div class="headerbar selector">
                <For each={TABS}>
                    {tab => (
                        <div
                            class="textbtn"
                            classList={{ active: active() === tab.key }}
                            onClick={() => setActive(tab.key)}
                        >
                            <div class="icon">{tab.icon}</div>
                            <span>{tab.label}</span>
                        </div>
                    )}
                </For>
            </div>
            <div class="pages">
                <div class="page" style={{ display: active() === "queue" ? "block" : "none" }}>
                    <QueueList />
                </div>
                <div class="page" style={{ display: active() === "lyrics" ? "block" : "none" }}>
                    <LyricsView />
                </div>
                <div class="page" style={{ display: active() === "info" ? "block" : "none" }}>
                    <InfoView />
                </div>
            </div>
        </div>
    );
}
