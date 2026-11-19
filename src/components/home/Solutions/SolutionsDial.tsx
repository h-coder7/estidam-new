"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SolutionCubeSlide } from "@/lib/api/home";
import { createSolutionsDial, reelImageSrc } from "./solutionsDial";

type Props = {
    slides: SolutionCubeSlide[];
    badge: string;
    titleStrong: string;
    titleMuted: string;
};

const TICK_KS = Array.from({ length: 145 }, (_, i) => i - 72);

function capitalizeWords(text: string) {
    return text.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, lead: string, char: string) => lead + char.toUpperCase());
}

export default function SolutionsDial({ slides, badge, titleStrong, titleMuted }: Props) {
    const t = useTranslations("solutions");
    const locale = useLocale();
    const rtl = locale === "ar";
    const rootRef = useRef<HTMLElement>(null);

    const fallback = useMemo(() => {
        const items = t.raw("items") as
            | Array<{ titleStrong?: string; titleMuted?: string; text?: string; highlight?: string }>
            | undefined;
        if (!Array.isArray(items)) return [] as SolutionCubeSlide[];
        return items.map((item, index) => ({
            id: `fallback-${index + 1}`,
            slug: "",
            title: `${item.titleStrong || ""} ${item.titleMuted || ""}`.trim(),
            titleStrong: item.titleStrong || "",
            titleMuted: item.titleMuted || "",
            text: item.text || "",
            highlight: item.highlight || "",
            image: "",
            showOnHome: true,
            showOnPage: true,
        }));
    }, [t]);

    const view = slides?.length ? slides : fallback;
    const N = view.length;
    const start = Math.min(2, Math.max(0, N - 1));
    const mainTitle = rtl ? titleStrong : capitalizeWords(titleStrong);
    const accentTitle = titleMuted ? (rtl ? titleMuted : capitalizeWords(titleMuted)) : "";

    useEffect(() => {
        const root = rootRef.current;
        if (!root || !N) return;
        const api = createSolutionsDial(root, {
            start,
            rtl,
            solutionWord: t("itemLabel"),
        });
        return () => api.destroy();
    }, [N, start, rtl, t, view]);

    if (!N) return null;

    const stepDeg = Math.max(10, Math.round(70 / Math.max(1, N - 1)));

    return (
        <section
            className="solutions_dial ed"
            id="solutions"
            ref={rootRef}
            aria-labelledby="solutions-title"
            data-rtl={rtl ? "1" : "0"}
            style={{ ["--step" as string]: stepDeg, ["--n" as string]: N }}
        >
            <div className="ed__wrap">
                <div className="dial" data-dial>
                    <div className="circ photo" aria-hidden="true">
                        {view.map((slide, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={slide.id}
                                data-i={i}
                                src={reelImageSrc(slide.image) || undefined}
                                alt=""
                                draggable={false}
                                className={i === start ? "is-on" : undefined}
                            />
                        ))}
                    </div>
                    <div className="circ rim" aria-hidden="true" />
                    <div className="circ band" aria-hidden="true" />
                    <div className="circ lane" aria-hidden="true" />
                    <div className="ring" data-ring>
                        {TICK_KS.map((k) => (
                            <i className="tick" style={{ ["--k" as string]: k }} key={`t${k}`} />
                        ))}
                        {view.map((_, i) => (
                            <i className="etick" style={{ ["--i" as string]: i }} key={`e${i}`} />
                        ))}
                        {view.map((slide, i) => (
                            <button
                                key={`l${slide.id}`}
                                type="button"
                                className={`label${i === start ? " is-here" : ""}`}
                                style={{ ["--i" as string]: i }}
                                data-go={i}
                                aria-label={`${t("itemLabel")} ${String(i + 1).padStart(2, "0")}`}
                                tabIndex={i === start ? -1 : 0}
                            >
                                {String(i + 1).padStart(2, "0")}
                            </button>
                        ))}
                    </div>
                    <i className="axis" aria-hidden="true" />
                    <div
                        className="knob"
                        role="slider"
                        tabIndex={0}
                        aria-label={t("itemLabel")}
                        aria-valuemin={1}
                        aria-valuemax={N}
                        aria-valuenow={start + 1}
                        data-knob
                    >
                        <span className="knob__in">
                            <svg className="v" viewBox="0 0 12 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M0 6L6 0L12 6" />
                                <path d="M0 18L6 24L12 18" />
                            </svg>
                            <svg className="h" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M6 0L0 6L6 12" />
                                <path d="M18 0L24 6L18 12" />
                            </svg>
                        </span>
                    </div>
                </div>

                <header className="head">
                    <p className="badge">{badge}</p>
                    <h2 className="h2" id="solutions-title">
                        <span className="h2__main">{mainTitle}</span>
                        {accentTitle ? <span className="h2__accent"> {accentTitle}</span> : null}
                    </h2>
                    <p className="meta mono stack" data-lines="meta">
                        {view.map((_, i) => (
                            <span key={`m${i}`} className={i === start ? "is-on" : undefined}>
                                {t("itemLabel")} {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
                            </span>
                        ))}
                    </p>
                </header>

                <div className="year" aria-hidden="true" data-year>
                    {[0, 1].map((j) => {
                        const digit = Number(String(start + 1).padStart(2, "0")[j] || 0);
                        return (
                            <span className="yr" key={`yr${j}`}>
                                <span className="yr__s" style={{ ["--d" as string]: digit }}>
                                    {Array.from({ length: 10 }, (_, d) => (
                                        <span key={d}>{d}</span>
                                    ))}
                                </span>
                            </span>
                        );
                    })}
                </div>
                <p className="sr-only" aria-live="polite" data-live>
                    {String(start + 1).padStart(2, "0")}
                </p>

                <div className="story stack" data-story>
                    {view.map((slide, i) => {
                        const title =
                            slide.title || `${slide.titleStrong} ${slide.titleMuted}`.trim() || t("itemLabel");
                        return (
                            <article
                                className={`era${i === start ? " is-on" : ""}`}
                                data-year={String(i + 1).padStart(2, "0")}
                                key={slide.id}
                            >
                                <h3 className="h3">{title}</h3>
                                {slide.text ? <p className="body">{slide.text}</p> : null}
                                {slide.highlight ? (
                                    <dl className="stats">
                                        <div className="stat">
                                            <dd>{slide.highlight}</dd>
                                            <dt>{t("itemLabel")}</dt>
                                        </div>
                                    </dl>
                                ) : null}
                            </article>
                        );
                    })}
                </div>

                <div className="controls">
                    <div className="progress">
                        <span className="counter mono" data-counter>
                            {String(start + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
                        </span>
                        <div className="segs" role="group" aria-label={t("dotsLabel")}>
                            {view.map((slide, i) => (
                                <button
                                    key={`s${slide.id}`}
                                    type="button"
                                    className={`seg${i < start ? " is-past" : ""}${i === start ? " is-on" : ""}`}
                                    data-go={i}
                                    aria-label={`${t("itemLabel")} ${String(i + 1).padStart(2, "0")}`}
                                    aria-current={i === start ? "step" : undefined}
                                >
                                    <i>
                                        <b />
                                    </i>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="arrows">
                        <button type="button" className="arrow" data-step="-1" aria-label={t("prev")}>
                            <span className="arrow__clip">
                                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                    <path d="M11 6H1M1 6L5 2M1 6L5 10" />
                                </svg>
                            </span>
                        </button>
                        <button type="button" className="arrow" data-step="1" aria-label={t("next")}>
                            <span className="arrow__clip">
                                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                    <path d="M1 6H11M11 6L7 2M11 6L7 10" />
                                </svg>
                            </span>
                        </button>
                    </div>
                </div>

                <p className="caption mono stack" data-lines="caption">
                    {view.map((slide, i) => (
                        <span key={`c${slide.id}`} className={i === start ? "is-on" : undefined}>
                            Fig. {String(i + 1).padStart(2, "0")} · {slide.titleStrong || slide.title || t("itemLabel")}
                        </span>
                    ))}
                </p>
            </div>
        </section>
    );
}
