import { getTranslations } from "next-intl/server";

import OperationsStepsView, { type OperationsStep } from "./OperationsStepsView";

import "./_OperationsSteps.scss";

type Props = {
    embedded?: boolean;
};

const OperationsSteps = async ({ embedded = false }: Props) => {
    const t = await getTranslations("operationsSteps");
    const steps = (t.raw("steps") as OperationsStep[]) || [];

    return (
        <OperationsStepsView
            embedded={embedded}
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
            steps={steps}
        />
    );
};

export default OperationsSteps;
