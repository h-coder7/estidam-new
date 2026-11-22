"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import type { TunnelGalleryItem } from "./tunnelGalleryScene";

import "./_TunnelGallery.scss";

type Props = {
    items: TunnelGalleryItem[];
};

export default function TunnelGalleryClient({ items }: Props) {
    const rootRef = useRef<HTMLElement>(null);
    const locale = useLocale();
    const isAr = locale === "ar";

    const itemsKey = items.map((item) => `${item.id}:${item.src}`).join("|");

    useEffect(() => {
        const root = rootRef.current;
        if (!root || !items.length) return;

        let disposed = false;
        let cleanup = () => {};

        import("./tunnelGalleryScene").then(({ mountTunnelGallery }) => {
            if (disposed || !root.isConnected) return;
            cleanup = mountTunnelGallery(root, items);
        });

        return () => {
            disposed = true;
            cleanup();
        };
        // itemsKey tracks catalog identity; items is closed over for the latest payload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsKey]);

    if (!items.length) return null;

    return (
        <section
            className="tunnel_gallery"
            id="tunnel-gallery"
            ref={rootRef}
            aria-label={isAr ? "معرض المنتجات" : "Products gallery"}
        >
            <canvas className="tunnel_gallery_canvas" aria-hidden="true" />

            <div className="tunnel_gallery_brand">{isAr ? "استدام · المنتجات" : "Estidam · Products"}</div>

            <div className="tunnel_gallery_counter" aria-live="polite">
                <span className="n">01</span>
                <span className="sep">/</span>
                <span className="tot">{String(items.length).padStart(2, "0")}</span>
            </div>

            <div className="tunnel_gallery_hint">
                {isAr
                    ? "اسحب للنظر · اضغط على منتج للتركيز · Esc للخروج"
                    : "drag to look · click a product to focus · esc to exit"}
            </div>

            <article className="tunnel_gallery_card" aria-hidden="true">
                <div className="tunnel_gallery_card_media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="tunnel_gallery_card_img" src="" alt="" />
                </div>
                <div className="tunnel_gallery_card_body">
                    <span className="tunnel_gallery_card_status is_available">
                        <i />
                        <span className="tunnel_gallery_card_status_text" />
                    </span>
                    <div className="tunnel_gallery_card_title_row">
                        <div className="tunnel_gallery_card_copy">
                            <h3 className="tunnel_gallery_card_title" />
                            <p className="tunnel_gallery_card_tagline" />
                        </div>
                        <div className="tunnel_gallery_card_logo" aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="" alt="" />
                        </div>
                    </div>
                    <div className="tunnel_gallery_card_meta">
                        <div className="tunnel_gallery_card_meta_item is_problem">
                            <span className="tunnel_gallery_card_meta_label" />
                            <p className="tunnel_gallery_card_meta_text" />
                        </div>
                        <div className="tunnel_gallery_card_meta_item is_users">
                            <span className="tunnel_gallery_card_meta_label" />
                            <p className="tunnel_gallery_card_meta_text" />
                        </div>
                    </div>
                </div>
            </article>
        </section>
    );
}
