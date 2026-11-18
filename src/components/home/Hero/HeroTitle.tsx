"use client";

import { useLayoutEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

type HeroTitleProps = {
    title: string;
    titleAccent?: string | null;
};

/** CSS capitalize breaks with SplitText chars (each letter becomes a "word"). */
function capitalizeWords(text: string) {
    return text.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, lead: string, char: string) => lead + char.toUpperCase());
}

const HeroTitle = ({ title, titleAccent }: HeroTitleProps) => {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const locale = useLocale();
    const byWords = locale === "ar";
    const mainTitle = byWords ? title : capitalizeWords(title);
    const accentTitle = titleAccent ? (byWords ? titleAccent : capitalizeWords(titleAccent)) : titleAccent;

    useLayoutEffect(() => {
        const el = titleRef.current;
        if (!el) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            el.classList.add("is-ready");
            return;
        }

        let split: SplitText | null = null;
        let tween: gsap.core.Tween | null = null;
        let cancelled = false;

        const run = () => {
            if (cancelled || !titleRef.current) return;

            // Arabic keeps connected letters — animate whole words, not chars
            split = SplitText.create(titleRef.current, {
                type: byWords ? "words" : "chars,words",
                tag: "span",
                charsClass: "hero_char",
                wordsClass: "hero_word",
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

            // Keep units hidden first, then reveal the container (no flash of full title)
            gsap.set(units, {
                opacity: 0,
                y: 22,
                filter: "blur(16px)",
                scale: 1.04,
                transformOrigin: "50% 100%",
            });
            titleRef.current.classList.add("is-ready");

            tween = gsap.to(units, {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                scale: 1,
                duration: byWords ? 1.05 : 0.95,
                stagger: byWords ? 0.08 : 0.032,
                ease: "expo.out",
                delay: 0.35,
                force3D: true,
            });
        };

        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(run);

        return () => {
            cancelled = true;
            tween?.kill();
            split?.revert();
        };
    }, [mainTitle, accentTitle, byWords]);

    return (
        <h1 className={`hero_title${byWords ? " hero_title--words" : ""}`} ref={titleRef}>
            <span className="hero_title_line hero_title_main">{mainTitle}</span>
            {accentTitle ? <span className="hero_title_line hero_title_accent">{accentTitle}</span> : null}
        </h1>
    );
};

export default HeroTitle;
