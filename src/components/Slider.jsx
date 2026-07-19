import { createMemo } from "solid-js";

export default function Slider(props) {
    const pct = createMemo(() => {
        const range = props.max - props.min || 1;
        return ((props.value - props.min) / range) * 100;
    });

    return (
        <input
            type="range"
            class={props.class}
            min={props.min}
            max={props.max}
            value={props.value}
            style={{
                background: `linear-gradient(to right, rgb(var(--highlight)) ${pct()}%, rgb(var(--three)) ${pct()}%)`
            }}
            onInput={e => props.onInput?.(Number(e.currentTarget.value))}
            onChange={e => props.onChange?.(Number(e.currentTarget.value))}
        />
    );
}
