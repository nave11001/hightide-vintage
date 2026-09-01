import { useEffect, useState } from 'react';
import { categoryById } from '@/shared/categories.mjs';

// The shop has two addresses: the shop itself, and one garment.
//
// That is the whole routing requirement, and it is why there is no router
// library here. react-router would add about 8KB gzipped to serve a table of
// two rows, and would want to own the tree it is mounted in. The History API
// already does this; it just needs somewhere to keep the current path.

/** The path the browser is on, kept in sync with back, forward and pushState. */
export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    // pushState and replaceState fire no event of their own, so navigate()
    // below announces itself and every listener hears it.
    window.addEventListener('hightide:navigate', sync);
    // A path that changed between first render and this effect — a redirect
    // during startup, say — would otherwise be missed entirely.
    sync();
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hightide:navigate', sync);
    };
  }, []);

  return path;
}

/**
 * Go to a path without reloading.
 *
 * `replace` rewrites the current entry instead of adding one — for turning a
 * link the visitor did not type, like the bot's ?item=, into the canonical
 * address. Pressing back should return them to wherever they came from, not to
 * the same page under its old name.
 */
export function navigate(path: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (path === current) return;

  // Only a pushed entry is stamped, and the stamp means "there is somewhere of
  // ours behind this". A replaced entry sits on top of wherever the visitor
  // arrived from, so going back would take them off the site entirely — which
  // is why closing a garment consults this rather than always calling back().
  if (options.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({ hightide: true }, '', path);

  window.dispatchEvent(new Event('hightide:navigate'));
}

/** The slug in /product/<slug>, or null anywhere else. */
export function productSlugFromPath(path: string): string | null {
  const match = /^\/product\/([^/]+)\/?$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * The category id in /category/<id>, or null.
 *
 * Unknown ids come back null rather than as themselves, so an invented address
 * shows the shop instead of an empty grid captioned with someone's typo.
 */
export function categoryFromPath(path: string): string | null {
  const match = /^\/category\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return categoryById(id) ? id : null;
}

export function categoryPath(id: string): string {
  return `/category/${id}`;
}

/** The three documents that live at their own addresses. */
export const LEGAL_PAGES = ['privacy', 'terms', 'accessibility'] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

/**
 * Which document a path names, or null.
 *
 * Their own routes rather than one page with anchors: a policy is a document,
 * and a document that cannot be linked to on its own is hard to hand to
 * anybody — a customer, a lawyer, or Google.
 */
export function legalFromPath(path: string): LegalPage | null {
  const match = /^\/(privacy|terms|accessibility)\/?$/.exec(path);
  return match ? (match[1] as LegalPage) : null;
}
