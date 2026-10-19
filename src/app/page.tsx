import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Navbar } from "@/components/site/navbar";
import { Cta, Faq, Pipeline, Safety } from "@/components/site/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Pipeline />
        <Safety />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
