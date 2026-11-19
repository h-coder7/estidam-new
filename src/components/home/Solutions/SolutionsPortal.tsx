"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { getLenis } from "@/components/LenisProvider";
import type { SolutionCubeSlide } from "@/lib/api/home";
import { Link } from "@/i18n/routing";
import { createSolutionsPortalScene, type PortalSceneApi } from "./solutionsPortalScene";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger, SplitText);
}

type Props = {
    slides: SolutionCubeSlide[];
    badge: string;
    titleStrong: string;
    titleMuted: string;
};

const DESKTOP_QUERY = "(min-width: 992px) and (prefers-reduced-motion: no-preference)";

function capitalizeWords(text: string) {
    return text.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, lead: string, char: string) => lead + char.toUpperCase());
}

export default function SolutionsPortal({ slides, badge, titleStrong, titleMuted }: Props) {
    const t = useTranslations("solutions");
    const tIndex = useTranslations("solutionsIndex");
    const locale = useLocale();
    const byWords = locale === "ar";

    const sectionRef = useRef<HTMLElement>(null);
    const pinRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const finaleRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<PortalSceneApi | null>(null);
    const [staticMode, setStaticMode] = useState(false);

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
    const mainTitle = byWords ? titleStrong : capitalizeWords(titleStrong);
    const accentTitle = titleMuted ? (byWords ? titleMuted : capitalizeWords(titleMuted)) : "";

    // Intro title — video-style line masks + Hero blur units
    useLayoutEffect(() => {
        const el = titleRef.current;
        const section = sectionRef.current;
        if (!el || !section) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            el.classList.add("is-ready");
            return;
        }

        let split: SplitText | null = null;
        let tween: gsap.core.Tween | null = null;
        let st: ScrollTrigger | null = null;
        let cancelled = false;

        const arm = () => {
            if (cancelled || !titleRef.current) return;

            split = SplitText.create(titleRef.current, {
                type: byWords ? "words,lines" : "chars,words,lines",
                tag: "span",
                charsClass: "sp_char",
                wordsClass: "sp_word",
                linesClass: "sp_line",
                aria: "auto",
                smartWrap: true,
            });

            const units = byWords ? split.words : split.chars;
            if (!units.length) {
                split.revert();
                split = null;
                titleRef.current.classList.add("is-ready");
                return;
            }

            gsap.set(units, {
                opacity: 0,
                yPercent: 110,
                filter: "blur(16px)",
                scale: 1.04,
                transformOrigin: "50% 100%",
            });
            titleRef.current.classList.add("is-ready");

            const play = () => {
                tween?.kill();
                tween = gsap.to(units, {
                    opacity: 1,
                    yPercent: 0,
                    filter: "blur(0px)",
                    scale: 1,
                    duration: byWords ? 1.05 : 0.95,
                    stagger: byWords ? 0.08 : 0.028,
                    ease: "expo.out",
                    force3D: true,
                });
            };

            st = ScrollTrigger.create({
                trigger: section,
                start: "top 78%",
                once: true,
                onEnter: play,
            });

            if (section.getBoundingClientRect().top < window.innerHeight * 0.78) play();
        };

        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(arm);

        return () => {
            cancelled = true;
            tween?.kill();
            st?.kill();
            split?.revert();
        };
    }, [mainTitle, accentTitle, byWords]);

    // Scroll-pinned portal journey (matches video phases)
    useEffect(() => {
        const section = sectionRef.current;
        const pin = pinRef.current;
        const canvas = canvasRef.current;
        const finale = finaleRef.current;
        if (!section || !pin || !canvas || !finale || !view.length) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const mm = gsap.matchMedia();

        mm.add(DESKTOP_QUERY, () => {
            setStaticMode(false);
            pin.classList.remove("is-static");

            const scene = createSolutionsPortalScene(
                canvas,
                view.map((s) => ({
                    id: s.id,
                    title: s.titleStrong || s.title,
                    subtitle: s.titleMuted || s.highlight || "",
                })),
            );
            sceneRef.current = scene;

            gsap.set(finale, { autoAlpha: 0, y: 28 });
            gsap.set(pin.querySelector(".sp_intro"), { autoAlpha: 1 });

            const state = { p: 0 };
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: pin,
                    start: "top top",
                    end: "+=3800",
                    pin: true,
                    scrub: 0.55,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    onUpdate: (self) => scene.setProgress(self.progress),
                },
            });

            tl.to(state, { p: 1, duration: 1, ease: "none" }, 0)
                .to(pin.querySelector(".sp_intro"), { autoAlpha: 0, y: -48, duration: 0.14, ease: "none" }, 0.14)
                .to(finale, { autoAlpha: 1, y: 0, duration: 0.16, ease: "none" }, 0.72);

            const lenis = getLenis();
            const onLenis = () => ScrollTrigger.update();
            lenis?.on("scroll", onLenis);

            const onResize = () => {
                scene.resize();
                ScrollTrigger.refresh();
            };
            window.addEventListener("resize", onResize);

            return () => {
                lenis?.off("scroll", onLenis);
                window.removeEventListener("resize", onResize);
                tl.scrollTrigger?.kill();
                tl.kill();
                scene.destroy();
                sceneRef.current = null;
                gsap.set([finale, pin.querySelector(".sp_intro")], { clearProps: "all" });
            };
        });

        mm.add("(max-width: 991.98px), (prefers-reduced-motion: reduce)", () => {
            setStaticMode(true);
            pin.classList.add("is-static");
            if (reduced) return;
        });

        return () => mm.revert();
    }, [view]);

    return (
        <section className="solutions_portal" ref={sectionRef} id="solutions" aria-labelledby="solutions-title">
            <div className="sp_pin" ref={pinRef}>
                <div className="sp_stage" aria-hidden={staticMode}>
                    <canvas className="sp_canvas" ref={canvasRef} />
                </div>

                <div className="sp_intro">
                    <div className="container">
                        <p className="sp_badge">{badge}</p>
                        <h2
                            id="solutions-title"
                            className={`sp_title${byWords ? " sp_title--words" : ""}`}
                            ref={titleRef}
                        >
                            <span className="sp_title_main">{mainTitle}</span>
                            {accentTitle ? <span className="sp_title_accent">{accentTitle}</span> : null}
                        </h2>
                    </div>
                </div>

                <div className="sp_finale" ref={finaleRef}>
                    <div className="container sp_finale_inner">
                        <p className="sp_finale_badge">{badge}</p>
                        <h3 className="sp_finale_title">
                            <span>{mainTitle}</span>
                            {accentTitle ? <span> {accentTitle}</span> : null}
                        </h3>
                        <p className="sp_finale_text">{t("description")}</p>
                        <div className="sp_finale_actions">
                            <Link className="sp_cta" href="/solutions">
                                {tIndex("primaryCta")}
                            </Link>
                            <Link className="sp_cta sp_cta--ghost" href="/contact">
                                {tIndex("secondaryCta")}
                            </Link>
                        </div>
                    </div>
                </div>

                {staticMode ? (
                    <div className="sp_static container">
                        <p className="sp_badge">{badge}</p>
                        <h2 className="sp_static_title">
                            {mainTitle}
                            {accentTitle ? <span> {accentTitle}</span> : null}
                        </h2>
                        <p className="sp_static_text">{t("description")}</p>
                        <div className="sp_static_grid">
                            {view.map((slide, index) => {
                                const href = slide.slug ? `/solutions/${slide.slug}` : "/solutions";
                                return (
                                    <article key={slide.id} className="sp_static_card">
                                        <span className="sp_static_index">{String(index + 1).padStart(2, "0")}</span>
                                        <h3>
                                            {slide.titleStrong}
                                            {slide.titleMuted ? ` ${slide.titleMuted}` : ""}
                                        </h3>
                                        <p>{slide.text}</p>
                                        <Link href={href}>{t("itemLabel")}</Link>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
