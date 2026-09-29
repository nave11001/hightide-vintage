import { useEffect } from 'react';

/**
 * Hold the page still while something lies over it.
 *
 * overflow:hidden on the body is not enough on iOS Safari, which scrolls the
 * page behind an overlay regardless. position:fixed is what actually stops it,
 * and it costs the scroll offset — so the offset is recorded, the body pinned
 * at it, and the page put back exactly where it was on release.
 *
 * The same technique the garment modal uses in App.tsx; this is it as a hook
 * for the drawer, which needed it and did not have it.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const y = window.scrollY;
    const { body } = document;
    const previous = body.style.cssText;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    return () => {
      body.style.cssText = previous;
      window.scrollTo(0, y);
    };
  }, [active]);
}
