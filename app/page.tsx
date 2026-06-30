import { DoneForYou } from "@/components/sections/DoneForYou";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { LiveDemo } from "@/components/sections/LiveDemo";
import { Nav } from "@/components/sections/Nav";
import { Pricing } from "@/components/sections/Pricing";
import { TrustStrip } from "@/components/sections/TrustStrip";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <LiveDemo />
        <Features />
        <DoneForYou />
        <Pricing />
        <FinalCta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
