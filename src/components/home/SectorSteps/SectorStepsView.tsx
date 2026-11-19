"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis } from "@/components/LenisProvider";
import { SEASON_HANDOFFS, SEASON_LABELS, SEASON_LABELS_AR } from "@/components/home/WhyEstidam/WhyEstidamScenes";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export type PracticalAiStep = {
    meta: string;
    status: string;
    title: string;
    text: string;
};

type PracticalAiContent = {
    eyebrow: string;
    description: string;
    status: string;
    steps: PracticalAiStep[];
};

type Props = {
    locale: string;
    eyebrow: string;
    description: string;
    phasesLabel: string;
    lanesLabel: string;
    practicalAi: PracticalAiContent;
    embedded?: boolean;
};

const PHASE_DWELL = 2.6;
const AI_DWELL = 2.4;
const ROW_GAP = 0.32;
const CARD_STAGGER = 0.09;

export default function SectorStepsView({
    locale,
    eyebrow,
    description,
    phasesLabel,
    lanesLabel,
    practicalAi,
    embedded = false,
}: Props) {
    const sectionRef = useRef<HTMLElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const aiLaneRef = useRef<HTMLDivElement>(null);
    const [activePhase, setActivePhase] = useState(0);
    const [activeAi, setActiveAi] = useState(0);
    const [hovered, setHovered] = useState<{ lane: number; phase: number } | null>(null);

    const labels = locale === "ar" ? SEASON_LABELS_AR : SEASON_LABELS;
    const phaseCount = labels.phases.length;
    const aiCount = practicalAi.steps.length;

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
        const aiLane = aiLaneRef.current;
        if (!section || !board || phaseCount < 1) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const phaseEls = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_phase"));
        const rows = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_lane_row"));
        const allBlocks = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_block"));
        const allEmpties = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_empty"));
        const laneLabels = gsap.utils.toArray<HTMLElement>(board.querySelectorAll(".sector_steps_lane_label"));
        const corner = board.querySelector<HTMLElement>(".sector_steps_corner");
        const aiCards = aiLane
            ? gsap.utils.toArray<HTMLElement>(aiLane.querySelectorAll("[data-pai-card]"))
            : [];

        const applyPhase = (index: number) => {
            const next = ((index % phaseCount) + phaseCount) % phaseCount;
            setActivePhase(next);
            board.style.setProperty("--ss-phase", String(next));
        };

        applyPhase(0);

        let phaseLoop: gsap.core.Timeline | null = null;
        let aiLoop: gsap.core.Timeline | null = null;

        const startLoops = () => {
            if (!phaseLoop && !reduced) {
                phaseLoop = gsap.timeline({ repeat: -1 });
                for (let i = 0; i < phaseCount; i++) {
                    phaseLoop.call(() => applyPhase(i), undefined, i * PHASE_DWELL);
                }
                phaseLoop.set({}, {}, phaseCount * PHASE_DWELL);
            }

            if (!aiLoop && !reduced && aiCount > 0) {
                aiLoop = gsap.timeline({ repeat: -1 });
                for (let i = 0; i < aiCount; i++) {
                    aiLoop.call(() => setActiveAi(i), undefined, i * AI_DWELL);
                }
                aiLoop.set({}, {}, aiCount * AI_DWELL);
            }
        };

        if (reduced) {
            startLoops();
            return () => {
                phaseLoop?.kill();
                aiLoop?.kill();
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
            rotateX: 10,
            rotateY: locale === "ar" ? 10 : -10,
            y: 22,
            opacity: 0.55,
        });
        if (aiCards.length) {
            gsap.set(aiCards, {
                opacity: 0,
                y: 22,
                rotateX: 24,
                transformPerspective: 800,
                transformOrigin: "50% 100%",
            });
        }

        const entrance = gsap.timeline({
            paused: true,
            defaults: { ease: "power3.out" },
            onComplete: startLoops,
        });

        entrance.to(
            board,
            {
                opacity: 1,
                y: 0,
                rotateX: 6,
                rotateY: locale === "ar" ? 8 : -8,
                duration: 0.7,
                ease: "power2.out",
            },
            0,
        );

        if (corner) entrance.to(corner, { opacity: 1, duration: 0.35 }, 0.12);

        entrance.to(
            phaseEls,
            { opacity: 1, y: 0, rotateX: 0, duration: 0.45, stagger: 0.055 },
            0.15,
        );

        rows.forEach((row, rowIndex) => {
            const at = 0.28 + rowIndex * ROW_GAP;
            const label = laneLabels[rowIndex];
            const cards = gsap.utils.toArray<HTMLElement>(
                row.querySelectorAll(".sector_steps_block, .sector_steps_empty"),
            );

            if (label) entrance.to(label, { opacity: 1, x: 0, duration: 0.4 }, at);

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
                    onComplete: () => gsap.set(cards, { clearProps: "opacity,transform" }),
                },
                at + 0.06,
            );
        });

        if (aiCards.length) {
            entrance.to(
                aiCards,
                {
                    opacity: 1,
                    y: 0,
                    rotateX: 0,
                    duration: 0.5,
                    stagger: 0.12,
                    ease: "power3.out",
                    onComplete: () => gsap.set(aiCards, { clearProps: "opacity,transform" }),
                },
                0.35,
            );
        }

        const playIfNeeded = () => {
            if (!entrance.isActive() && entrance.progress() === 0) entrance.play(0);
        };

        const st = ScrollTrigger.create({
            trigger: section,
            start: "top 78%",
            once: true,
            onEnter: playIfNeeded,
        });

        requestAnimationFrame(() => {
            if (section.getBoundingClientRect().top < window.innerHeight * 0.78) playIfNeeded();
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
            aiLoop?.kill();
            gsap.set(board, { clearProps: "transform,opacity" });
        };
    }, [phaseCount, locale, aiCount]);

    const content = (
        <div className="row sector_steps_row align-items-stretch">
            <div className="col-lg-8">
                <div className="sector_steps_panel">
                    <header className="sector_steps_copy">
                        <h2 className="sector_steps_eyebrow">
                            <span className="sector_steps_dot" aria-hidden="true" />
                            <span>{eyebrow}</span>
                        </h2>
                        <p className="sector_steps_description">{description}</p>
                        <p className="sector_steps_live" aria-live="polite">
                            <span>{phasesLabel}</span>
                            <strong>{labels.phases[activePhase]}</strong>
                        </p>
                    </header>

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
                                            <span className="sector_steps_phase_index">
                                                {String(phaseIndex + 1).padStart(2, "0")}
                                            </span>
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
                                                const isHot =
                                                    hovered?.lane === laneIndex && hovered.phase === phaseIndex;
                                                const handoff = SEASON_HANDOFFS.some(
                                                    ([from, to, p]) =>
                                                        p === phaseIndex &&
                                                        (from === laneIndex || to === laneIndex),
                                                );

                                                return (
                                                    <div
                                                        key={`${lane}-${phase}`}
                                                        className={`sector_steps_cell${cell ? " has-block" : ""}${isActive ? " is-active" : ""}${handoff ? " is-handoff" : ""}`}
                                                        role="cell"
                                                        data-phase={phaseIndex}
                                                        onPointerEnter={() =>
                                                            cell &&
                                                            setHovered({
                                                                lane: laneIndex,
                                                                phase: phaseIndex,
                                                            })
                                                        }
                                                        onPointerLeave={() => setHovered(null)}
                                                    >
                                                        {cell ? (
                                                            <div
                                                                className={`sector_steps_block${isHot || isActive ? " is-lit" : ""}`}
                                                            >
                                                                <span
                                                                    className="sector_steps_block_dot"
                                                                    aria-hidden="true"
                                                                />
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
            </div>

            <div className="col-lg-4">
                <div className="sector_steps_panel sector_steps_panel_ai">
                    <header className="sector_steps_copy">
                        <h2 className="sector_steps_eyebrow">
                            <span className="sector_steps_dot" aria-hidden="true" />
                            <span>{practicalAi.eyebrow}</span>
                        </h2>
                        <p className="sector_steps_description">{practicalAi.description}</p>
                        <p className="sector_steps_live" aria-live="polite">
                            <span>{practicalAi.status}</span>
                            <strong>{practicalAi.steps[activeAi]?.meta}</strong>
                        </p>
                    </header>

                    <div className="practical_ai_lane" ref={aiLaneRef}>
                        {practicalAi.steps.map((step, index) => {
                            const isActive = index === activeAi;
                            return (
                                <article
                                    key={`${step.meta}-${step.title}`}
                                    className={`practical_ai_card${isActive ? " is-active" : ""}`}
                                    data-pai-card={index}
                                >
                                    <div className="practical_ai_card_top">
                                        <span className="practical_ai_meta">{step.meta}</span>
                                        <span className="practical_ai_status">{step.status}</span>
                                    </div>
                                    <h3 className="practical_ai_title">{step.title}</h3>
                                    <p className="practical_ai_text">{step.text}</p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    const rootClass = `sector_steps${embedded ? " is-embedded" : ""}`;

    if (embedded) {
        return (
            <div className={rootClass} ref={sectionRef} id="sector" data-sector-steps>
                {content}
            </div>
        );
    }

    return (
        <section className={rootClass} ref={sectionRef} id="sector" data-sector-steps>
            <div className="container">{content}</div>
        </section>
    );
}
