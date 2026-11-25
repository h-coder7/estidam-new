"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { getLenis } from "@/components/LenisProvider";
import "./_ScrollProgressBar.scss";

const CSS_WIDTH = 22;
const INSET = 2;
const STEP = 5;
const TICK_H = 2;
const RADIUS = 1;
const IDLE_W = 4;
const IDLE_RGB: [number, number, number] = [41, 92, 199];
const IDLE_A = 0.55;
const EASE = 0.35;
const SNAP = 0.4;
const GLIDE_S = 0.9;

const PEAK_W = [15, 12, 9, 7, 5, 4] as const;
const PEAK_RGB: ReadonlyArray<readonly [number, number, number, number]> = [
    [11, 26, 51, 1],
    [41, 92, 199, 1],
    [22, 145, 208, 1],
    [41, 120, 204, 1],
    [90, 150, 205, 1],
    [41, 92, 199, IDLE_A],
];

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function clamp01(n: number) {
    return Math.max(0, Math.min(1, n));
}

function samplePeak(distSteps: number): { w: number; r: number; g: number; b: number; a: number } {
    if (distSteps >= PEAK_W.length - 1) {
        return { w: IDLE_W, r: IDLE_RGB[0], g: IDLE_RGB[1], b: IDLE_RGB[2], a: IDLE_A };
    }
    const i = Math.floor(distSteps);
    const t = distSteps - i;
    const c0 = PEAK_RGB[i];
    const c1 = PEAK_RGB[i + 1];
    return {
        w: lerp(PEAK_W[i], PEAK_W[i + 1], t),
        r: lerp(c0[0], c1[0], t),
        g: lerp(c0[1], c1[1], t),
        b: lerp(c0[2], c1[2], t),
        a: lerp(c0[3], c1[3], t),
    };
}

function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3;
}

function maxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function currentScrollY() {
    const lenis = getLenis();
    if (lenis && typeof lenis.scroll === "number") return lenis.scroll;
    return window.scrollY || document.documentElement.scrollTop || 0;
}

function scrollToY(y: number) {
    const target = Math.max(0, Math.min(maxScrollY(), y));
    const lenis = getLenis();
    if (lenis) {
        lenis.scrollTo(target, { duration: GLIDE_S, easing: easeOutCubic, force: true });
        return;
    }
    const start = currentScrollY();
    const delta = target - start;
    if (Math.abs(delta) < 0.5) return;
    const t0 = performance.now();
    const durationMs = GLIDE_S * 1000;
    const step = (now: number) => {
        const t = clamp01((now - t0) / durationMs);
        window.scrollTo(0, start + delta * easeOutCubic(t));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

export default function ScrollProgressBar() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let shown = currentScrollY();
        let cssH = 0;
        let dragging = false;
        let disposed = false;

        const resize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            cssH = canvas.clientHeight || window.innerHeight;
            canvas.width = Math.max(1, Math.round(CSS_WIDTH * dpr));
            canvas.height = Math.max(1, Math.round(cssH * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const yToScroll = (clientY: number) => {
            const rect = canvas.getBoundingClientRect();
            const drawable = Math.max(1, rect.height - INSET * 2);
            const ratio = clamp01((clientY - rect.top - INSET) / drawable);
            return ratio * maxScrollY();
        };

        const draw = () => {
            if (disposed) return;

            const max = maxScrollY();
            if (max <= 0) {
                canvas.style.visibility = "hidden";
                canvas.style.pointerEvents = "none";
                ctx.clearRect(0, 0, CSS_WIDTH, cssH || canvas.clientHeight);
                return;
            }

            canvas.style.visibility = "visible";
            canvas.style.pointerEvents = "auto";

            const scrollY = currentScrollY();
            shown += (scrollY - shown) * EASE;
            if (Math.abs(scrollY - shown) < SNAP) shown = scrollY;

            const progress = clamp01(shown / max);
            const h = cssH || canvas.clientHeight;
            const drawable = Math.max(1, h - INSET * 2);
            const playheadY = INSET + progress * drawable;

            ctx.clearRect(0, 0, CSS_WIDTH, h);

            const lastTop = h - INSET - TICK_H;
            for (let y = INSET; y <= lastTop + 0.001; y += STEP) {
                const tickCenter = y + TICK_H / 2;
                const distSteps = Math.abs(tickCenter - playheadY) / STEP;
                const peak = samplePeak(distSteps);
                const x = CSS_WIDTH - peak.w;

                ctx.fillStyle = `rgba(${peak.r | 0}, ${peak.g | 0}, ${peak.b | 0}, ${peak.a})`;
                ctx.beginPath();
                if (typeof ctx.roundRect === "function") {
                    ctx.roundRect(x, y, peak.w, TICK_H, RADIUS);
                } else {
                    ctx.rect(x, y, peak.w, TICK_H);
                }
                ctx.fill();
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            dragging = true;
            canvas.setPointerCapture(e.pointerId);
            scrollToY(yToScroll(e.clientY));
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            scrollToY(yToScroll(e.clientY));
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            if (canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId);
            }
        };

        resize();
        draw();

        const ro = new ResizeObserver(() => {
            resize();
            draw();
        });
        ro.observe(document.documentElement);
        ro.observe(canvas);

        window.addEventListener("resize", resize);
        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.addEventListener("lostpointercapture", onPointerUp);

        const useGsap = typeof gsap !== "undefined" && gsap?.ticker;
        const onTick = () => draw();
        if (useGsap) {
            gsap.ticker.add(onTick);
        } else {
            let raf = 0;
            const loop = () => {
                draw();
                raf = requestAnimationFrame(loop);
            };
            raf = requestAnimationFrame(loop);
            return () => {
                disposed = true;
                cancelAnimationFrame(raf);
                cleanupDom();
            };
        }

        function cleanupDom() {
            ro.disconnect();
            window.removeEventListener("resize", resize);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            canvas.removeEventListener("lostpointercapture", onPointerUp);
        }

        return () => {
            disposed = true;
            if (useGsap) gsap.ticker.remove(onTick);
            cleanupDom();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="scroll_progress_bar"
            aria-hidden="true"
            width={CSS_WIDTH}
            height={100}
        />
    );
}
