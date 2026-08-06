import { createClient } from '@supabase/supabase-js';

// Both values are safe to ship to the browser. The anon key only grants what
// the row level security policies allow — public read, no writes.
// See supabase/schema.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

const BUCKET = 'inventory';

/** Public URL of a photo stored at e.g. "boardies/47.jpeg". */
export function storageUrl(path: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
