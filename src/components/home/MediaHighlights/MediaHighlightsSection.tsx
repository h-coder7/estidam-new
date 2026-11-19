import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import MediaCard from "@/components/media/MediaCard";
import { getHomepageMediaItems, toMediaCardData } from "@/lib/api/media";

import "./_MediaHighlights.scss";

/**
 * Homepage — "Estidam in the Media".
 * Server component: reads the same dataset as /media through
 * getHomepageMediaItems() (homepageFeatured + displayOrder, max 3).
 * Renders nothing when no public coverage exists.
 */
const MediaHighlightsSection = async () => {
    const locale = await getLocale();
    const t = await getTranslations("mediaSection");
    const tc = await getTranslations("mediaCommon");
    const records = await getHomepageMediaItems();

    if (!records.length) return null;

    const [lead, ...rest] = records.map((item) => toMediaCardData(item, locale));

    const labelsFor = (item: typeof lead) => ({
        readArticle: tc("readArticle"),
        opensNewTab: tc("opensNewTab"),
        category: tc(`categories.${item.category}`),
        language: item.isForeignLanguage ? tc(`sourceLanguage.${item.sourceLanguage}`) : null,
    });

    return (
        <section className="media_highlights" id="media" aria-labelledby="media-highlights-title">
            <div className="container">
                <div className="content px-lg-4">
                    <div className="section-head media_highlights_head">
                        <span className="section-head-badge">{t("badge")}</span>

                        <div className="media_highlights_head_row">
                            <div className="media_highlights_head_copy">
                                <h2 className="section-head-title fsz-40 fw-600 lh-2" id="media-highlights-title">
                                    <span className="section-head-title-strong">{t("title")}</span>
                                </h2>
                                <p className="section-head-description media_highlights_desc">{t("description")}</p>
                            </div>

                            <Link href="/media" className="media_highlights_cta">
                                <span>{t("cta")}</span>
                                <span className="media_highlights_cta_arrow" aria-hidden="true">
                                    <svg width="16" height="16" viewBox="0 0 16 16" focusable="false">
                                        <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </Link>
                        </div>
                    </div>

                    <ul className={`media_highlights_grid has_${records.length}`}>
                        <li className="media_highlights_lead">
                            <MediaCard item={lead} labels={labelsFor(lead)} variant="lead" />
                        </li>
                        {rest.map((item) => (
                            <li key={item.id}>
                                <MediaCard item={item} labels={labelsFor(item)} variant="row" />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
};

export default MediaHighlightsSection;
