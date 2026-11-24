"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, EffectCreative, Keyboard, Mousewheel } from "swiper/modules";
import { useLenis } from "@/components/LenisProvider";
import { Link } from "@/i18n/routing";
import type { CatalogProduct } from "@/lib/api/home";
import { PRODUCTS_CASCADE_CONFIG as CONFIG } from "./productsCascadeConfig";
import ProductCardFace from "./ProductCardFace";

import "swiper/css";
import "swiper/css/effect-creative";

type Props = {
    cards?: CatalogProduct[];
    badge: string;
    titleStrong: string;
    titleMuted: string;
    description: string;
    cta: string;
    ctaHref: string;
};

export default function ProductsStage({
    cards,
    badge,
    titleStrong,
    titleMuted,
    description,
    cta,
    ctaHref,
}: Props) {
    const t = useTranslations("products");
    const locale = useLocale();
    const isAr = locale === "ar";
    const lenis = useLenis();

    const viewCards: CatalogProduct[] = useMemo(
        () =>
            cards?.length
                ? cards
                : CONFIG.cards.map((card) => ({
                      id: card.id,
                      img: card.img,
                      status: t(card.statusKey),
                      statusTone: card.statusTone,
                      title: t(card.titleKey),
                      tagline: t(card.taglineKey),
                      logo: card.logo,
                      problemLabel: t(card.problemLabelKey),
                      problem: t(card.problemKey),
                      usersLabel: t(card.usersLabelKey),
                      users: t(card.usersKey),
                  })),
        [cards, t],
    );

    const n = viewCards.length;
    const cardsKey = viewCards.map((c) => c.id).join("|");
    const swiperRef = useRef<SwiperInstance | null>(null);
    const deckRef = useRef<HTMLDivElement>(null);
    const wheelLock = useRef(false);
    const [active, setActive] = useState(0);
    const [progress, setProgress] = useState(n > 0 ? 1 / n : 1);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const apply = () => setReduced(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    useEffect(() => {
        setActive(0);
        setProgress(n > 0 ? 1 / n : 1);
    }, [n, cardsKey]);

    // Wheel drives slides only while there is a next/prev card; page scroll stays free at edges
    useEffect(() => {
        const deck = deckRef.current;
        if (!deck || reduced) return;

        let resumeTimer = 0;

        const resumeLenis = () => {
            window.clearTimeout(resumeTimer);
            lenis?.start();
        };

        const onLeave = () => {
            wheelLock.current = false;
            resumeLenis();
        };

        const onWheel = (e: WheelEvent) => {
            const swiper = swiperRef.current;
            if (!swiper || wheelLock.current) return;

            const dy = e.deltaY;
            if (Math.abs(dy) < 10) return;

            const goingNext = dy > 0;
            // At edges: keep Lenis running so the page can scroll while still hovering
            if (goingNext && swiper.isEnd) {
                resumeLenis();
                return;
            }
            if (!goingNext && swiper.isBeginning) {
                resumeLenis();
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            wheelLock.current = true;
            lenis?.stop();

            if (goingNext) swiper.slideNext();
            else swiper.slidePrev();

            const speed = Number(swiper.params.speed) || 820;
            window.clearTimeout(resumeTimer);
            resumeTimer = window.setTimeout(() => {
                wheelLock.current = false;
                resumeLenis();
            }, speed + 40);
        };

        deck.addEventListener("pointerleave", onLeave);
        deck.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            window.clearTimeout(resumeTimer);
            deck.removeEventListener("pointerleave", onLeave);
            deck.removeEventListener("wheel", onWheel);
            lenis?.start();
        };
    }, [lenis, reduced, cardsKey]);

    const goTo = (index: number) => {
        swiperRef.current?.slideTo(index);
    };

    const sync = (swiper: SwiperInstance) => {
        const i = swiper.activeIndex;
        setActive(i);
        setProgress(n > 0 ? (i + 1) / n : 1);
        // Never leave page scroll locked after the last/first slide
        if (swiper.isBeginning || swiper.isEnd) lenis?.start();
    };

    const onSwiper = (swiper: SwiperInstance) => {
        swiperRef.current = swiper;
        sync(swiper);
    };

    const rotateDir = isAr ? -1 : 1;

    return (
        <section
            className="products products_stage_section"
            id="products"
            aria-label={isAr ? "المنتجات" : "Products"}
        >
            <div className="products_stage_inner">
                <div className="container">
                    <div className="section-head products_stage_head pb-0">
                        <span className="section-head-badge">{badge}</span>
                        <div className="row gx-0 justify-content-between">
                            <div className="col-lg-6">
                                <div className="section-head-left mt-3">
                                    <h2 className="section-head-title fsz-40 fw-600 lh-2">
                                        <span className="section-head-title-strong">{titleStrong}</span>
                                        {titleMuted ? (
                                            <>
                                                {" "}
                                                <span className="section-head-title-muted cr-blue fw-500">
                                                    {titleMuted}
                                                </span>
                                            </>
                                        ) : null}
                                    </h2>
                                </div>
                            </div>
                            <div className="col-lg-5">
                                <div className="section-head-right mt-3">
                                    <p className="section-head-description">{description}</p>
                                    {/^https?:\/\//i.test(ctaHref) || ctaHref.startsWith("#") ? (
                                        <a href={ctaHref} className="butn butn-outline products_stage_cta">
                                            <span>{cta}</span>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src="/images/icons/arrow-bl.svg"
                                                alt=""
                                                className="butn-icon"
                                                aria-hidden="true"
                                            />
                                        </a>
                                    ) : (
                                        <Link href={ctaHref} className="butn butn-outline products_stage_cta">
                                            <span>{cta}</span>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src="/images/icons/arrow-bl.svg"
                                                alt=""
                                                className="butn-icon"
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="products_stage_theater">
                        <div className="products_stage_deck" ref={deckRef}>
                            <Swiper
                                className={`products_stage_swiper${reduced ? " is_reduced" : ""}`}
                                modules={[EffectCreative, Keyboard, Mousewheel, A11y]}
                                effect="creative"
                                creativeEffect={{
                                    limitProgress: 1,
                                    perspective: true,
                                    shadowPerProgress: false,
                                    prev: {
                                        translate: [0, -56, -220],
                                        rotate: [12, 0, -6 * rotateDir],
                                        scale: 0.86,
                                        opacity: 0,
                                    },
                                    next: {
                                        translate: [0, 72, -220],
                                        rotate: [-14, 0, 6 * rotateDir],
                                        scale: 0.86,
                                        opacity: 0,
                                    },
                                }}
                                speed={reduced ? 0 : 820}
                                grabCursor
                                watchOverflow
                                keyboard={{ enabled: true }}
                                mousewheel={{
                                    forceToAxis: true,
                                    sensitivity: 1,
                                    releaseOnEdges: true,
                                    thresholdDelta: 18,
                                    thresholdTime: 320,
                                }}
                                dir={isAr ? "rtl" : "ltr"}
                                key={isAr ? "ar" : "en"}
                                onSwiper={onSwiper}
                                onSlideChange={sync}
                                a11y={{
                                    enabled: true,
                                    prevSlideMessage: isAr ? "المنتج السابق" : "Previous product",
                                    nextSlideMessage: isAr ? "المنتج التالي" : "Next product",
                                }}
                            >
                                {viewCards.map((card) => (
                                    <SwiperSlide key={card.id}>
                                        <article className="products_stage_card">
                                            <ProductCardFace card={card} />
                                        </article>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                        </div>

                        <aside className="products_stage_rail" aria-label={t("railLabel")}>
                            <div className="products_stage_counter">
                                <span className="products_stage_counter_n">
                                    {String(active + 1).padStart(2, "0")}
                                </span>
                                <span className="products_stage_counter_sep">/</span>
                                <span className="products_stage_counter_tot">
                                    {String(n).padStart(2, "0")}
                                </span>
                            </div>

                            <div className="products_stage_progress" aria-hidden="true">
                                <div
                                    className="products_stage_progress_bar"
                                    style={{ transform: `scaleX(${progress})` }}
                                />
                            </div>

                            <div className="products_stage_ticks" role="tablist">
                                {viewCards.map((card, i) => (
                                    <button
                                        key={card.id}
                                        type="button"
                                        className={`products_stage_tick${i === active ? " is_active" : ""}`}
                                        role="tab"
                                        aria-pressed={i === active ? "true" : "false"}
                                        aria-label={card.title}
                                        onClick={() => goTo(i)}
                                    >
                                        <span className="products_stage_tick_i">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span className="products_stage_tick_t">{card.title}</span>
                                    </button>
                                ))}
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </section>
    );
}
