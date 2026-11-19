"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import type { MediaCardData, MediaCategory } from "@/lib/api/media";
import MediaCard, { type MediaCardLabels } from "./MediaCard";

/** Search only appears once the archive is large enough to need it. */
const SEARCH_THRESHOLD = 6;

type Filter = "all" | MediaCategory;

export type MediaArchiveLabels = {
    featuredLabel: string;
    filtersLabel: string;
    all: string;
    searchLabel: string;
    searchPlaceholder: string;
    noResults: string;
    noResultsHint: string;
    reset: string;
    empty: string;
    readArticle: string;
    opensNewTab: string;
    categories: Record<MediaCategory, string>;
    sourceLanguage: Record<"ar" | "en", string>;
    /** Pre-rendered counts, keyed by number (ICU plural rules are resolved on the server). */
    counts: Record<number, string>;
};

type MediaArchiveProps = {
    items: MediaCardData[];
    categories: MediaCategory[];
    labels: MediaArchiveLabels;
};

function normalise(value: string) {
    return value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[ً-ْـ]/g, "") // Arabic diacritics + tatweel
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه");
}

export default function MediaArchive({ items, categories, labels }: MediaArchiveProps) {
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const searchId = useId();
    const statusId = useId();

    const featured = items.find((item) => item.featured) ?? null;
    const showSearch = items.length >= SEARCH_THRESHOLD;
    const showFilters = categories.length > 1;
    const browsing = filter === "all" && deferredQuery.trim() === "";

    const results = useMemo(() => {
        const needle = normalise(deferredQuery.trim());
        return items.filter((item) => {
            if (filter !== "all" && item.category !== filter) return false;
            if (!needle) return true;
            return normalise(`${item.title} ${item.sourceName} ${item.excerpt} ${item.sourceDomain}`).includes(needle);
        });
    }, [items, filter, deferredQuery]);

    // While browsing everything, the featured story sits above the grid and is not repeated in it.
    const gridItems = browsing && featured ? results.filter((item) => item.id !== featured.id) : results;

    const cardLabels = (item: MediaCardData): MediaCardLabels => ({
        readArticle: labels.readArticle,
        opensNewTab: labels.opensNewTab,
        category: labels.categories[item.category],
        language: item.isForeignLanguage ? labels.sourceLanguage[item.sourceLanguage] : null,
    });

    const reset = () => {
        setFilter("all");
        setQuery("");
    };

    if (!items.length) {
        return (
            <div className="media_archive">
                <div className="media_state">
                    <p className="media_state_title">{labels.empty}</p>
                </div>
            </div>
        );
    }

    const countLabel = labels.counts[results.length] ?? String(results.length);

    return (
        <div className="media_archive">
            {browsing && featured ? (
                <div className="media_archive_feature">
                    <MediaCard item={featured} labels={cardLabels(featured)} variant="feature" badge={labels.featuredLabel} headingLevel="h2" />
                </div>
            ) : null}

            {showFilters || showSearch ? (
                <div className="media_toolbar">
                    {showFilters ? (
                        <div className="media_filters" role="group" aria-label={labels.filtersLabel}>
                            {(["all", ...categories] as Filter[]).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    className="media_filter"
                                    aria-pressed={filter === key}
                                    aria-controls={statusId}
                                    onClick={() => setFilter(key)}
                                >
                                    {key === "all" ? labels.all : labels.categories[key]}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {showSearch ? (
                        <div className="media_search">
                            <label className="visually-hidden" htmlFor={searchId}>
                                {labels.searchLabel}
                            </label>
                            <input
                                id={searchId}
                                type="search"
                                value={query}
                                placeholder={labels.searchPlaceholder}
                                onChange={(event) => setQuery(event.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    ) : null}

                    <p className="media_count" id={statusId} role="status" aria-live="polite">
                        {countLabel}
                    </p>
                </div>
            ) : null}

            {results.length === 0 ? (
                <div className="media_state">
                    <p className="media_state_title">{labels.noResults}</p>
                    <p className="media_state_hint">{labels.noResultsHint}</p>
                    <button type="button" className="media_state_btn" onClick={reset}>
                        {labels.reset}
                    </button>
                </div>
            ) : gridItems.length ? (
                <ul className={`media_grid${gridItems.length < 3 ? " is_few" : ""}`} key={`${filter}-${deferredQuery}`}>
                    {gridItems.map((item) => (
                        <li key={item.id}>
                            <MediaCard item={item} labels={cardLabels(item)} headingLevel="h2" />
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
