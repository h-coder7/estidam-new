"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

export type DashboardPhase = {
    id: string;
    number: string;
    label: string;
    title: string;
    points: string[];
    cardTitle: string;
    status: string;
    note: string;
};

type Props = {
    phases: DashboardPhase[];
    inputs: string[];
    defaultIndex?: number;
};

/* Illustrative activity curves per phase (0..1, no values shown). */
const SERIES: Record<string, { values: number[]; guide: number }> = {
    before: { values: [0.16, 0.2, 0.26, 0.3, 0.37, 0.43, 0.48, 0.56, 0.61, 0.68], guide: 6 },
    during: { values: [0.34, 0.46, 0.63, 0.82, 0.91, 0.84, 0.92, 0.86, 0.8, 0.86], guide: 4 },
    after: { values: [0.62, 0.55, 0.57, 0.61, 0.66, 0.69, 0.72, 0.77, 0.8, 0.85], guide: 7 },
};
const WEIGHTS = [34, 26, 24, 16];

const VB_W = 600;
const VB_H = 240;
const PAD_TOP = 18;
const PAD_BOTTOM = 6;

function toPoints(values: number[]) {
    const n = values.length - 1;
    return values.map((v, i) => ({
        x: (i / n) * VB_W,
        y: PAD_TOP + (1 - v) * (VB_H - PAD_TOP - PAD_BOTTOM),
    }));
}

// Catmull-Rom → cubic bezier
function smoothPath(pts: { x: number; y: number }[]) {
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
    }
    return d;
}

const smooth = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const docTop = (el: HTMLElement) => {
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
    return y;
};

export default function HeroDashboard({ phases, inputs, defaultIndex = 0 }: Props) {
    const [index, setIndex] = useState(Math.min(defaultIndex, phases.length - 1));
    const [inView, setInView] = useState(false);
    const [drawKey, setDrawKey] = useState(0);
    const cardRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    const phase = phases[index];
    const series = SERIES[phase.id] ?? SERIES.during;

    const chart = useMemo(() => {
        const pts = toPoints(series.values);
        const line = smoothPath(pts);
        const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`;
        const g = pts[series.guide];
        const end = pts[pts.length - 1];
        return {
            line,
            area,
            guide: { x: (g.x / VB_W) * 100, y: (g.y / VB_H) * 100 },
            end: { x: (end.x / VB_W) * 100, y: (end.y / VB_H) * 100 },
        };
    }, [series]);

    // chart entrance once in view
    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    io.disconnect();
                }
            },
            { threshold: 0.35 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // tilt: rests tilted back, flattens with the scroll (or by itself if fully visible at load)
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let lastK = -1;
        const apply = (k: number) => {
            const v = Math.round(k * 1e4) / 1e4;
            if (v === lastK) return;
            lastK = v;
            card.style.setProperty("--tilt-k", String(v));
        };
        if (reduced) {
            apply(0);
            return;
        }

        const fullyVisible = docTop(card) + card.offsetHeight <= window.innerHeight;
        if (fullyVisible && window.scrollY < 10) {
            let raf = 0;
            const timer = window.setTimeout(() => {
                const start = performance.now();
                const step = (now: number) => {
                    const t = Math.min(1, (now - start) / 1400);
                    apply(1 - easeInOutCubic(t));
                    if (t < 1) raf = requestAnimationFrame(step);
                };
                raf = requestAnimationFrame(step);
            }, 1300);
            return () => {
                window.clearTimeout(timer);
                cancelAnimationFrame(raf);
            };
        }

        let raf = 0;
        const update = () => {
            raf = 0;
            const vh = window.innerHeight;
            const top = docTop(card);
            const from = Math.max(0, top - vh);
            const flatAt = Math.max(from + vh * 0.25, top + card.offsetHeight / 2 - vh / 2);
            apply(1 - smooth((Math.max(0, window.scrollY) - from) / (flatAt - from)));
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    const pick = (i: number) => {
        if (i === index) return;
        setIndex(i);
        setDrawKey((k) => k + 1);
    };

    return (
        <div className="hero_dash" ref={cardRef} data-no-ripple>
            {/* left column */}
            <div className="hd_side">
                <p className="hd_kicker">
                    <span className="hd_num">{phase.number}</span>
                    <span>{phase.label}</span>
                </p>
                <p className="hd_figure" key={`t-${drawKey}`}>
                    {phase.title}
                </p>
                <p className="hd_status">
                    <span className="hd_live" aria-hidden="true" />
                    {phase.status}
                </p>
                <ul className="hd_rows">
                    {phase.points.map((point, i) => (
                        <li key={`${phase.id}-${i}`} style={{ animationDelay: `${i * 70}ms` }}>
                            <i className="fa-regular fa-check" aria-hidden="true" />
                            <span>{point}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* chart column */}
            <div className="hd_main">
                <div className="hd_head">
                    <p className="hd_title">{phase.cardTitle}</p>
                    <div
                        className="hd_switch"
                        role="tablist"
                        style={{ "--i": index, "--n": phases.length } as CSSProperties}
                    >
                        <span className="hd_switch_pill" aria-hidden="true" />
                        {phases.map((p, i) => (
                            <button
                                key={p.id}
                                type="button"
                                role="tab"
                                aria-selected={i === index}
                                className={i === index ? "is-active" : undefined}
                                onClick={() => pick(i)}
                            >
                                {p.number}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className={`hd_chart${inView ? " is-in" : ""}`}
                    ref={chartRef}
                    dir="ltr"
                    key={`c-${drawKey}`}
                >
                    <div className="hd_grid" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="hdArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6dd3ff" stopOpacity="0.38" />
                                <stop offset="100%" stopColor="#6dd3ff" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path className="hd_area" d={chart.area} fill="url(#hdArea)" />
                        <path
                            className="hd_line"
                            d={chart.line}
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                    <span
                        className="hd_guide"
                        style={{ left: `${chart.guide.x}%`, top: `${chart.guide.y}%` }}
                        aria-hidden="true"
                    />
                    <span
                        className="hd_point"
                        style={{ left: `${chart.guide.x}%`, top: `${chart.guide.y}%` }}
                        aria-hidden="true"
                    />
                    <span
                        className={`hd_tip${chart.guide.x > 60 ? " is-flip" : ""}`}
                        style={{ left: `${chart.guide.x}%`, top: `${chart.guide.y}%` }}
                        dir="auto"
                    >
                        {phase.note}
                    </span>
                    <span
                        className="hd_end"
                        style={{ left: `${chart.end.x}%`, top: `${chart.end.y}%` }}
                        aria-hidden="true"
                    >
                        <i />
                    </span>
                </div>

                <div className="hd_axis" dir="ltr">
                    {phases.map((p, i) => (
                        <span key={p.id} className={i === index ? "is-active" : undefined} dir="auto">
                            {p.label}
                        </span>
                    ))}
                </div>

                <div className={`hd_alloc${inView ? " is-in" : ""}`}>
                    <div className="hd_bar" aria-hidden="true">
                        {WEIGHTS.map((w, i) => (
                            <span key={i} style={{ flexGrow: w, animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                    <ul className="hd_legend">
                        {inputs.map((label, i) => (
                            <li key={label}>
                                <span className={`sw sw-${i}`} aria-hidden="true" />
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
