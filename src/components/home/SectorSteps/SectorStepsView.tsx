"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis } from "@/components/LenisProvider";
import { SEASON_HANDOFFS, SEASON_LABELS, SEASON_LABELS_AR } from "@/components/home/WhyEstidam/WhyEstidamScenes";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

type Props = {
    locale: string;
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
    phasesLabel: string;
    lanesLabel: string;
};

const PHASE_DWELL = 2.6;
const ROW_GAP = 0.32;
const CARD_STAGGER = 0.09;

export default function SectorStepsView({
    locale,
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
    phasesLabel,
    lanesLabel,
}: Props) {
    const sectionRef = useRef<HTMLElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const [activePhase, setActivePhase] = useState(0);
    const [hovered, setHovered] = useState<{ lane: number; phase: number } | null>(null);

    const labels = locale === "ar" ? SEASON_LABELS_AR : SEASON_LABELS;
    const phaseCount = labels.phases.length;

    const cells = useMemo(() => {
        const map = new Map<string, string>();
        Object.entries(labels.blocks).forEach(([lane, row]) => {
            Object.entries(row).forEach(([phase, text]) => {
                map.set(`${lane}-${phase}`, text);
            });
        });
        return map;
    }, [labels]);

    useEffect(() => {
        const section = sectionRef.current;
        const board = boardRef.current;
        if (!section || !board || phaseCount < 1) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const phaseEls = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_phase"));
        const rows = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_lane_row"));
        const allBlocks = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_block"));
        const allEmpties = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_empty"));
        const laneLabels = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_lane_label"));
        const corner = board.querySelector<HTMLElement>(".sector_steps_corner");

        const applyPhase = (index: number) => {
            const next = ((index % phaseCount) + phaseCount) % phaseCount;
            setActivePhase(next);
            board.style.setProperty("--ss-phase", String(next));
        };

        applyPhase(0);

        let phaseLoop: gsap.core.Timeline | null = null;

        const startPhaseLoop = () => {
            if (phaseLoop || reduced) return;
            phaseLoop = gsap.timeline({ repeat: -1 });
            for (let i = 0; i < phaseCount; i++) {
                phaseLoop.call(() => applyPhase(i), undefined, i * PHASE_DWELL);
            }
            phaseLoop.set({}, {}, phaseCount * PHASE_DWELL);
        };

        if (reduced) {
            gsap.set([phaseEls, laneLabels, allBlocks, allEmpties, corner].flat().filter(Boolean), {
                clearProps: "all",
            });
            startPhaseLoop();
            return () => {
                phaseLoop?.kill();
            };
        }

        const fromX = locale === "ar" ? 18 : -18;

        gsap.set(phaseEls, { opacity: 0, y: -10, rotateX: 18 });
        gsap.set(laneLabels, { opacity: 0, x: fromX });
        if (corner) gsap.set(corner, { opacity: 0 });
        gsap.set(allBlocks, {
            opacity: 0,
            y: 26,
            rotateX: 42,
            z: -36,
            transformPerspective: 900,
            transformOrigin: "50% 100%",
        });
        gsap.set(allEmpties, { opacity: 0, scaleX: 0.4 });
        gsap.set(board, {
            rotateX: 14,
            rotateY: locale === "ar" ? 14 : -14,
            y: 28,
            opacity: 0.55,
        });

        const entrance = gsap.timeline({
            paused: true,
            defaults: { ease: "power3.out" },
            onComplete: startPhaseLoop,
        });

        entrance.to(
            board,
            {
                opacity: 1,
                y: 0,
                rotateX: 8,
                rotateY: locale === "ar" ? 10 : -10,
                duration: 0.7,
                ease: "power2.out",
            },
            0,
        );

        if (corner) {
            entrance.to(corner, { opacity: 1, duration: 0.35 }, 0.12);
        }

        entrance.to(
            phaseEls,
            {
                opacity: 1,
                y: 0,
                rotateX: 0,
                duration: 0.45,
                stagger: 0.055,
            },
            0.15,
        );

        rows.forEach((row, rowIndex) => {
            const at = 0.28 + rowIndex * ROW_GAP;
            const label = laneLabels[rowIndex];
            const cards = gsap.utils.toArray<HTMLElement>(row.querySelectorAll(".sector_steps_block, .sector_steps_empty"));

            if (label) {
                entrance.to(label, { opacity: 1, x: 0, duration: 0.4 }, at);
            }

            entrance.to(
                cards,
                {
                    opacity: 1,
                    y: 0,
                    rotateX: 0,
                    z: 0,
                    scaleX: 1,
                    duration: 0.55,
                    stagger: CARD_STAGGER,
                    ease: "power3.out",
                    onComplete: () => {
                        gsap.set(cards, { clearProps: "opacity,transform" });
                    },
                },
                at + 0.06,
            );
        });

        const st = ScrollTrigger.create({
            trigger: section,
            start: "top 78%",
            once: true,
            onEnter: () => {
                if (!entrance.isActive() && entrance.progress() === 0) entrance.play(0);
            },
        });

        requestAnimationFrame(() => {
            const top = section.getBoundingClientRect().top;
            if (top < window.innerHeight * 0.78) {
                if (!entrance.isActive() && entrance.progress() === 0) entrance.play(0);
            }
        });

        const lenis = getLenis();
        const onLenis = () => ScrollTrigger.update();
        lenis?.on("scroll", onLenis);
        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener("resize", refresh);

        return () => {
            lenis?.off("scroll", onLenis);
            window.removeEventListener("resize", refresh);
            st.kill();
            entrance.kill();
            phaseLoop?.kill();
            gsap.set(board, { clearProps: "transform,opacity" });
        };
    }, [phaseCount, locale]);

    return (
        <section className="sector_steps" ref={sectionRef} id="sector" data-sector-steps>
            <div className="container sector_steps_inner">
                <div className="sector_steps_copy">
                    <p className="sector_steps_eyebrow">
                        <span className="sector_steps_dot" aria-hidden="true" />
                        <span>{eyebrow}</span>
                    </p>
                    <h2 className="sector_steps_title">{title}</h2>
                    <p className="sector_steps_description">{description}</p>

                    <div className="sector_steps_proof" aria-label={proofLabel}>
                        <div className="sector_steps_proof_top">
                            <span>{proofLabel}</span>
                            <span>{proofNote}</span>
                        </div>
                        <div className="sector_steps_proof_metrics">
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

                    <div className="sector_steps_legend" aria-hidden="true">
                        <span>{phasesLabel}</span>
                        <strong>{labels.phases[activePhase]}</strong>
                    </div>
                    <p className="sector_steps_hint">{hint}</p>
                </div>

                <div className="sector_steps_stage">
                    <div className="sector_steps_perspective">
                        <div
                            className="sector_steps_board"
                            ref={boardRef}
                            style={{ ["--ss-phase" as string]: activePhase }}
                            role="table"
                            aria-label={`${phasesLabel} / ${lanesLabel}`}
                        >
                            <div className="sector_steps_board_head" role="row">
                                <div className="sector_steps_corner" role="columnheader">
                                    <span>{lanesLabel}</span>
                                </div>
                                {labels.phases.map((phase, phaseIndex) => (
                                    <div
                                        key={phase}
                                        className={`sector_steps_phase${phaseIndex === activePhase ? " is-active" : ""}`}
                                        role="columnheader"
                                    >
                                        <span className="sector_steps_phase_index">{String(phaseIndex + 1).padStart(2, "0")}</span>
                                        <span className="sector_steps_phase_name">{phase}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="sector_steps_board_body">
                                {labels.lanes.map((lane, laneIndex) => (
                                    <div className="sector_steps_lane_row" role="row" key={lane}>
                                        <div className="sector_steps_lane_label" role="rowheader">
                                            {lane}
                                        </div>

                                        {labels.phases.map((phase, phaseIndex) => {
                                            const cell = cells.get(`${laneIndex}-${phaseIndex}`);
                                            const isActive = phaseIndex === activePhase;
                                            const isHot = hovered?.lane === laneIndex && hovered.phase === phaseIndex;
                                            const handoff = SEASON_HANDOFFS.some(
                                                ([from, to, p]) => p === phaseIndex && (from === laneIndex || to === laneIndex),
                                            );

                                            return (
                                                <div
                                                    key={`${lane}-${phase}`}
                                                    className={`sector_steps_cell${cell ? " has-block" : ""}${isActive ? " is-active" : ""}${handoff ? " is-handoff" : ""}`}
                                                    role="cell"
                                                    data-phase={phaseIndex}
                                                    onPointerEnter={() => cell && setHovered({ lane: laneIndex, phase: phaseIndex })}
                                                    onPointerLeave={() => setHovered(null)}
                                                >
                                                    {cell ? (
                                                        <div className={`sector_steps_block${isHot || isActive ? " is-lit" : ""}`}>
                                                            <span className="sector_steps_block_dot" aria-hidden="true" />
                                                            <span>{cell}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="sector_steps_empty" aria-hidden="true" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
