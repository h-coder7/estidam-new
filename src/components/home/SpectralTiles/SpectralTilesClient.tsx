"use client";

import { useEffect, useRef } from "react";
import type { PartnerLogo } from "@/components/home/Partners/partnersData";

import "./_SpectralTiles.scss";

type Props = {
    titleStrong: string;
    titleMuted: string;
    description: string;
    logos: PartnerLogo[];
};

export default function SpectralTilesClient({ titleStrong, titleMuted, description, logos }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const logosKey = logos.map((l) => l.src).join("|");
    const title = `${titleStrong} ${titleMuted}`;

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        let disposed = false;
        let cleanup = () => {};

        import("./spectralTilesScene").then(({ mountSpectralTiles }) => {
            if (disposed || !root.isConnected) return;
            cleanup = mountSpectralTiles(root, {
                // Estidam identity — light frosted look
                color: "#295cc7",
                glowColor: "#1691d0",
                backgroundColor: "#f7f8fa",
                // Same tile size as before (zoom tracks grid), fewer tiles so the full floor fits
                grid: 7,
                gap: 0.05,
                thickness: 0.16,
                radius: 0.08,
                density: 0.96,
                scatter: 0.45,
                heightVariance: 0.07,
                angle: 45,
                tilt: 40,
                perspective: 26,
                zoom: 1.62,
                lights: 4,
                lightIntensity: 0.55,
                lightSize: 1.15,
                edgeGlow: 0.95,
                rim: 1,
                frost: 0.45,
                fog: 0.28,
                speed: 1,
                interactive: true,
                lift: 1,
                lean: 1,
                ripple: true,
                intro: true,
                seed: 7,
                logos: logos.map((l) => ({ name: l.name, src: l.src })),
            });
        });

        return () => {
            disposed = true;
            cleanup();
        };
        // logosKey tracks partner logo identity; logos closed over for latest payload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logosKey]);

    return (
        <section
            className="spectral_tiles_section"
            id="spectral-tiles"
            aria-label={title}
        >
            <div className="spectral_tiles" ref={rootRef}>
                <canvas className="spectral_tiles_canvas" aria-hidden="true" />

                <div className="spectral_tiles_copy">
                    <h2 className="spectral_tiles_title">
                        {titleStrong} <span>{titleMuted}</span>
                    </h2>
                    <p className="spectral_tiles_desc">{description}</p>
                </div>
            </div>
        </section>
    );
}
