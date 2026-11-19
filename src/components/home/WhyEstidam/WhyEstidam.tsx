import { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import Reveal from "@/components/animations/Reveal";
import { getWhyContent } from "@/lib/api/home";
import { Link } from "@/i18n/routing";

import SectorSteps from "@/components/home/SectorSteps/SectorSteps";
import OperationsSteps from "@/components/home/OperationsSteps/OperationsSteps";

import "./_WhyEstidam.scss";

function CmsLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
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

const WhyEstidam = async () => {
    const locale = await getLocale();
    const t = await getTranslations("whyEstidam");
    const why = await getWhyContent(locale);

    const badge = why?.eyebrow || t("badge");
    const titleStrong = why?.titleStrong || t("titleStrong");
    const titleMuted = why ? why.titleMuted : t("titleMuted");
    const description = why?.description || t("description");
    const cta = why?.cta || t("cta");
    const ctaUrl = why?.ctaUrl || "#";

    return (
        <section className="why_estidam border-bottom" id="why-estidam">
            <div className="container">
                <div className="content px-lg-4">
                    <div className="section-head pb-0">
                        <Reveal animation="fade-up" trigger="load">
                            <span className="section-head-badge">{badge}</span>
                        </Reveal>

                        <div className="row gx-0 justify-content-between">
                            <div className="col-lg-6">
                                <div className="section-head-left mt-3">
                                    <Reveal animation="fade-up" trigger="load">
                                        <h2 className="section-head-title fsz-40 fw-600 lh-2">
                                            <span className="section-head-title-strong">{titleStrong}</span>
                                            {titleMuted ? (
                                                <>
                                                    {" "}
                                                    <span className="section-head-title-muted cr-blue fw-500">{titleMuted}</span>
                                                </>
                                            ) : null}
                                        </h2>
                                    </Reveal>
                                </div>
                            </div>
                            <div className="col-lg-5">
                                <div className="section-head-right mt-3">
                                    <Reveal animation="fade-up" trigger="load">
                                        <p className="section-head-description">{description}</p>
                                    </Reveal>

                                    <Reveal animation="fade-up" trigger="load">
                                        <CmsLink href={ctaUrl} className="butn butn-outline">
                                            <span>{cta}</span>
                                            <img
                                                src="/images/icons/arrow-bl.svg"
                                                alt=""
                                                className="butn-icon"
                                                aria-hidden="true"
                                            />
                                        </CmsLink>
                                    </Reveal>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="why_estidam_panels">
                        <SectorSteps embedded />
                        <OperationsSteps embedded />
                    </div>
                </div>
            </div>

            <div className="sec-lines">
                <span></span>
                <span></span>
            </div>
        </section>
    );
};

export default WhyEstidam;
