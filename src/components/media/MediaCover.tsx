import type { MediaCardData } from "@/lib/api/media";

/**
 * Brand cover used when an article has no approved photograph.
 * It never imitates a news photo: it shows the outlet name on the
 * Estidam navy with the site's dot pattern, so readers can tell it
 * apart from the publisher's own imagery.
 */
export default function MediaCover({ item, size = "md" }: { item: MediaCardData; size?: "md" | "lg" }) {
    if (item.image) {
        return (
            <img
                className="media_cover_img"
                src={item.image}
                alt={item.imageAlt}
                loading="lazy"
                decoding="async"
                width={1200}
                height={750}
            />
        );
    }

    return (
        <div className={`media_cover is_${size}`} aria-hidden="true">
            <span className="media_cover_outlet" dir="auto">
                {item.sourceName}
            </span>
            <span className="media_cover_domain" dir="ltr">
                {item.sourceDomain}
            </span>
        </div>
    );
}
