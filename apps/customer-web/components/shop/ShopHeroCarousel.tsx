'use client';

import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

const STATIC_SLIDES = [
  {
    id: 'deals',
    title: 'Pawsome Deals!',
    subtitle: 'Up to 30% OFF on top pet products',
    gradient: 'linear-gradient(135deg, #FF8C42 0%, #FFB347 55%, #FFD699 100%)',
    cta: 'Shop Now',
    target: 'shop-top-deals',
  },
  {
    id: 'food',
    title: 'Premium Pet Food',
    subtitle: 'Trusted brands for happy, healthy pets',
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 50%, #FFA94D 100%)',
    cta: 'Browse Food',
    target: 'shop-all-products',
  },
  {
    id: 'toys',
    title: 'Toys & Treats',
    subtitle: 'Spoil your furry friend today',
    gradient: 'linear-gradient(135deg, #E85D04 0%, #FF8C42 60%, #FBBF24 100%)',
    cta: 'Explore',
    target: 'shop-all-products',
  },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ShopHeroCarousel() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = STATIC_SLIDES.length;

  return (
    <div className="px-4 mt-3 mb-1">
      <div
        className="relative h-36 rounded-2xl overflow-hidden shadow-md"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || count <= 1) return;
          const end = e.changedTouches[0]?.clientX ?? start;
          const dx = end - start;
          if (dx < -48) setCurrent((prev) => (prev + 1) % count);
          else if (dx > 48) setCurrent((prev) => (prev - 1 + count) % count);
        }}
      >
        {STATIC_SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              current === index ? 'z-[1] opacity-100' : 'z-0 opacity-0 pointer-events-none'
            }`}
            style={{ background: slide.gradient }}
            aria-hidden={current !== index}
          >
            <div className="h-full flex flex-col justify-center px-5 pr-24">
              <h2 className="text-white text-lg font-bold leading-tight">{slide.title}</h2>
              <p className="text-white/90 text-xs mt-1 mb-3 max-w-[12rem]">{slide.subtitle}</p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 self-start bg-white text-[#FF8C42] px-4 py-2 rounded-full text-xs font-semibold shadow-sm active:scale-[0.98]"
                onClick={() => scrollToSection(slide.target)}
              >
                {slide.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute right-3 bottom-3 w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-4xl select-none">
              🐾
            </div>
          </div>
        ))}

        <div
          className="absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-1.5"
          role="tablist"
          aria-label="Shop promotions"
        >
          {STATIC_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={current === index}
              aria-label={`Slide ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                current === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
              onClick={() => setCurrent(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
