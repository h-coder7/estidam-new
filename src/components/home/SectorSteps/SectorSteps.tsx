import { getLocale, getTranslations } from "next-intl/server";

import SectorStepsView from "./SectorStepsView";

import "./_SectorSteps.scss";

const SectorSteps = async () => {
    const locale = await getLocale();
    const t = await getTranslations("sectorSteps");

    return (
        <SectorStepsView
            locale={locale}
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            proofLabel={t("proofLabel")}
            proofValue={t("proofValue")}
            proofMetric={t("proofMetric")}
            proofScore={t("proofScore")}
            proofScoreLabel={t("proofScoreLabel")}
            proofNote={t("proofNote")}
            hint={t("hint")}
            phasesLabel={t("phasesLabel")}
            lanesLabel={t("lanesLabel")}
        />
    );
};

export default SectorSteps;
