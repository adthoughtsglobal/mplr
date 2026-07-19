export function gradientFromHash(str, size = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "assets/cover.png";

    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    const norm = n => Math.abs(n);

    const hue1 = norm(h) % 360;
    const hue2 = norm(h >> 8) % 360;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, `hsl(${hue1},70%,60%)`);
    grad.addColorStop(1, `hsl(${hue2},70%,40%)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 6; i++) {
        const r = (norm(h >> (i * 4)) % 80) + 40;
        const x = norm(h >> (i * 5)) % size;
        const y = norm(h >> (i * 6)) % size;
        const hue = norm(h >> (i * 7)) % 360;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},70%,60%,0.25)`;
        ctx.fill();
    }

    return canvas.toDataURL("image/png");
}
