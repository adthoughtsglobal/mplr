import { formatTime } from "../lib/track.js";
import { store } from "../store/store.js";
import { engine } from "../store/player.js";

export default function TrackRow(props) {
    const isActive = () => showActiveFlag(props);

    function showActiveFlag(p) {
        if (!p.showActive) return false;
        return store.library[store.currentIndex] === p.track;
    }

    return (
        <div class="track" classList={{ active: isActive() }}>
            <div class="cover" onClick={() => engine.playByTrack(props.track)}>
                <img src={props.track.cover} alt="" />
                <div class="icon play">play_arrow</div>
                <div class="icon eq">equalizer</div>
            </div>

            <div class="data" onClick={() => engine.playByTrack(props.track)}>
                <div class="meta y">
                    <div class="track_name" data-tooltip={props.track.title}>
                        {props.track.title}
                    </div>
                    <div class="artist">{props.track.artist}</div>
                </div>

                <div class="extra">
                    {props.showDuration !== false && (
                        <div class="duration">
                            {formatTime(props.track.duration)}
                        </div>
                    )}

                    <div class="actions x">
                        {props.onPlayNext && (
                            <div
                                class="btn"
                                onClick={e => {
                                    e.stopPropagation();
                                    props.onPlayNext(props.track);
                                }}
                            >
                                <span class="icon">subdirectory_arrow_right</span>
                            </div>
                        )}

                        {props.onRemove && (
                            <div
                                class="btn"
                                onClick={e => {
                                    e.stopPropagation();
                                    props.onRemove();
                                }}
                            >
                                <span class="icon">close</span>
                            </div>
                        )}

                        <div class="btn">
                            <span class="icon">more_vert</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
