import posthog from 'posthog-js';

// PostHog sits alongside GA4 rather than replacing it. GA4 needs a custom
// dimension registered before a parameter can be queried, and it is not
// retroactive; PostHog keeps every property on the event, so a breakdown by
// item works on data already collected.
//
// The project key is public — it can only write events, never read them —
// so it ships to the browser like the Supabase anon key does.

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// The project lives on PostHog US cloud — see the host in Project settings.
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

export const isPostHogConfigured = Boolean(key);

export function initPostHog() {
  if (!key) return; // no key locally = no events, and no console noise
  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only', // anonymous shoppers stay anonymous
    capture_pageview: true,
    capture_pageleave: true,
  });
}

export function capture(event: string, properties: Record<string, unknown> = {}) {
  if (!key) return;
  posthog.capture(event, properties);
}
