import * as Tone from "tone";

class AudioAnalysisLayer {
    constructor(options = {}) {
        this.fftSize       = options.fftSize       ?? 2048
        this.smoothing     = options.smoothing      ?? 0.8
        this.sensitivity   = options.sensitivity    ?? 1.0

        this._fftAnalyser      = new Tone.Analyser("fft",      this.fftSize)
        this._waveformAnalyser = new Tone.Analyser("waveform", this.fftSize)

        this._fftAnalyser.smoothing      = this.smoothing
        this._waveformAnalyser.smoothing = this.smoothing

        this._beatHistory    = new Float32Array(43)
        this._beatPointer    = 0
        this._lastBeatTime   = 0
        this._beatCooldown   = 300 

        this._bassEnd   = Math.floor(this.fftSize * 200  / 44100)
        this._midsEnd   = Math.floor(this.fftSize * 2000 / 44100)
        this._trebleEnd = Math.floor(this.fftSize * 20000/ 44100)

        this._smoothedBass   = 0
        this._smoothedMids   = 0
        this._smoothedTreble = 0
        this._smoothedVolume = 0
    }

    connectSource(source) {
        source.connect(this._fftAnalyser)
        source.connect(this._waveformAnalyser)
    }

    getFrame(playerRef) {
        const fftRaw      = this._fftAnalyser.getValue()
        const waveformRaw = this._waveformAnalyser.getValue()

        const fft = new Float32Array(fftRaw.length)
        for (let i = 0; i < fftRaw.length; i++) {
            fft[i] = Math.max(0, (fftRaw[i] + 140) / 140) * this.sensitivity
            fft[i] = Math.min(1, fft[i])
        }

        const bass   = this._bandEnergy(fft, 0,                 this._bassEnd)
        const mids   = this._bandEnergy(fft, this._bassEnd,     this._midsEnd)
        const treble = this._bandEnergy(fft, this._midsEnd,     this._trebleEnd)
        const volume = this._rms(waveformRaw) * this.sensitivity

        const α = 0.2
        this._smoothedBass   = this._smoothedBass   * (1 - α) + bass   * α
        this._smoothedMids   = this._smoothedMids   * (1 - α) + mids   * α
        this._smoothedTreble = this._smoothedTreble * (1 - α) + treble * α
        this._smoothedVolume = this._smoothedVolume * (1 - α) + volume * α

        const beat = this._detectBeat(bass)

        const currentTime = playerRef?.getCurrentTime?.() ?? 0
        const duration    = playerRef?.current?.()?.duration ?? 0
        const progress    = duration > 0 ? currentTime / duration : 0

        return {
            fft,
            waveform:  waveformRaw,
            volume:    this._smoothedVolume,
            bass:      this._smoothedBass,
            mids:      this._smoothedMids,
            treble:    this._smoothedTreble,
            beat,
            currentTime,
            duration,
            progress
        }
    }

    setSensitivity(v)  { this.sensitivity = Math.max(0.1, Math.min(5, v)) }
    setSmoothing(v)    {
        this.smoothing = Math.max(0, Math.min(0.99, v))
        this._fftAnalyser.smoothing      = this.smoothing
        this._waveformAnalyser.smoothing = this.smoothing
    }

    destroy() {
        this._fftAnalyser.dispose()
        this._waveformAnalyser.dispose()
    }

    _bandEnergy(fft, start, end) {
        let sum = 0
        const len = end - start
        if (len <= 0) return 0
        for (let i = start; i < end; i++) sum += fft[i]
        return sum / len
    }

    _rms(buf) {
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        return Math.sqrt(sum / buf.length)
    }

    _detectBeat(bassEnergy) {
        const now = performance.now()

        this._beatHistory[this._beatPointer] = bassEnergy
        this._beatPointer = (this._beatPointer + 1) % this._beatHistory.length

        let avg = 0
        for (let i = 0; i < this._beatHistory.length; i++) avg += this._beatHistory[i]
        avg /= this._beatHistory.length

        const variance = bassEnergy > avg * 1.35
        const cooldownOk = (now - this._lastBeatTime) > this._beatCooldown

        if (variance && cooldownOk) {
            this._lastBeatTime = now
            return true
        }
        return false
    }
}

class VisualizerBase {
    constructor() {
        this.ctx      = null
        this.canvas   = null
        this.settings = {}
    }

    /** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas @param {object} settings */
    setup(ctx, canvas, settings) {
        this.ctx      = ctx
        this.canvas   = canvas
        this.settings = settings
    }
    render(frame) { }

    destroy() { }
}



class VisualizerEngine {
    constructor(canvas, playerRef, options = {}) {
        if (!(canvas instanceof HTMLCanvasElement))
            throw new Error("VisualizerEngine: canvas must be an HTMLCanvasElement")

        this.canvas    = canvas
        this.playerRef = playerRef
        this.options   = options

        this.analysis  = new AudioAnalysisLayer({
            fftSize:     options.fftSize     ?? 2048,
            smoothing:   options.smoothing   ?? 0.8,
            sensitivity: options.sensitivity ?? 1.0
        })

        if (playerRef?.player) {
            this.analysis.connectSource(playerRef.player)
        }

        this._dpr = window.devicePixelRatio || 1
        this._ctx = this.canvas.getContext("2d", { alpha: true })
        this._resizeCanvas()

        this._registry = new Map()

        this._active       = null
        this._activeName   = null
        this._rafId        = null
        this._running      = false
        this._startTime    = null
        this._lastTime     = null

        this.settings = {
            sensitivity:  options.sensitivity  ?? 1.0,
            smoothing:    options.smoothing    ?? 0.8,
            colorPrimary: options.colorPrimary ?? "#a78bfa",
            colorAccent:  options.colorAccent  ?? "#f472b6",
            colorBg:      options.colorBg      ?? "rgba(0,0,0,0)",
            glow:         options.glow         ?? 0.8,
            speed:        options.speed        ?? 1.0,
            barCount:     options.barCount     ?? 80,
            ...options
        }

        this._ro = new ResizeObserver(() => this._resizeCanvas())
        this._ro.observe(this.canvas.parentElement ?? this.canvas)

        this._registerBuiltins()
    }

    registerVisualizer(name, VisualizerClass) {
        if (!name || typeof name !== "string")
            throw new Error("registerVisualizer: name must be a non-empty string")
        if (!VisualizerClass || (typeof VisualizerClass !== "function" && typeof VisualizerClass !== "object"))
            throw new Error("registerVisualizer: invalid visualizer class/object")

        this._registry.set(name, VisualizerClass)
        return this 
    }
    loadVisualizer(name, settingsOverride = {}) {
        if (!this._registry.has(name))
            throw new Error(`loadVisualizer: "${name}" is not registered`)

        if (this._active) {
            try { this._active.destroy() } catch (e) { console.warn(e) }
            this._active = null
        }

        const VisCls  = this._registry.get(name)
        const merged  = { ...this.settings, ...settingsOverride }

        const instance = (typeof VisCls === "function")
            ? new VisCls()
            : Object.create(VisCls)

        instance.setup(this._ctx, this.canvas, { ...merged })

        this._active     = instance
        this._activeName = name
        this._startTime  = null

        return this 
    }
    listVisualizers() {
        return [...this._registry.keys()]
    }


    start() {
        if (this._running) return
        this._running  = true
        this._lastTime = null
        this._rafId    = requestAnimationFrame(t => this._loop(t))
        return this
    }

    stop() {
        this._running = false
        if (this._rafId) {
            cancelAnimationFrame(this._rafId)
            this._rafId = null
        }
        return this
    }

    updateSettings(patch) {
        Object.assign(this.settings, patch)
        if (patch.sensitivity !== undefined) this.analysis.setSensitivity(patch.sensitivity)
        if (patch.smoothing   !== undefined) this.analysis.setSmoothing(patch.smoothing)
        if (this._active) Object.assign(this._active.settings, patch)
    }
    enableWebGL(options = {}) {
        this._gl = this.canvas.getContext("webgl2", options)
                ?? this.canvas.getContext("webgl",  options)
        return this._gl
    }

    async enableWebGPU() {
        if (!navigator.gpu) throw new Error("WebGPU not supported in this browser")
        const adapter = await navigator.gpu.requestAdapter()
        this._gpuDevice = await adapter.requestDevice()
        return this._gpuDevice
    }

    destroy() {
        this.stop()
        if (this._active) { try { this._active.destroy() } catch (e) {} }
        this.analysis.destroy()
        this._ro.disconnect()
    }

    _loop(timestamp) {
        if (!this._running) return

        if (!this._startTime) this._startTime = timestamp
        if (!this._lastTime)  this._lastTime  = timestamp

        const elapsed   = (timestamp - this._startTime) / 1000
        const deltaTime = Math.min((timestamp - this._lastTime) / 1000, 0.1)
        this._lastTime  = timestamp

        if (this._active) {
            const audioData = this.analysis.getFrame(this.playerRef)

            const frame = {
                ctx:        this._ctx,
                canvas:     this.canvas,
                gl:         this._gl        ?? null,
                gpuDevice:  this._gpuDevice ?? null,
                ...audioData,
                deltaTime,
                elapsed,
                settings:   { ...this._active.settings }
            }

            try {
                this._active.render(frame)
            } catch (e) {
                console.error(`[VisualizerEngine] render error in "${this._activeName}":`, e)
            }
        }

        this._rafId = requestAnimationFrame(t => this._loop(t))
    }

    _resizeCanvas() {
        const dpr  = this._dpr
        const rect  = this.canvas.getBoundingClientRect()
        const w     = Math.round(rect.width  * dpr) || 800
        const h     = Math.round(rect.height * dpr) || 400

        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width  = w
            this.canvas.height = h
            this._ctx.scale(dpr, dpr)
        }
    }

    get _logicalW() { return this.canvas.width  / this._dpr }
    get _logicalH() { return this.canvas.height / this._dpr }

    _registerBuiltins() {
        this.registerVisualizer("bars",     BarSpectrumVisualizer)
        this.registerVisualizer("circular", CircularSpectrumVisualizer)
        this.registerVisualizer("wave",     OscilloscopeVisualizer)
        this.registerVisualizer("particles",ParticleVisualizer)
    }
}

class BarSpectrumVisualizer extends VisualizerBase {
    setup(ctx, canvas, settings) {
        super.setup(ctx, canvas, settings)
        this._barHeights = null
    }

    render({ ctx, canvas, fft, beat, bass, settings, elapsed }) {
        const W = canvas.width  / (window.devicePixelRatio || 1)
        const H = canvas.height / (window.devicePixelRatio || 1)

        ctx.clearRect(0, 0, W, H)

        const count   = settings.barCount ?? 80
        const step    = Math.floor(fft.length / count)
        const gap     = 2
        const barW    = (W / count) - gap
        const radius  = Math.min(barW / 2, 3)

        if (!this._barHeights) this._barHeights = new Float32Array(count)

        const beatFlash = beat ? 0.18 : 0

        ctx.fillStyle = settings.colorBg || "rgba(0,0,0,0)"
        ctx.fillRect(0, 0, W, H)

        for (let i = 0; i < count; i++) {
            const raw    = fft[i * step] ?? 0
            this._barHeights[i] += (raw - this._barHeights[i]) * 0.25

            const barH   = this._barHeights[i] * H * 0.85
            const x      = i * (barW + gap)
            const y      = H - barH

            const hue    = (i / count) * 200 + elapsed * 10 * (settings.speed ?? 1)
            const grad   = ctx.createLinearGradient(x, H, x, y)
            grad.addColorStop(0, `hsla(${hue % 360}, 80%, 55%, 0.9)`)
            grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 90%, 75%, 1)`)

            ctx.fillStyle = grad

            if (settings.glow > 0) {
                ctx.shadowColor = `hsla(${hue % 360}, 90%, 70%, ${settings.glow})`
                ctx.shadowBlur  = 10 * settings.glow
            }

            _roundedRect(ctx, x, y, barW, barH, radius)
            ctx.fill()

            if (beat && i < count * bass * 2) {
                ctx.fillStyle = `rgba(255,255,255,${beatFlash})`
                _roundedRect(ctx, x, y, barW, barH, radius)
                ctx.fill()
            }
        }

        ctx.shadowBlur = 0
    }

    destroy() { this._barHeights = null }
}

class CircularSpectrumVisualizer extends VisualizerBase {
    render({ ctx, canvas, fft, beat, bass, elapsed, settings }) {
        const W  = canvas.width  / (window.devicePixelRatio || 1)
        const H  = canvas.height / (window.devicePixelRatio || 1)
        const cx = W / 2
        const cy = H / 2

        ctx.clearRect(0, 0, W, H)

        const count   = settings.barCount ?? 128
        const minR    = Math.min(W, H) * 0.22
        const maxLen  = Math.min(W, H) * 0.28
        const step    = Math.floor(fft.length / count)
        const speed   = settings.speed ?? 1
        const rot     = elapsed * 0.1 * speed + (beat ? 0.01 : 0)

        if (beat) {
            ctx.beginPath()
            ctx.arc(cx, cy, minR + bass * maxLen * 0.3, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255,255,255,0.15)`
            ctx.lineWidth   = 2
            ctx.stroke()
        }

        for (let i = 0; i < count; i++) {
            const val    = fft[i * step] ?? 0
            const angle  = (i / count) * Math.PI * 2 + rot
            const barLen = val * maxLen

            const x1 = cx + Math.cos(angle) * minR
            const y1 = cy + Math.sin(angle) * minR
            const x2 = cx + Math.cos(angle) * (minR + barLen)
            const y2 = cy + Math.sin(angle) * (minR + barLen)

            const hue = (i / count) * 300 + elapsed * 20 * speed
            ctx.strokeStyle = `hsl(${hue % 360}, 85%, 65%)`
            ctx.lineWidth   = 2.5

            if (settings.glow > 0) {
                ctx.shadowColor = `hsl(${hue % 360}, 90%, 70%)`
                ctx.shadowBlur  = 8 * settings.glow
            }

            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
        }

        const pulse = 1 + bass * 0.2
        const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, minR * pulse)
        grad.addColorStop(0, `hsla(${elapsed * 30 % 360}, 80%, 80%, 0.6)`)
        grad.addColorStop(1, `hsla(${elapsed * 30 % 360}, 60%, 40%, 0.0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, minR * pulse, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.shadowBlur = 0
        ctx.fill()
    }
}

class OscilloscopeVisualizer extends VisualizerBase {
    render({ ctx, canvas, waveform, volume, beat, elapsed, settings }) {
        const W = canvas.width  / (window.devicePixelRatio || 1)
        const H = canvas.height / (window.devicePixelRatio || 1)

        ctx.clearRect(0, 0, W, H)

        const midY  = H / 2
        const speed = settings.speed ?? 1

        const hue   = (elapsed * 30 * speed) % 360
        const alpha = 0.85 + volume * 0.15

        if (settings.glow > 0) {
            ctx.shadowColor = `hsla(${hue}, 90%, 65%, ${settings.glow})`
            ctx.shadowBlur  = 15 * settings.glow
        }

        ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${alpha})`
        ctx.lineWidth   = 2 + volume * 2
        ctx.lineJoin    = "round"
        ctx.beginPath()

        const sliceW = W / waveform.length

        for (let i = 0; i < waveform.length; i++) {
            const x = i * sliceW
            const y = midY + waveform[i] * (H * 0.45)

            if (i === 0) ctx.moveTo(x, y)
            else         ctx.lineTo(x, y)
        }

        ctx.stroke()

        ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 75%, 55%, ${alpha * 0.35})`
        ctx.lineWidth   = 1
        ctx.beginPath()
        for (let i = 0; i < waveform.length; i++) {
            const x = i * sliceW
            const y = midY - waveform[i] * (H * 0.25)
            if (i === 0) ctx.moveTo(x, y)
            else         ctx.lineTo(x, y)
        }
        ctx.stroke()

        ctx.shadowBlur = 0
    }
}

class ParticleVisualizer extends VisualizerBase {
    setup(ctx, canvas, settings) {
        super.setup(ctx, canvas, settings)
        this._particles = []
        this._maxParticles = 220
    }

    render({ ctx, canvas, fft, bass, treble, mids, beat, volume, elapsed, deltaTime, settings }) {
        const W = canvas.width  / (window.devicePixelRatio || 1)
        const H = canvas.height / (window.devicePixelRatio || 1)

        ctx.fillStyle = "rgba(0,0,0,0.18)"
        ctx.fillRect(0, 0, W, H)

        const speed = settings.speed ?? 1
        const glow  = settings.glow  ?? 0.8

        const spawnCount = beat ? 18 : Math.floor(volume * 8)
        for (let i = 0; i < spawnCount && this._particles.length < this._maxParticles; i++) {
            this._spawnParticle(W, H, bass, treble, elapsed, speed)
        }
        if (Math.random() < volume * 0.6 + 0.08) {
            this._spawnParticle(W, H, bass, treble, elapsed, speed)
        }
        const dt = deltaTime * speed
        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i]

            p.vx += (Math.random() - 0.5) * mids   * 60 * dt
            p.vy += (Math.random() - 0.5) * treble  * 60 * dt
            p.vy -= bass * 40 * dt * p.lift 
            p.vy += 15 * dt

            p.x    += p.vx * dt * 60
            p.y    += p.vy * dt * 60
            p.life -= dt / p.maxLife

            if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
                this._particles.splice(i, 1)
                continue
            }

            const alpha = Math.max(0, p.life)
            const r     = p.radius * (0.5 + p.life * 0.5)

            if (glow > 0) {
                ctx.shadowColor = `hsla(${p.hue}, 90%, 70%, ${glow * alpha})`
                ctx.shadowBlur  = r * 3 * glow
            }

            ctx.beginPath()
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
            ctx.fillStyle = `hsla(${p.hue}, 85%, 65%, ${alpha})`
            ctx.fill()
        }

        ctx.shadowBlur = 0
    }

    _spawnParticle(W, H, bass, treble, elapsed, speed) {
        const edge = Math.random() < 0.6
        const p = {
            x:       edge ? (Math.random() < 0.5 ? 0 : W) : Math.random() * W,
            y:       H * (0.3 + Math.random() * 0.7),
            vx:      (Math.random() - 0.5) * (2 + bass * 8) * speed,
            vy:      -(Math.random() * 3 + bass * 6) * speed,
            radius:  Math.random() * 3 + 1.5 + treble * 3,
            hue:     (elapsed * 40 + Math.random() * 120) % 360,
            life:    1,
            maxLife: 0.8 + Math.random() * 1.5,
            lift:    0.5 + Math.random() * 0.8
        }
        this._particles.push(p)
    }

    destroy() { this._particles = [] }
}

function _roundedRect(ctx, x, y, w, h, r) {
    if (h < r * 2) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y,     x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x,     y + h, 0)
    ctx.arcTo(x,     y + h, x,     y,     0)
    ctx.arcTo(x,     y,     x + w, y,     r)
    ctx.closePath()
}

class VisualizerPresetManager {
    constructor(engine) {
        this._engine = engine
        this._presets = new Map()
    }

    save(name) {
        this._presets.set(name, {
            visualizer: this._engine._activeName,
            settings:   { ...this._engine.settings }
        })
        return this
    }

    load(name) {
        const p = this._presets.get(name)
        if (!p) throw new Error(`Preset "${name}" not found`)
        this._engine.updateSettings(p.settings)
        this._engine.loadVisualizer(p.visualizer)
        return this
    }

    exportJSON(name) {
        return JSON.stringify(this._presets.get(name) ?? {}, null, 2)
    }

    importJSON(json) {
        const p = JSON.parse(json)
        if (!p.visualizer || !p.settings) throw new Error("Invalid preset format")
        const name = p.settings._presetName ?? `imported_${Date.now()}`
        this._presets.set(name, p)
        return name
    }

    list() { return [...this._presets.keys()] }
}
export { VisualizerEngine, VisualizerBase, VisualizerPresetManager };
