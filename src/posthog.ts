// PostHog sits alongside GA4 rather than replacing it. GA4 needs a custom
// dimension registered before a parameter can be queried, and it is not
// retroactive; PostHog keeps every property on the event, so a breakdown by
// item works on data already collected.
//
// The project key is public — it can only write events, never read them —
// so it ships to the browser like the Supabase anon key does.
//
// It is loaded *after* the shop is on screen. The library is 80KB gzipped, the
// largest thing the site downloads, and a shopper waiting on a measurement tool
// is the wrong trade. Nothing is lost by waiting: events raised in the meantime
// queue below and are replayed with the times they actually happened.
//
// items.views is filled from these events by scripts/sync_top_wanted.py, and
// that is what orders the Most Wanted rail — so a dropped event is not a
// missing statistic, it is the wrong garment on the homepage. Hence the queue
// rather than a shrug.

import type posthog from 'posthog-js';

type PostHog = typeof posthog;

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// The project lives on PostHog US cloud — see the host in Project settings.
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

export const isPostHogConfigured = Boolean(key);

/** Set once the library is in and initialised. Until then, capture() queues. */
let client: PostHog | null = null;

interface Queued {
  event: string;
  properties: Record<string, unknown>;
  at: Date;
}

// Bounded on purpose. If the import never resolves — offline, blocked by an
// extension, a bad deploy — this must not grow for as long as the tab is open.
// Fifty is far more than a real visit produces before the page has painted.
const MAX_QUEUED = 50;
let queue: Queued[] = [];
let started = false;

/**
 * Load the library and replay anything that happened while it was on its way.
 *
 * Runs on the browser's idle time, with a deadline: idle callbacks are not
 * guaranteed to fire on a busy page, and the timeout is what makes this a
 * postponement rather than a maybe.
 */
export function initPostHog() {
  if (!key || started) return; // no key locally = no events, and no console noise
  started = true;

  const load = async () => {
    try {
      const module = await import('posthog-js');
      const instance = module.default;
      instance.init(key, {
        api_host: host,
        person_profiles: 'identified_only', // anonymous shoppers stay anonymous
        capture_pageview: true,
        capture_pageleave: true,

        // Three further bundles PostHog fetches by default, on top of the
        // library itself, none of which this shop has any use for. Measured on
        // the live site: surveys.js 98KB, dead-clicks-autocapture.js 18KB,
        // web-vitals.js 7KB — 123KB, more than the whole of this site's own
        // JavaScript, downloaded by every visitor to power a survey that does
        // not exist, a rage-click report nobody reads, and a speed metric GA4
        // already sends.
        //
        // None of this is the measurement. Pageviews, product views and the
        // WhatsApp clicks are captured by the library above and are untouched
        // — which matters, because items.views is what orders the Most Wanted
        // rail on the homepage.
        disable_surveys: true,
        capture_dead_clicks: false,
        capture_performance: { web_vitals: false },
      });
      client = instance;

      // Replay in the order they happened, each stamped with its real time, so
      // a session reads the same as if the library had been here all along.
      const pending = queue;
      queue = [];
      for (const item of pending) {
        client.capture(item.event, item.properties, { timestamp: item.at });
      }
    } catch {
      // Blocked or offline. Drop the queue rather than hold it forever: this is
      // analytics, and the shop does not depend on it.
      queue = [];
    }
  };

  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  }).requestIdleCallback;

  // Wait for load, so the library competes with nothing the shopper is waiting
  // for. If the page is already loaded — a soft navigation, a warm cache — go
  // straight to the idle queue.
  const begin = () => (idle ? idle(load, { timeout: 3000 }) : window.setTimeout(load, 1200));
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
}

export function capture(event: string, properties: Record<string, unknown> = {}) {
  if (!key) return;

  if (client) {
    client.capture(event, properties);
    return;
  }

  // Oldest first is what gets dropped past the cap: by then the tail is what
  // the visitor is actually doing.
  if (queue.length >= MAX_QUEUED) queue.shift();
  queue.push({ event, properties, at: new Date() });
}
