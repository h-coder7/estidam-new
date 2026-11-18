"use client";

import { useEffect, useRef } from "react";

/*
 * Hero halftone — a ring of white dots generated in code (no external SVG),
 * redrawn alive on a canvas: a slow diagonal shimmer, wobbly rings pulsing out
 * from behind the headline, a lens under a fine cursor (dots swell, brighten,
 * part; the nearest turn accent) and a ripple on click / tap.
 * Runs only while the hero is on screen; frame-rate independent.
 */

const ACCENT = "#6dd3ff";
const LENS = 130;
const RIPPLE_SPEED = 520;
const RIPPLE_WIDTH = 36;
const RIPPLE_LIFE = 1.5;
const PULSE_CENTER_Y = 0.42;
const PULSE_SPEED = 150;
const PULSE_SPACING = 280;
const PULSE_FALLOFF = 1100;
const PARALLAX = 0.35;
const PARALLAX_MAX = 120;

const perFrame = (k: number, dt: number) => 1 - Math.pow(1 - k, dt * 60);

// tiny deterministic hash → 0..1 (stable dot texture across renders)
const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
};

type Dots = { x: Float32Array; y: Float32Array; r: Float32Array; o: Float32Array };

function buildDots(w: number, h: number, mobile: boolean): Dots {
    const step = mobile ? 16 : 18;
    const cx = w / 2;
    const cy = h * PULSE_CENTER_Y;
    const ringR = Math.max(w, h) * (mobile ? 0.42 : 0.36);
    const ringW = ringR * 0.42;
    const xs: number[] = [];
    const ys: number[] = [];
    const rs: number[] = [];
    const os: number[] = [];

    for (let gy = step / 2; gy < h; gy += step) {
        const row = Math.round(gy / step);
        const offset = row % 2 ? step / 2 : 0;
        for (let gx = offset; gx < w + step; gx += step) {
            const dx = gx - cx;
            const dy = (gy - cy) * 1.15;
            const d = Math.hypot(dx, dy);
            const ring = Math.exp(-(((d - ringR) / ringW) ** 2));
            const inner = Math.exp(-((d / (ringR * 0.55)) ** 2)) * 0.25;
            const noise = 0.75 + 0.5 * hash(gx, gy);
            const p = Math.min(1, (ring + inner) * noise);
            const r = 0.4 + 2.6 * p;
            const o = 0.05 + 0.45 * p;
            if (p < 0.06) continue;
            xs.push(gx);
            ys.push(gy);
            rs.push(r);
            os.push(o);
        }
    }

    return {
        x: Float32Array.from(xs),
        y: Float32Array.from(ys),
        r: Float32Array.from(rs),
        o: Float32Array.from(os),
    };
}

const HeroHalftone = () => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        const section = wrap?.closest("section");
        if (!wrap || !canvas || !section) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1025px)").matches;

        let dots: Dots | null = null;
        let w = 0;
        let h = 0;
        let cx = 0;
        let cy = 0;
        let scale = new Float32Array(0);
        let boost = new Float32Array(0);
        let accent = new Float32Array(0);
        let pushX = new Float32Array(0);
        let pushY = new Float32Array(0);
        let pointer: { x: number; y: number } | null = null;
        const ripples: { x: number; y: number; t: number }[] = [];
        let now = 0;
        let last = 0;
        let raf = 0;
        let running = false;

        const layout = () => {
            w = wrap.offsetWidth;
            h = wrap.offsetHeight;
            if (!w || !h) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            dots = buildDots(w, h, w < 768);
            const n = dots.x.length;
            scale = new Float32Array(n).fill(1);
            boost = new Float32Array(n);
            accent = new Float32Array(n);
            pushX = new Float32Array(n);
            pushY = new Float32Array(n);
            cx = w / 2;
            cy = h * PULSE_CENTER_Y;
            draw(0);
        };

        const draw = (dt: number) => {
            if (!dots) return;
            const { x, y, r, o } = dots;
            const k = dt ? perFrame(0.16, dt) : 1;
            ctx.clearRect(0, 0, w, h);
            for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > RIPPLE_LIFE) ripples.splice(i, 1);

            for (let i = 0; i < x.length; i++) {
                const shimmer = reduced ? 1 : 0.9 + 0.1 * Math.sin(now * 0.8 - x[i] * 0.006 - y[i] * 0.004);
                let tScale = 1;
                let tBoost = 0;
                let tAccent = 0;
                let tx = 0;
                let ty = 0;

                if (!reduced) {
                    const dx = x[i] - cx;
                    const dy = y[i] - cy;
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);
                    const wobble = 16 * Math.sin(angle * 3 + now * 0.6) + 9 * Math.sin(angle * 5 - now * 0.9);
                    const phase = ((dist + wobble - now * PULSE_SPEED) / PULSE_SPACING) * Math.PI * 2;
                    const crest = Math.pow((Math.cos(phase) + 1) / 2, 10);
                    const echo = Math.pow((Math.cos(phase + 0.9) + 1) / 2, 14);
                    const fade = Math.max(0, 1 - dist / PULSE_FALLOFF);
                    const b = Math.min(1, (crest + 0.4 * echo) * (0.35 + 0.65 * fade));
                    tScale += 0.9 * b;
                    tBoost += 0.4 * b;
                }

                if (pointer) {
                    const dx = x[i] - pointer.x;
                    const dy = y[i] - pointer.y;
                    const d = Math.hypot(dx, dy);
                    if (d < LENS * 2) {
                        const f = Math.exp(-((d / LENS) ** 2));
                        tScale += 1.1 * f;
                        tBoost += 0.4 * f;
                        tAccent = f > 0.72 ? (f - 0.72) / 0.28 : 0;
                        const push = (7 * f) / Math.max(d, 1);
                        tx = dx * push;
                        ty = dy * push;
                    }
                }

                for (const rp of ripples) {
                    const age = now - rp.t;
                    const d = Math.hypot(x[i] - rp.x, y[i] - rp.y);
                    const band =
                        Math.exp(-(((d - age * RIPPLE_SPEED) / RIPPLE_WIDTH) ** 2)) * (1 - age / RIPPLE_LIFE);
                    tScale += 1.3 * band;
                    tBoost += 0.5 * band;
                    if (band > 0.6) tAccent = Math.max(tAccent, (band - 0.6) / 0.4);
                }

                scale[i] += (tScale - scale[i]) * k;
                boost[i] += (tBoost - boost[i]) * k;
                accent[i] += (tAccent - accent[i]) * k;
                pushX[i] += (tx - pushX[i]) * k;
                pushY[i] += (ty - pushY[i]) * k;

                const a = Math.min(1, o[i] * shimmer + boost[i] * Math.max(o[i] * 2.2, 0.25));
                if (a < 0.01) continue;
                ctx.globalAlpha = a;
                ctx.fillStyle = accent[i] > 0.5 ? ACCENT : "#fff";
                ctx.beginPath();
                ctx.arc(x[i] + pushX[i], y[i] + pushY[i], r[i] * scale[i], 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        };

        const tick = (time: number) => {
            const dt = last ? Math.min(0.1, (time - last) / 1000) : 1 / 60;
            last = time;
            now += dt;
            draw(dt);
            raf = requestAnimationFrame(tick);
        };

        const run = (on: boolean) => {
            if (reduced) return;
            if (on && !running) {
                running = true;
                last = 0;
                raf = requestAnimationFrame(tick);
            } else if (!on && running) {
                running = false;
                cancelAnimationFrame(raf);
            }
        };

        const toLocal = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        const onMove = (e: PointerEvent) => {
            pointer = toLocal(e);
        };
        const onLeave = () => {
            pointer = null;
        };
        const onDown = (e: PointerEvent) => {
            if ((e.target as Element).closest("a, button, input, [data-no-ripple]")) return;
            ripples.push({ ...toLocal(e), t: now });
        };

        if (fine && !reduced) {
            section.addEventListener("pointermove", onMove);
            section.addEventListener("pointerleave", onLeave);
        }
        if (!reduced) section.addEventListener("pointerdown", onDown);

        // parallax — lags behind the scroll, saturating smoothly
        let lastY = -1;
        const onScroll = () => {
            if (reduced) return;
            const raw = Math.max(0, window.scrollY) * PARALLAX;
            const y = Math.round(PARALLAX_MAX * (1 - Math.exp(-raw / PARALLAX_MAX)) * 100) / 100;
            if (y === lastY) return;
            lastY = y;
            wrap.style.translate = y > 0 ? `0 ${y}px` : "";
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();

        const io = new IntersectionObserver(([entry]) => run(entry.isIntersecting));
        io.observe(section);
        const ro = new ResizeObserver(() => layout());
        ro.observe(wrap);
        layout();

        return () => {
            run(false);
            io.disconnect();
            ro.disconnect();
            window.removeEventListener("scroll", onScroll);
            section.removeEventListener("pointermove", onMove);
            section.removeEventListener("pointerleave", onLeave);
            section.removeEventListener("pointerdown", onDown);
        };
    }, []);

    return (
        <div className="hero_halftone" ref={wrapRef} aria-hidden="true">
            <canvas ref={canvasRef} />
        </div>
    );
};

export default HeroHalftone;
