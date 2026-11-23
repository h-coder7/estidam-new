import { getTranslations } from "next-intl/server";
import { PARTNER_LOGOS } from "@/components/home/Partners/partnersData";
import SpectralTilesClient from "./SpectralTilesClient";

export default async function SpectralTiles() {
    const t = await getTranslations("spectralTiles");

    return (
        <SpectralTilesClient
            titleStrong={t("titleStrong")}
            titleMuted={t("titleMuted")}
            description={t("description")}
            logos={PARTNER_LOGOS}
        />
    );
}
