import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar/Navbar";
import MediaArchive, { type MediaArchiveLabels } from "@/components/media/MediaArchive";
import { getMediaCategories, getMediaItems, toMediaCardData, type MediaCategory } from "@/lib/api/media";

import "@/components/media/_media.scss";

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "mediaPage" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: {
            languages: { ar: "/ar/media/", en: "/en/media/" },
        },
    };
}

export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: routeLocale } = await params;
    setRequestLocale(routeLocale);
    const locale = await getLocale();
    const t = await getTranslations("mediaPage");
    const tc = await getTranslations("mediaCommon");

    const records = await getMediaItems();
    const items = records.map((item) => toMediaCardData(item, locale));
    const categories = await getMediaCategories();

    const categoryKeys: MediaCategory[] = ["newspapers", "official", "digital", "company"];
    const counts: Record<number, string> = {};
    for (let n = 0; n <= items.length; n += 1) counts[n] = t("resultsCount", { count: n });

    const labels: MediaArchiveLabels = {
        featuredLabel: t("featuredLabel"),
        filtersLabel: t("filtersLabel"),
        all: t("all"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        noResults: t("noResults"),
        noResultsHint: t("noResultsHint"),
        reset: t("reset"),
        empty: t("empty"),
        readArticle: tc("readArticle"),
        opensNewTab: tc("opensNewTab"),
        categories: Object.fromEntries(categoryKeys.map((key) => [key, tc(`categories.${key}`)])) as Record<MediaCategory, string>,
        sourceLanguage: { ar: tc("sourceLanguage.ar"), en: tc("sourceLanguage.en") },
        counts,
    };

    return (
        <div className="inner-page">
            <Navbar className="inner-nav" />

            <main className="media_page">
                <section className="media_intro" aria-labelledby="media-page-title">
                    <div className="container">
                        <div className="media_intro_inner">
                            <span className="section-head-badge">{t("badge")}</span>
                            <h1 className="media_intro_title" id="media-page-title">
                                {t("title")}
                            </h1>
                            <p className="media_intro_subtitle">{t("subtitle")}</p>
                        </div>
                    </div>
                </section>

                <section className="media_archive_section">
                    <div className="container">
                        <MediaArchive items={items} categories={categories} labels={labels} />
                    </div>
                </section>
            </main>

            <Footer />
            <div className="line-pat"></div>
        </div>
    );
}
