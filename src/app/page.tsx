import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Navbar } from "@/components/site/navbar";
import { Architecture, PolicyShowcase, Timeline, UseCases } from "@/components/site/showcase";
import { Preview } from "@/components/site/preview";
import { Compare, Cta, Faq, Pipeline, Safety, Stats } from "@/components/site/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Preview />
        <Stats />
        <Pipeline />
        <Architecture />
        <PolicyShowcase />
        <Compare />
        <Timeline />
        <Safety />
        <UseCases />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
