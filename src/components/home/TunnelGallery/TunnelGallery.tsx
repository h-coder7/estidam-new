import { getLocale, getTranslations } from "next-intl/server";
import { getCatalogProducts, type CatalogProduct } from "@/lib/api/home";
import { PRODUCTS_CASCADE_CONFIG } from "@/components/home/Products/productsCascadeConfig";
import TunnelGalleryClient from "./TunnelGalleryClient";

function fallbackItems(t: (key: string) => string): CatalogProduct[] {
    return PRODUCTS_CASCADE_CONFIG.cards.map((card) => ({
        id: card.id,
        img: card.img,
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

    const items: CatalogProduct[] = catalog.length > 0 ? catalog : fallbackItems(t);

    return <TunnelGalleryClient items={items} />;
}
