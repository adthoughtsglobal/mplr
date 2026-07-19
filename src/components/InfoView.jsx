import { currentTrack } from "../store/store.js";
import { formatTime } from "../lib/track.js";

export default function InfoView() {
    return (
        <div id="info">
            {currentTrack() ? (
                <div class="data" style={{ padding: "1em", display: "flex", "flex-direction": "column", gap: ".75em" }}>
                    <div><strong>Title:</strong> {currentTrack().title}</div>
                    <div><strong>Artist:</strong> {currentTrack().artist}</div>
                    <div><strong>Duration:</strong> {formatTime(currentTrack().duration)}</div>
                    <div><strong>File:</strong> {currentTrack().file.name}</div>
                </div>
            ) : (
                <div style={{ padding: "1em", opacity: 0.6 }}>No track playing.</div>
            )}
        </div>
    );
}
