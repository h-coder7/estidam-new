"use client";

import { useLocale } from "next-intl";
import HeroNeonSignal from "./HeroNeonSignal";

/** Giant brand wordmark at the foot of the hero. Decorative only. */
export default function HeroBrandMark() {
    const locale = useLocale();
    const label = locale === "ar" ? "استدام" : "ESTIDAM";

    return (
        <div className="hero_brand_mark" aria-hidden="true">
            <div className="hero_brand_mark_word" data-locale={locale}>
                <HeroNeonSignal text={label} asWord={locale === "ar"} />
            </div>
        </div>
    );
}
