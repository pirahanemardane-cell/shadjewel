import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroHeadline } from "@/components/home/hero-headline";
import { HomeBelowFold } from "@/components/home/home-below-fold";
import PolaroidLineCarousel from "@/components/ui/polaroid-line-carousel";

// ISR: HTML کش‌شده ۶۰ ثانیه
export const revalidate = 60;

export const metadata: Metadata = {
  title: "اکسسوری شاد | فروشگاه تخصصی اکسسوری دست ساز",
  description:
    "خرید گردنبند، گوشواره، انگشتر، دستبند و ست‌های اکسسوری دست ساز از فروشگاه تخصصی اکسسوری دست ساز",
};

const HERO_SLIDES = [
  {
    image: "/hero/card/polaroid-earring.webp",
    fullImage: "/hero/polaroid-earring.webp",
    alt: "گوشواره دست‌ساز",
  },
  {
    image: "/hero/card/polaroid-01.webp",
    fullImage: "/hero/polaroid-01.webp",
    alt: "اکسسوری دست‌ساز",
  },
  {
    image: "/hero/card/polaroid-02.webp",
    fullImage: "/hero/polaroid-02.webp",
    alt: "جواهرات دست‌ساز",
  },
  {
    image: "/hero/card/polaroid-03.webp",
    fullImage: "/hero/polaroid-03.webp",
    alt: "گردنبند دست‌ساز",
  },
  {
    image: "/hero/card/polaroid-04.webp",
    fullImage: "/hero/polaroid-04.webp",
    alt: "دستبند دست‌ساز",
  },
  {
    image: "/hero/card/polaroid-05.webp",
    fullImage: "/hero/polaroid-05.webp",
    alt: "انگشتر دست‌ساز",
  },
] as const;

/** Early LCP hints — middle polaroid (initial active print) for the carousel. */
function HomeHeroPreloads() {
  return (
    <link
      rel="preload"
      as="image"
      href="/hero/card/polaroid-02.webp"
      type="image/webp"
    />
  );
}

/**
 * Sync shell: polaroid carousel streams in the first paint.
 * Catalog/DB sections suspend separately so layout footer cannot win the race.
 */
export default function HomePage() {
  return (
    <>
      <HomeHeroPreloads />
      <section
        aria-label="هیرو"
        // Asymmetric band: solid floor under header on phones, ~annotation air on
        // desktop; small pb so the wire (inside the carousel) still reads below the H1.
        className="flex w-full flex-col items-stretch pt-[clamp(5rem,9.5vw,7.5rem)] pb-3"
      >
        <HeroHeadline />
        <PolaroidLineCarousel
          showChrome={false}
          slides={[...HERO_SLIDES]}
          height={null}
          className="h-[min(70svh,22rem)] md:h-[min(100svh,36rem)]"
          background="var(--background)"
          ariaLabel="گالری عکس محصولات"
        />
      </section>
      <Suspense fallback={null}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
