"use client";

import { useEffect, useRef } from "react";

export default function HeroInteractiveVisual() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const progress = Math.max(-1, Math.min(1, (viewport / 2 - center) / viewport));

      element.style.setProperty("--hero-scroll-y", `${(progress * 22).toFixed(2)}px`);
      element.style.setProperty("--hero-scroll-r", `${(progress * 1.25).toFixed(2)}deg`);
      element.style.setProperty("--hero-scroll-scale", `${(1.015 + Math.abs(progress) * 0.012).toFixed(4)}`);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="hero-parallax-visual" aria-label="Felipe Auto Design - pintura automotiva">
      <img
        src="/hero-felipe-cinematic.png"
        alt="Felipe Auto Design com pistola de pintura automotiva"
        draggable={false}
      />
    </div>
  );
}
