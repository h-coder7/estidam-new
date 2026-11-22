"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Local neon-sign flicker for the hero brand mark only.
 * Inspired by Signal Type behaviour — not the React Bits Pro package.
 * Estidam tokens: lit #fff / glow #1691d0 · blue #295cc7.
 */

type LetterState = "idle" | "flash" | "lit" | "dim";

function splitGraphemes(text: string): string[] {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        return [...segmenter.segment(text)].map((s) => s.segment);
    }
    return Array.from(text);
}

function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type HeroNeonSignalProps = {
    text: string;
    className?: string;
    /** Keep Arabic as one unit so letterforms stay connected. */
    asWord?: boolean;
    /** ms before first letter starts */
    delay?: number;
    /** ms between letter starts */
    stagger?: number;
};

export default function HeroNeonSignal({
    text,
    className = "",
    asWord = false,
    delay = 280,
    stagger = 70,
}: HeroNeonSignalProps) {
    const letters = useMemo(() => (asWord ? [text] : splitGraphemes(text)), [text, asWord]);
    const [states, setStates] = useState<LetterState[]>(() => letters.map(() => "idle"));
    const [ready, setReady] = useState(false);
    const rootRef = useRef<HTMLSpanElement>(null);
    const timers = useRef<number[]>([]);

    const clearTimers = () => {
        timers.current.forEach((id) => window.clearTimeout(id));
        timers.current = [];
    };

    const schedule = (fn: () => void, ms: number) => {
        const id = window.setTimeout(fn, ms);
        timers.current.push(id);
    };

    useEffect(() => {
        setStates(letters.map(() => "idle"));
        setReady(false);
        clearTimers();

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            setStates(letters.map(() => "lit"));
            setReady(true);
            return;
        }

        const node = rootRef.current;
        if (!node) return;

        let started = false;
        const rand = mulberry32(text.length * 97 + 11);

        const igniteLetter = (index: number) => {
            const flickers = 1 + Math.floor(rand() * 3);
            let step = 0;

            const tick = () => {
                if (step < flickers * 2) {
                    const on = step % 2 === 1;
                    setStates((prev) => {
                        const next = [...prev];
                        next[index] = on ? "flash" : "idle";
                        return next;
                    });
                    step += 1;
                    schedule(tick, 40 + rand() * 70);
                    return;
                }

                setStates((prev) => {
                    const next = [...prev];
                    next[index] = "lit";
                    return next;
                });

                // Occasional loose-connection flicker after lit
                if (rand() < 0.45) {
                    schedule(() => {
                        setStates((prev) => {
                            const next = [...prev];
                            if (next[index] === "lit") next[index] = "dim";
                            return next;
                        });
                        schedule(() => {
                            setStates((prev) => {
                                const next = [...prev];
                                next[index] = "lit";
                                return next;
                            });
                        }, 60 + rand() * 90);
                    }, 900 + rand() * 2200);
                }
            };

            tick();
        };

        const start = () => {
            if (started) return;
            started = true;
            setReady(true);

            const order = letters.map((_, i) => i);
            // Center-out feels more "sign powering on" for a brand mark
            order.sort((a, b) => {
                const mid = (letters.length - 1) / 2;
                return Math.abs(a - mid) - Math.abs(b - mid) || a - b;
            });

            order.forEach((letterIndex, sequence) => {
                schedule(() => igniteLetter(letterIndex), delay + sequence * stagger);
            });
        };

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    start();
                    io.disconnect();
                }
            },
            { threshold: 0.25 },
        );
        io.observe(node);

        return () => {
            io.disconnect();
            clearTimers();
        };
    }, [text, letters, delay, stagger]);

    return (
        <span
            ref={rootRef}
            className={`hero_neon_signal ${ready ? "is-ready" : ""} ${className}`.trim()}
            aria-hidden="true"
        >
            {letters.map((ch, i) => (
                <span key={`${ch}-${i}`} className={`hero_neon_letter is-${states[i] ?? "idle"}`} data-char={ch}>
                    <span className="hero_neon_letter_ghost" aria-hidden="true">
                        {ch === " " ? "\u00a0" : ch}
                    </span>
                    <span className="hero_neon_letter_lit" aria-hidden="true">
                        {ch === " " ? "\u00a0" : ch}
                    </span>
                </span>
            ))}
        </span>
    );
}
