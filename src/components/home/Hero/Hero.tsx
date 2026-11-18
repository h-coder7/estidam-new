import { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { getHeroContent } from "@/lib/api/home";
import { Link } from "@/i18n/routing";

import HeroHalftone from "./HeroHalftone";
import HeroTitle from "./HeroTitle";

import "./_Hero.scss";

function HeroLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
    if (/^https?:\/\//i.test(href) || href.startsWith("#")) {
        return (
            <a href={href} className={className}>
                {children}
            </a>
        );
    }

    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}

const Hero = async () => {
    const locale = await getLocale();
    const t = await getTranslations("hero");
    const hero = await getHeroContent(locale);

    const eyebrow = hero?.eyebrow || t("eyebrow");
    const title = hero?.title || t("title");
    const titleAccent = hero ? hero.titleAccent : t("titleAccent");
    const description = hero?.description || t("description");
    const primaryCta = hero?.primaryCta || t("primaryCta");
    const secondaryCta = hero?.secondaryCta || t("secondaryCta");
    const primaryUrl = hero?.primaryUrl || "#";
    const secondaryUrl = hero?.secondaryUrl || "#why-estidam";

    return (
        <section className="hero_section" data-hero>
            <HeroHalftone />

            <div className="container hero_inner">
                <div className="hero_copy">
                    <p className="hero_pill hero_in" style={{ animationDelay: "0ms" }}>
                        <i className="fa-regular fa-kaaba" aria-hidden="true" />
                        <span>{eyebrow}</span>
                    </p>

                    <HeroTitle title={title} titleAccent={titleAccent} />

                    <p className="hero_description hero_fade" style={{ animationDelay: "780ms" }}>
                        {description}
                    </p>

                    <div className="hero_actions hero_in" style={{ animationDelay: "920ms" }}>
                        <HeroLink href={primaryUrl} className="butn hero_btn hero_btn--primary">
                            <span>{primaryCta}</span>
                            <img src="/images/icons/arrow-wh.svg" alt="" className="butn-icon" aria-hidden="true" />
                        </HeroLink>
                        <HeroLink href={secondaryUrl} className="butn hero_btn hero_btn--ghost">
                            <span>{secondaryCta}</span>
                            <img src="/images/icons/arrow-bl.svg" alt="" className="butn-icon" aria-hidden="true" />
                        </HeroLink>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default Hero;
