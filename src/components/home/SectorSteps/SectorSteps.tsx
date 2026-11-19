import { getLocale, getTranslations } from "next-intl/server";

import SectorStepsView, { type PracticalAiStep } from "./SectorStepsView";

import "./_SectorSteps.scss";

type Props = {
    embedded?: boolean;
};

const SectorSteps = async ({ embedded = false }: Props) => {
    const locale = await getLocale();
    const t = await getTranslations("sectorSteps");
    const practicalAiSteps = (t.raw("practicalAi.steps") as PracticalAiStep[]) || [];

    return (
        <SectorStepsView
            embedded={embedded}
            locale={locale}
            eyebrow={t("eyebrow")}
            description={t("description")}
            phasesLabel={t("phasesLabel")}
            lanesLabel={t("lanesLabel")}
            practicalAi={{
                eyebrow: t("practicalAi.eyebrow"),
                description: t("practicalAi.description"),
                status: t("practicalAi.status"),
                steps: practicalAiSteps,
            }}
        />
    );
};

export default SectorSteps;
