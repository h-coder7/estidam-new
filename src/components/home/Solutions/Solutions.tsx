import { getLocale, getTranslations } from "next-intl/server";
import { getSolutionCubeSlides, getSolutionsContent, headingFromCms } from "@/lib/api/home";
import SolutionsDial from "./SolutionsDial";

import "./_Solutions.scss";

const Solutions = async () => {
    const locale = await getLocale();
    const t = await getTranslations("solutions");
    const content = await getSolutionsContent(locale);
    const slides = await getSolutionCubeSlides(locale);
    const heading = headingFromCms(content, t("titleStrong"), t("titleMuted"));
    const badge = content?.eyebrow || t("badge");

    return (
        <SolutionsDial
            slides={slides}
            badge={badge}
            titleStrong={heading.titleStrong}
            titleMuted={heading.titleMuted}
        />
    );
};

export default Solutions;
