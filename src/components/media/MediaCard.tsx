import type { MediaCardData } from "@/lib/api/media";
import MediaCover from "./MediaCover";

import "./_media.scss";

export type MediaCardLabels = {
    readArticle: string;
    opensNewTab: string;
    category: string;
    language: string | null;
};

type MediaCardProps = {
    item: MediaCardData;
    labels: MediaCardLabels;
    /** default = vertical card, lead = large homepage card, row = compact horizontal, feature = archive featured story */
    variant?: "default" | "lead" | "row" | "feature";
    badge?: string;
    headingLevel?: "h2" | "h3";
};

export function ExternalIcon() {
    return (
        <svg className="media_ext_icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M4.5 2.5h7v7M11.5 2.5 2.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/**
 * One media item. The whole card is a single external link
 * (one tab stop); its accessible name is the headline, outlet,
 * date and the "opens in a new tab" hint, read in order.
 */
export default function MediaCard({ item, labels, variant = "default", badge, headingLevel = "h3" }: MediaCardProps) {
    const Heading = headingLevel;
    const showExcerpt = Boolean(item.excerpt) && variant !== "row";

    return (
        <a
            className={`media_card is_${variant}`}
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            hrefLang={item.sourceLanguage}
        >
            <div className="media_card_media">
                <MediaCover item={item} size={variant === "lead" || variant === "feature" ? "lg" : "md"} />
                {badge ? <span className="media_card_badge">{badge}</span> : null}
            </div>

            <div className="media_card_body">
                <p className="media_card_meta">
                    <span className="media_card_source" dir="auto">
                        {item.sourceName}
                    </span>
                    {item.dateLabel ? (
                        <time className="media_card_date" dateTime={item.dateIso ?? undefined}>
                            {item.dateLabel}
                        </time>
                    ) : null}
                </p>

                <Heading className="media_card_title">{item.title}</Heading>

                {showExcerpt ? <p className="media_card_excerpt">{item.excerpt}</p> : null}

                <div className="media_card_foot">
                    <span className="media_card_cta">
                        {labels.readArticle}
                        <ExternalIcon />
                        <span className="visually-hidden"> {labels.opensNewTab}</span>
                    </span>
                    <span className="media_card_tags">
                        <span className="media_card_tag">{labels.category}</span>
                        {labels.language ? <span className="media_card_tag is_lang">{labels.language}</span> : null}
                    </span>
                </div>
            </div>
        </a>
    );
}
