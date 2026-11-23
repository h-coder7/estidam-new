"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { CatalogProduct } from "@/lib/api/home";
import ProductCardFace from "@/components/home/Products/ProductCardFace";

import "@/components/home/Products/_Products.scss";
import "./_TunnelGallery.scss";

type Props = {
    items: CatalogProduct[];
};

export default function TunnelGalleryClient({ items }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const locale = useLocale();
    const isAr = locale === "ar";
    const [focused, setFocused] = useState<CatalogProduct | null>(null);

    const itemsKey = items.map((item) => `${item.id}:${item.img}`).join("|");

    useEffect(() => {
        const root = rootRef.current;
        if (!root || !items.length) return;

        let disposed = false;
        let cleanup = () => {};

        import("./tunnelGalleryScene").then(({ mountTunnelGallery }) => {
            if (disposed || !root.isConnected) return;
            cleanup = mountTunnelGallery(root, items, {
                onFocus: (item) => setFocused(item),
                onBlur: () => setFocused(null),
            });
        });

        return () => {
            disposed = true;
            cleanup();
            setFocused(null);
        };
        // itemsKey tracks catalog identity; items is closed over for the latest payload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsKey]);

    if (!items.length) return null;

    return (
        <section
            className="tunnel_gallery_section"
            id="tunnel-gallery"
            aria-label={isAr ? "معرض المنتجات" : "Products gallery"}
        >
            <div className="tunnel_gallery" ref={rootRef}>
                <canvas className="tunnel_gallery_canvas" aria-hidden="true" />

                <div className="tunnel_gallery_brand">{isAr ? "استدام · المنتجات" : "Estidam · Products"}</div>

                <div className="tunnel_gallery_counter" aria-live="polite">
                    <span className="n">01</span>
                    <span className="sep">/</span>
                    <span className="tot">{String(items.length).padStart(2, "0")}</span>
                </div>

                <article
                    className={`tunnel_gallery_card${focused ? " is_on" : ""}`}
                    aria-hidden={focused ? "false" : "true"}
                >
                    {focused ? <ProductCardFace card={focused} /> : null}
                </article>
            </div>
        </section>
    );
}
