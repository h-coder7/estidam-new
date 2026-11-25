import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import MediaCard from "@/components/media/MediaCard";
import { getHomepageMediaItems, toMediaCardData } from "@/lib/api/media";
import MediaHighlightsStage from "./MediaHighlightsStage";

import "./_MediaHighlights.scss";

/**
 * Homepage — Media Coverage.
 * Standard section-head above floating cards; scroll cascade via MediaHighlightsStage.
 */
const MediaHighlightsSection = async () => {
    const locale = await getLocale();
    const t = await getTranslations("mediaSection");
    const tc = await getTranslations("mediaCommon");
    const records = await getHomepageMediaItems();

    if (!records.length) return null;

    const items = records.map((item) => toMediaCardData(item, locale));
    const [lead, ...rest] = items;

    const labelsFor = (item: (typeof items)[number]) => ({
        readArticle: tc("readArticle"),
        opensNewTab: tc("opensNewTab"),
        category: tc(`categories.${item.category}`),
        language: item.isForeignLanguage ? tc(`sourceLanguage.${item.sourceLanguage}`) : null,
    });

    return (
        <section className="media_highlights border-top" id="media" aria-labelledby="media-highlights-title">
            <MediaHighlightsStage>
                <div className="container">
                    <div className="content px-lg-4">
                        <div className="section-head media_highlights_head">
                            <span className="section-head-badge">{t("badge")}</span>
                            <div className="row gx-0 justify-content-between align-items-end">
                                <div className="col-lg-6">
                                    <div className="section-head-left mt-3">
                                        <h2
                                            className="section-head-title fsz-40 fw-600 lh-2"
                                            id="media-highlights-title"
                                        >
                                            <span className="section-head-title-strong">{t("title")}</span>
                                        </h2>
                                    </div>
                                </div>
                                <div className="col-lg-5">
                                    <div className="section-head-right mt-3" data-media-cta>
                                        <p className="section-head-description">{t("description")}</p>
                                        <Link href="/media" className="butn butn-blue">
                                            <span>{t("cta")}</span>
                                            <img
                                                src="/images/icons/arrow-wh.svg"
                                                alt=""
                                                className="butn-icon"
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="media_highlights_canvas">
                            <ul className={`media_highlights_grid has_${items.length}`}>
                                <li className="media_highlights_slot is_lead" data-media-card>
                                    <MediaCard item={lead} labels={labelsFor(lead)} variant="default" />
                                </li>
                                {rest.map((item, i) => (
                                    <li
                                        key={item.id}
                                        className={`media_highlights_slot is_sat is_sat_${i + 1}`}
                                        data-media-card
                                    >
                                        <MediaCard item={item} labels={labelsFor(item)} variant="default" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </MediaHighlightsStage>

            <div className="sec-lines" aria-hidden="true">
                <span></span>
                <span></span>
            </div>
        </section>
    );
};

export default MediaHighlightsSection;
