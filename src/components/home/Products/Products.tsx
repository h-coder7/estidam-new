import { getLocale, getTranslations } from "next-intl/server";
import { getCatalogProducts, getProductsContent, headingFromCms } from "@/lib/api/home";
import { PRODUCTS_CASCADE_CONFIG } from "./productsCascadeConfig";
import type { CatalogProduct } from "@/lib/api/home";
import ProductsStage from "./ProductsStage";

import "./_Products.scss";

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

const Products = async () => {
    const locale = await getLocale();
    const t = await getTranslations("products");
    const content = await getProductsContent(locale);
    const heading = headingFromCms(content, t("titleStrong"), t("titleMuted"));
    const badge = content?.eyebrow || t("badge");
    const description = content?.description || t("description");
    const cta = content?.cta || t("cta");
    const ctaUrl = content?.ctaUrl || "/products";
    const catalog = await getCatalogProducts(
        locale,
        {
            available: t("card1Status"),
            soon: t("card3Status"),
            problem: t("problemLabel"),
            users: t("usersLabel"),
        },
        content?.onlyAvailable,
    );

    const cards = catalog.length > 0 ? catalog : fallbackItems(t);

    return (
        <ProductsStage
            cards={cards}
            badge={badge}
            titleStrong={heading.titleStrong}
            titleMuted={heading.titleMuted || t("titleMuted")}
            description={description}
            cta={cta}
            ctaHref={ctaUrl.startsWith("http") || ctaUrl.startsWith("#") ? ctaUrl : ctaUrl}
        />
    );
};

export default Products;
