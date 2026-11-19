"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Link } from "@/i18n/routing";
import type { SolutionCubeSlide } from "@/lib/api/home";
import { createSolutionsCurveReel, reelImageSrc, type ReelApi } from "./solutionsCurveReel";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger, SplitText);
}

type Props = {
    slides: SolutionCubeSlide[];
    badge: string;
    titleStrong: string;
    titleMuted: string;
    description: string;
};

function capitalizeWords(text: string) {
    return text.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, lead: string, char: string) => lead + char.toUpperCase());
}

const LABEL_FALLBACK = [
    { num: "01", name: "Process design" },
    { num: "02", name: "Seasonal readiness" },
    { num: "03", name: "Journey systems" },
    { num: "04", name: "Delivery & ops" },
];

export default function SolutionsCurveReel({
    slides,
    badge,
    titleStrong,
    titleMuted,
    description,
}: Props) {
    const t = useTranslations("solutions");
    const tIndex = useTranslations("solutionsIndex");
    const locale = useLocale();
    const byWords = locale === "ar";

    const sectionRef = useRef<HTMLElement>(null);
    const headRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const bandRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const linkWrapRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const reelRef = useRef<ReelApi | null>(null);

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

    const labels = useMemo(() => {
        if (view.length >= 4) {
            return view.slice(0, 4).map((s, i) => ({
                num: String(i + 1).padStart(2, "0"),
                name: s.titleStrong || s.title.split(/\s+/).slice(0, 2).join(" ") || LABEL_FALLBACK[i].name,
            }));
        }
        return LABEL_FALLBACK;
    }, [view]);

    // Title reveal — Hero-style SplitText
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
                charsClass: "sr_char",
                wordsClass: "sr_word",
                linesClass: "sr_line",
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
                filter: "blur(14px)",
                scale: 1.03,
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
                    duration: byWords ? 1.05 : 0.92,
                    stagger: byWords ? 0.075 : 0.026,
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

    // Head fade / rise + reel engine
    useEffect(() => {
        const section = sectionRef.current;
        const head = headRef.current;
        const band = bandRef.current;
        const canvas = canvasRef.current;
        const link = linkWrapRef.current?.querySelector<HTMLAnchorElement>("a.sr_link") ?? null;
        const cursor = cursorRef.current;
        if (!section || !head || !band || !canvas || !view.length) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        const reducedMotion = reduced;
        let reveal: gsap.core.Tween | null = null;
        let io: IntersectionObserver | null = null;
        if (!reducedMotion) {
            gsap.set(head, { opacity: 0, y: 22 });
            reveal = gsap.to(head, {
                opacity: 1,
                y: 0,
                duration: 0.95,
                ease: "power3.out",
                paused: true,
            });
            io = new IntersectionObserver(
                (entries) => {
                    if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.08)) {
                        reveal?.play();
                        io?.disconnect();
                    }
                },
                { threshold: [0.08, 0.5, 0.9] },
            );
            io.observe(head);
            // If already on screen (hash / restore), play immediately
            if (head.getBoundingClientRect().top < window.innerHeight * 0.92) reveal.play();
        }

        const reel = createSolutionsCurveReel(
            canvas,
            band,
            view.map((s) => ({
                id: s.id,
                label: t("itemLabel"),
                title: s.title || `${s.titleStrong} ${s.titleMuted}`.trim(),
                text: s.text || undefined,
                highlight: s.highlight || undefined,
                // Proxy CMS storage so WebGL textures stay same-origin (Journey used plain <img>)
                image: reelImageSrc(s.image) || undefined,
            })),
        );
        reelRef.current = reel;

        // Magnetic CTA + disc grow + arrow swap
        const cleanups: Array<() => void> = [];
        if (!reduced && link && fine) {
            const disc = link.querySelector<HTMLElement>(".sr_disc");
            const arrows = link.querySelectorAll<SVGElement>(".sr_arrow");
            if (disc && arrows.length >= 2) {
                arrows[1].style.visibility = "visible";
                gsap.set(arrows[1], { xPercent: -100 });

                let hoverOn = false;
                let focusOn = false;
                let active = false;
                let arrowTimer = 0;
                const mag = { x: 0, y: 0, ix: 0, iy: 0, s: 1 };

                const paint = () => {
                    link.style.transform =
                        mag.x || mag.y ? `translate3d(${mag.x.toFixed(2)}px, ${mag.y.toFixed(2)}px, 0)` : "";
                    disc.style.transform = `translate3d(${mag.ix.toFixed(2)}px, ${mag.iy.toFixed(2)}px, 0) scale(${mag.s.toFixed(4)})`;
                };

                const setActive = (on: boolean) => {
                    if (on === active) return;
                    active = on;
                    gsap.to(mag, { s: on ? 1.12 : 1, duration: 0.45, ease: "power3.out", onUpdate: paint });
                    clearTimeout(arrowTimer);
                    if (on) {
                        gsap.to(arrows[0], { xPercent: 100, duration: 0.4, ease: "power3.out" });
                        arrowTimer = window.setTimeout(() => {
                            gsap.fromTo(
                                arrows[1],
                                { xPercent: -100 },
                                { xPercent: 0, duration: 0.4, ease: "power3.out" },
                            );
                        }, 60);
                    } else {
                        gsap.to(arrows[1], { xPercent: -100, duration: 0.35, ease: "power3.inOut" });
                        arrowTimer = window.setTimeout(() => {
                            gsap.to(arrows[0], { xPercent: 0, duration: 0.35, ease: "power3.inOut" });
                        }, 60);
                    }
                };

                const onEnter = (e: PointerEvent) => {
                    if (e.pointerType === "mouse") {
                        hoverOn = true;
                        setActive(true);
                    }
                };
                const onLeave = () => {
                    hoverOn = false;
                    setActive(focusOn);
                };
                const onFocus = () => {
                    if (link.matches(":focus-visible")) {
                        focusOn = true;
                        setActive(true);
                    }
                };
                const onBlur = () => {
                    focusOn = false;
                    setActive(hoverOn);
                };

                link.addEventListener("pointerenter", onEnter);
                link.addEventListener("pointerleave", onLeave);
                link.addEventListener("focus", onFocus);
                link.addEventListener("blur", onBlur);

                let pulling = false;
                const onMagnet = (e: PointerEvent) => {
                    if (e.pointerType !== "mouse") return;
                    const r = link.getBoundingClientRect();
                    const cx = r.left - mag.x + r.width / 2;
                    const cy = r.top - mag.y + r.height / 2;
                    const dx = e.clientX - cx;
                    const dy = e.clientY - cy;
                    const inside = Math.abs(dx) <= r.width / 2 + 24 && Math.abs(dy) <= r.height / 2 + 24;
                    if (inside) {
                        pulling = true;
                        mag.x = Math.max(-12, Math.min(12, dx * 0.25));
                        mag.y = Math.max(-12, Math.min(12, dy * 0.25));
                        mag.ix = Math.max(-12, Math.min(12, dx * 0.1));
                        mag.iy = Math.max(-12, Math.min(12, dy * 0.1));
                        paint();
                    } else if (pulling) {
                        pulling = false;
                        gsap.to(mag, {
                            x: 0,
                            y: 0,
                            ix: 0,
                            iy: 0,
                            duration: 0.55,
                            ease: "power3.out",
                            onUpdate: paint,
                        });
                    }
                };
                window.addEventListener("pointermove", onMagnet, { passive: true });

                cleanups.push(() => {
                    clearTimeout(arrowTimer);
                    link.removeEventListener("pointerenter", onEnter);
                    link.removeEventListener("pointerleave", onLeave);
                    link.removeEventListener("focus", onFocus);
                    link.removeEventListener("blur", onBlur);
                    window.removeEventListener("pointermove", onMagnet);
                    link.style.transform = "";
                    disc.style.transform = "";
                });
            }
        }

        // Custom "View" cursor over band
        if (!reduced && fine && cursor) {
            cursor.hidden = false;
            const cur = { x: 0, y: 0, s: 0 };
            const paintCur = () => {
                cursor.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0) scale(${Math.max(0, cur.s).toFixed(4)})`;
            };
            let shown = false;
            const show = (on: boolean) => {
                if (on === shown) return;
                shown = on;
                gsap.to(cur, {
                    s: on ? 1 : 0,
                    duration: 0.35,
                    ease: "power3.out",
                    onUpdate: paintCur,
                });
                band.style.cursor = on ? "none" : "";
            };

            const onBandMove = (e: PointerEvent) => {
                if (e.pointerType !== "mouse") return;
                const r = band.getBoundingClientRect();
                cur.x = e.clientX - r.left;
                cur.y = e.clientY - r.top;
                paintCur();
                const hit = Number(band.dataset.hoverSlot ?? -1);
                show(hit >= 0);
            };
            const onBandLeave = () => show(false);
            band.addEventListener("pointermove", onBandMove);
            band.addEventListener("pointerleave", onBandLeave);
            cleanups.push(() => {
                band.removeEventListener("pointermove", onBandMove);
                band.removeEventListener("pointerleave", onBandLeave);
                band.style.cursor = "";
                cursor.hidden = true;
            });
        }

        // Soft label stagger
        const labelEls = section.querySelectorAll(".sr_label");
        if (!reduced && labelEls.length) {
            gsap.fromTo(
                labelEls,
                { opacity: 0, y: 18 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    stagger: 0.08,
                    ease: "power3.out",
                    scrollTrigger: { trigger: section, start: "top 70%", once: true },
                },
            );
        }

        return () => {
            io?.disconnect();
            reveal?.kill();
            reel.destroy();
            reelRef.current = null;
            cleanups.forEach((fn) => fn());
        };
    }, [view, t]);

    return (
        <section
            className="solutions_reel"
            ref={sectionRef}
            id="solutions"
            aria-labelledby="solutions-title"
        >
            <div className="sr_glow" aria-hidden="true" />

            <div className="sr_wrap">
                <div className="sr_head" ref={headRef}>
                    <p className="sr_eyebrow">{badge}</p>
                    <h2
                        id="solutions-title"
                        className={`sr_title${byWords ? " sr_title--words" : ""}`}
                        ref={titleRef}
                    >
                        <span className="sr_title_main">{mainTitle}</span>
                        {accentTitle ? <span className="sr_title_accent">{accentTitle}</span> : null}
                    </h2>
                    <p className="sr_sub">{description}</p>
                    <div ref={linkWrapRef}>
                        <Link className="sr_link" href="/solutions">
                            <span className="sr_link_text">{tIndex("primaryCta")}</span>
                            <span className="sr_disc" aria-hidden="true">
                                <svg className="sr_arrow" viewBox="0 0 32 32" fill="none" focusable="false">
                                    <path
                                        d="M11 16H21M17 20L21 16L17 12"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <svg className="sr_arrow" viewBox="0 0 32 32" fill="none" focusable="false">
                                    <path
                                        d="M11 16H21M17 20L21 16L17 12"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="sr_band" ref={bandRef}>
                <canvas ref={canvasRef} aria-hidden="true" />
                <div className="sr_blur sr_blur--l" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                </div>
                <div className="sr_blur sr_blur--r" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                </div>
                <div className="sr_cursor" ref={cursorRef} aria-hidden="true" hidden>
                    <span className="sr_cursor_label">{t("itemLabel")}</span>
                </div>
                <ul className="sr_sr" aria-label={t("dotsLabel")}>
                    {view.map((slide) => {
                        const alt =
                            `${slide.titleStrong}${slide.titleMuted ? ` ${slide.titleMuted}` : ""}`.trim() ||
                            slide.title;
                        return (
                            <li key={slide.id}>
                                {slide.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={reelImageSrc(slide.image) || slide.image} alt={alt} />
                                ) : (
                                    <span>{alt}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="sr_wrap">
                <ul className="sr_labels">
                    {labels.map((label) => (
                        <li className="sr_label" key={label.num}>
                            <span className="sr_num">
                                <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
                                    <path
                                        d="M1 6L11 6M7 2L11 6L7 10"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                {label.num}
                            </span>
                            <span className="sr_name">{label.name}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
