import Hero from "@/components/home/Hero/Hero";
import WhyEstidam from "@/components/home/WhyEstidam/WhyEstidam";
import HajjJourney from "@/components/home/HajjJourney/HajjJourney";
import Solutions from "@/components/home/Solutions/Solutions";
import AiOperations from "@/components/home/AiOperations/AiOperations";
import TunnelGallery from "@/components/home/TunnelGallery/TunnelGallery";
// import Products from "@/components/home/Products/Products";
import Clients from "@/components/home/Clients/Clients";
import Partners from "@/components/home/Partners/Partners";
import HowWeDeliver from "@/components/home/HowWeDeliver/HowWeDeliver";
import ExperienceProof from "@/components/home/ExperienceProof/ExperienceProof";
import GrowthEcosystem from "@/components/home/GrowthEcosystem/GrowthEcosystem";
import News from "@/components/home/News/News";
import MediaHighlightsSection from "@/components/home/MediaHighlights/MediaHighlightsSection";
import GetInTouch from "@/components/home/GetInTouch/GetInTouch";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar/Navbar";

export const revalidate = 300;

export default function Home() {
    return (
        <>
            <Navbar className="inner-nav" />

            <main>
                <Hero />
                <WhyEstidam />
                <Solutions />
                <HajjJourney />
                <AiOperations />
                <TunnelGallery />
                {/* <Products /> */}
                <Clients />
                {/* <HowWeDeliver /> */}
                {/* <ExperienceProof /> */}
                <GrowthEcosystem />
                <Partners />
                <News />
                <MediaHighlightsSection />
                <GetInTouch />
            </main>

            <Footer />
        </>
    );
}
