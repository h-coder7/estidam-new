"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

type Props = {
    children: ReactNode;
};

/**
 * One-shot rise-from-below when the cards enter view.
 * Avoids scrub + per-section Lenis listeners (those were causing scroll jank).
 * LenisProvider already wires Lenis → ScrollTrigger.update globally.
 */
export default function MediaHighlightsStage({ children }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-media-card]"));
        const canvas = root.querySelector<HTMLElement>(".media_highlights_canvas") ?? root;
        if (!cards.length) return;

        const mm = gsap.matchMedia();

        mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
            root.classList.remove("is-static");

            gsap.set(cards, {
                autoAlpha: 0,
                y: 72,
                force3D: true,
            });

            const tween = gsap.to(cards, {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: "power2.out",
                overwrite: true,
                scrollTrigger: {
                    trigger: canvas,
                    start: "top 38%",
                    once: true,
                },
                onComplete: () => {
                    // Drop GPU layer hints after the entrance finishes
                    gsap.set(cards, { clearProps: "transform" });
                },
            });

            return () => {
                tween.scrollTrigger?.kill();
                tween.kill();
                gsap.set(cards, { clearProps: "all" });
            };
        });

        mm.add("(max-width: 767.98px), (prefers-reduced-motion: reduce)", () => {
            root.classList.add("is-static");
            gsap.set(cards, { clearProps: "all" });
        });

        return () => mm.revert();
    }, []);

    return (
        <div className="media_highlights_stage" ref={rootRef} data-media-stage>
            {children}
        </div>
    );
}
