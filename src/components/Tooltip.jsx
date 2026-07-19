import { onMount, onCleanup } from "solid-js";
import { tooltip, setTooltip } from "../store/store.js";

export default function Tooltip() {
    let active = null;

    function onOver(e) {
        const el = e.target.closest("[data-tooltip]");
        if (!el) return;
        active = el;
        setTooltip(t => ({ ...t, text: el.getAttribute("data-tooltip"), visible: true }));
    }

    function onMove(e) {
        if (!active) return;
        setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
    }

    function onOut(e) {
        if (!active) return;
        if (!e.relatedTarget || !active.contains(e.relatedTarget)) {
            setTooltip(t => ({ ...t, visible: false }));
            active = null;
        }
    }

    onMount(() => {
        document.addEventListener("mouseover", onOver);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseout", onOut);
    });

    onCleanup(() => {
        document.removeEventListener("mouseover", onOver);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseout", onOut);
    });

    const t = tooltip;

    return (
        <div
            style={{
                position: "fixed",
                "pointer-events": "none",
                "z-index": 999999,
                padding: "6px 10px",
                background: "rgb(var(--three))",
                color: "#fff",
                "border-radius": "4px",
                "font-size": "12px",
                "white-space": "nowrap",
                transform: "translate(-50%, -135%)",
                transition: "opacity 0.1s ease",
                opacity: t().visible ? 1 : 0,
                left: t().x + "px",
                top: t().y + "px"
            }}
        >
            {t().text}
        </div>
    );
}
