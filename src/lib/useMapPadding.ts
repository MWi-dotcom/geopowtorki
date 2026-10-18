import { useEffect, useRef, useState } from 'react';
import type { Padding } from '../map/GeoMap';

/**
 * Margines mapy tak, żeby obiekty nie chowały się pod panelem pytania:
 * na telefonie panel jest u dołu, na szerszych ekranach – po lewej.
 */
export function useMapPadding() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [padding, setPadding] = useState<Partial<Padding>>({ bottom: 200 });
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const wide = innerWidth >= 768;
      setPadding(wide ? { left: r.width + 40, top: 30, bottom: 30, right: 60 } : { bottom: Math.min(r.height, innerHeight * 0.6) + 16, top: 24, left: 16, right: 56 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    addEventListener('resize', update);
    return () => {
      ro.disconnect();
      removeEventListener('resize', update);
    };
  }, []);
  return { panelRef, padding };
}
