import { cache } from "react";
import mediaMock from "@/mock-api/media.json";

/* =========================================================
   Estidam in the Media — data model + data access
   ---------------------------------------------------------
   One canonical bilingual collection (src/mock-api/media.json)
   feeds both the homepage section and the /media archive.
   To move to the CMS later, replace `loadMediaItems()` only;
   every component reads through the selectors below.
   ========================================================= */

export type MediaLocaleText = {
    ar: string;
    en: string;
};

export type MediaCategory = "newspapers" | "official" | "digital" | "company";

export type MediaStatus = "published" | "draft" | "pending_verification";

export type MediaVerificationStatus = "verified" | "partial" | "unverified";

export type MediaImageApprovalStatus = "approved" | "pending" | "not_available";

export type MediaItem = {
    id: string;
    slug: string;
    title: MediaLocaleText;
    excerpt: MediaLocaleText;
    sourceName: MediaLocaleText;
    sourceUrl: string;
    sourceDomain: string;
    /** Language of the original article (links are never localised). */
    sourceLanguage: "ar" | "en";
    /** ISO date `YYYY-MM-DD`, or null when it could not be verified. */
    publicationDate: string | null;
    category: MediaCategory;
    /** Path under /public (e.g. /images/media/xyz.webp). Only used when imageApprovalStatus is "approved". */
    image: string | null;
    imageAlt: MediaLocaleText;
    imageApprovalStatus: MediaImageApprovalStatus;
    sourceLogo?: string | null;
    featured: boolean;
    homepageFeatured: boolean;
    displayOrder: number;
    status: MediaStatus;
    verificationStatus: MediaVerificationStatus;
    /** Cross-posts of the same story (X, Telegram, republished copies). Never shown as separate cards. */
    relatedUrls: string[];
    /** Set when this record repeats another record's story; such records are never public. */
    duplicateOf: string | null;
    editorialNote?: string;
};

/** Locale-resolved shape passed to the components (no raw ar/en objects in the UI). */
export type MediaCardData = {
    id: string;
    title: string;
    excerpt: string;
    sourceName: string;
    sourceUrl: string;
    sourceDomain: string;
    sourceLanguage: "ar" | "en";
    isForeignLanguage: boolean;
    category: MediaCategory;
    dateIso: string | null;
    dateLabel: string | null;
    image: string | null;
    imageAlt: string;
    sourceLogo: string | null;
    featured: boolean;
};

const HOMEPAGE_LIMIT = 3;

/* ---------- Data provider (swap this for the CMS) ---------- */
async function loadMediaItems(): Promise<MediaItem[]> {
    return (mediaMock.items as MediaItem[]).slice();
}

/* ---------- Eligibility ---------- */
export function isPublic(item: MediaItem): boolean {
    return (
        item.status === "published" &&
        item.verificationStatus === "verified" &&
        !item.duplicateOf &&
        Boolean(item.title.ar || item.title.en) &&
        Boolean(item.sourceUrl)
    );
}

function byEditorialOrder(a: MediaItem, b: MediaItem) {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return (b.publicationDate ?? "").localeCompare(a.publicationDate ?? "");
}

/* ---------- Selectors ---------- */
export const getMediaItems = cache(async (): Promise<MediaItem[]> => {
    const items = await loadMediaItems();
    return items.filter(isPublic).sort(byEditorialOrder);
});

export const getFeaturedMediaItem = cache(async (): Promise<MediaItem | null> => {
    const items = await getMediaItems();
    return items.find((item) => item.featured) ?? null;
});

export const getHomepageMediaItems = cache(async (limit = HOMEPAGE_LIMIT): Promise<MediaItem[]> => {
    const items = await getMediaItems();
    const picked = items.filter((item) => item.homepageFeatured);
    return (picked.length ? picked : items).slice(0, limit);
});

export async function getMediaItemsByCategory(category: MediaCategory): Promise<MediaItem[]> {
    const items = await getMediaItems();
    return items.filter((item) => item.category === category);
}

/** Categories that actually have public items, in a fixed order. Filters are built from this. */
export async function getMediaCategories(): Promise<MediaCategory[]> {
    const order: MediaCategory[] = ["newspapers", "official", "digital", "company"];
    const items = await getMediaItems();
    const present = new Set(items.map((item) => item.category));
    return order.filter((category) => present.has(category));
}

/* ---------- Locale helpers ---------- */
function pick(text: MediaLocaleText, locale: string): string {
    const primary = locale === "ar" ? text.ar : text.en;
    return (primary || text.ar || text.en || "").trim();
}

export function formatMediaDate(iso: string | null, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export function toMediaCardData(item: MediaItem, locale: string): MediaCardData {
    const imageApproved = item.imageApprovalStatus === "approved" && Boolean(item.image);
    return {
        id: item.id,
        title: pick(item.title, locale),
        excerpt: pick(item.excerpt, locale),
        sourceName: pick(item.sourceName, locale),
        sourceUrl: item.sourceUrl,
        sourceDomain: item.sourceDomain,
        sourceLanguage: item.sourceLanguage,
        isForeignLanguage: item.sourceLanguage !== locale,
        category: item.category,
        dateIso: item.publicationDate,
        dateLabel: formatMediaDate(item.publicationDate, locale),
        image: imageApproved ? item.image : null,
        imageAlt: imageApproved ? pick(item.imageAlt, locale) : "",
        sourceLogo: item.sourceLogo ?? null,
        featured: item.featured,
    };
}
