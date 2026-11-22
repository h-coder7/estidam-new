import { getLocale, getTranslations } from "next-intl/server";
import { getCatalogProducts } from "@/lib/api/home";
import { PRODUCTS_CASCADE_CONFIG } from "@/components/home/Products/productsCascadeConfig";
import TunnelGalleryClient from "./TunnelGalleryClient";
import type { TunnelGalleryItem } from "./tunnelGalleryScene";

function fallbackItems(t: (key: string) => string): TunnelGalleryItem[] {
    return PRODUCTS_CASCADE_CONFIG.cards.map((card) => ({
        id: card.id,
        src: card.img,
        title: t(card.titleKey),
        tagline: t(card.taglineKey),
        status: t(card.statusKey),
        statusTone: card.statusTone,
        logo: card.logo,
        problemLabel: t(card.problemLabelKey),
        problem: t(card.problemKey),
        usersLabel: t(card.usersLabelKey),
        users: t(card.usersKey),
    }));
}

/**
 * Server wrapper — feeds Tunnel Gallery with the same product catalog as Products.
 * Does not replace or remove the Products section.
 */
export default async function TunnelGallery() {
    const locale = await getLocale();
    const t = await getTranslations("products");
    const catalog = await getCatalogProducts(
        locale,
        {
            available: t("card1Status"),
            soon: t("card3Status"),
            problem: t("problemLabel"),
            users: t("usersLabel"),
        },
        false,
    );

    const items: TunnelGalleryItem[] =
        catalog.length > 0
            ? catalog.map((card) => ({
                  id: card.id,
                  src: card.img,
                  title: card.title,
                  tagline: card.tagline,
                  status: card.status,
                  statusTone: card.statusTone,
                  logo: card.logo,
                  problemLabel: card.problemLabel,
                  problem: card.problem,
                  usersLabel: card.usersLabel,
                  users: card.users,
              }))
            : fallbackItems(t);

    return <TunnelGalleryClient items={items} />;
}
