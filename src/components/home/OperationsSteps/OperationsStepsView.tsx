"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis } from "@/components/LenisProvider";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export type OperationsStep = {
    meta: string;
    status: string;
    title: string;
    text: string;
    tip: string;
};

type Props = {
    eyebrow: string;
    title: string;
    description: string;
    proofLabel: string;
    proofValue: string;
    proofMetric: string;
    proofScore: string;
    proofScoreLabel: string;
    proofNote: string;
    hint: string;
    steps: OperationsStep[];
};

const DESKTOP_QUERY = "(min-width: 992px) and (prefers-reduced-motion: no-preference)";

export default function OperationsStepsView({
    eyebrow,
    title,
    description,
    proofLabel,
    proofValue,
    proofMetric,
    proofScore,
    proofScoreLabel,
    proofNote,
    hint,
    steps,
}: Props) {
    const sectionRef = useRef<HTMLElement>(null);
    const laneRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [hovered, setHovered] = useState<number | null>(null);
    const count = steps.length;

    useEffect(() => {
        const section = sectionRef.current;
        const lane = laneRef.current;
        if (!section || !lane || count < 1) return;

        const rows = Array.from(lane.querySelectorAll<HTMLElement>("[data-os-row]"));
        const mm = gsap.matchMedia();

        mm.add(DESKTOP_QUERY, () => {
            section.classList.remove("is-static");

            const distance = () => Math.max(520, rows.length * 150);

            const apply = (p: number) => {
                const climb = p * Math.max(0, count - 1);
                const index = Math.round(climb);
                setActive(index);

                gsap.set(lane, {
                    y: gsap.utils.interpolate(90, -distance() * 0.44, p),
                    rotateX: 12 - p * 2,
                    rotateY: -18 + p * 5,
                });

                rows.forEach((row, i) => {
                    const delta = i - climb;
                    const proximity = 1 - Math.min(1, Math.abs(delta) / 2.15);
                    const depth = Math.abs(delta);
                    gsap.set(row, {
                        opacity: 0.26 + proximity * 0.74,
                        z: (count - i) * 30 - depth * 16,
                        scale: 0.91 + proximity * 0.09,
                        filter: `blur(${Math.max(0, depth - 0.32) * 1.2}px)`,
                    });
                });
            };

            const st = ScrollTrigger.create({
                trigger: section,
                start: "top top",
                end: () => `+=${distance()}`,
                pin: true,
                scrub: 0.65,
                anticipatePin: 1,
                onUpdate: (self) => apply(self.progress),
                onRefresh: (self) => apply(self.progress),
            });

            apply(st.progress);

            const lenis = getLenis();
            const onLenis = () => ScrollTrigger.update();
            lenis?.on("scroll", onLenis);
            const refresh = () => ScrollTrigger.refresh();
            window.addEventListener("resize", refresh);

            return () => {
                lenis?.off("scroll", onLenis);
                window.removeEventListener("resize", refresh);
                st.kill();
                gsap.set(lane, { clearProps: "transform" });
                rows.forEach((row) => gsap.set(row, { clearProps: "all" }));
            };
        });

        mm.add("(max-width: 991.98px), (prefers-reduced-motion: reduce)", () => {
            section.classList.add("is-static");
            setActive(0);
        });

        return () => mm.revert();
    }, [count]);

    return (
        <section className="operations_steps" ref={sectionRef} id="operations-path" data-operations-steps>
            <div className="container operations_steps_inner">
                <div className="operations_steps_copy">
                    <p className="operations_steps_eyebrow">
                        <span className="operations_steps_dot" aria-hidden="true" />
                        <span>{eyebrow}</span>
                    </p>
                    <h2 className="operations_steps_title">{title}</h2>
                    <p className="operations_steps_description">{description}</p>

                    <div className="operations_steps_proof" aria-label={proofLabel}>
                        <div className="operations_steps_proof_top">
                            <span>{proofLabel}</span>
                            <span>{proofNote}</span>
                        </div>
                        <div className="operations_steps_proof_metrics">
                            <div>
                                <strong>{proofValue}</strong>
                                <span>{proofMetric}</span>
                            </div>
                            <div>
                                <strong>{proofScore}</strong>
                                <span>{proofScoreLabel}</span>
                            </div>
                        </div>
                    </div>

                    <p className="operations_steps_hint">{hint}</p>
                </div>

                <div className="operations_steps_stage">
                    <div className="operations_steps_perspective">
                        <div className="operations_steps_lane" ref={laneRef}>
                            {steps.map((step, index) => {
                                const number = String(index + 1).padStart(2, "0");
                                const isActive = index === active;
                                const isHovered = hovered === index;

                                return (
                                    <div
                                        key={`${number}-${step.title}`}
                                        className={`operations_steps_row${isActive ? " is-active" : ""}`}
                                        data-os-row={index}
                                        onPointerEnter={() => setHovered(index)}
                                        onPointerLeave={() => setHovered(null)}
                                    >
                                        <div className="operations_steps_rank">
                                            <span className="operations_steps_number">{number}</span>
                                            <span className="operations_steps_meta">{step.meta}</span>
                                        </div>

                                        <article className="operations_steps_card">
                                            <div className="operations_steps_card_top">
                                                <p className="operations_steps_card_kicker">{eyebrow}</p>
                                                <span className="operations_steps_status">{step.status}</span>
                                            </div>
                                            <h3 className="operations_steps_card_title">{step.title}</h3>
                                            <p className="operations_steps_card_text">{step.text}</p>

                                            {(isHovered || isActive) && (
                                                <div className="operations_steps_tip" role="note">
                                                    {step.tip}
                                                </div>
                                            )}
                                        </article>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
