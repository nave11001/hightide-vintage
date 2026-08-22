// Does every garment in the shipped catalogue have a photograph in this build?
//
// The site's fallbacks are only as good as the pictures they fall back to. A
// garment whose local copy was never generated shows a placeholder the moment
// Supabase stops answering, and nothing else in the build would say so.
//
// Runs before every build. It reports rather than fails: a missing photograph
// costs one card its picture, and refusing to deploy over that would take the
// whole shop down instead — the wrong trade for a business whose customers
// arrive from Instagram. Read the warning; run `npm run make-images`.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(readFileSync(join(root, 'src/catalog-snapshot.json'), 'utf8'));

/** The same mapping src/photos.ts uses: strip the extension, add .webp. */
const localFile = (path) =>
  join(root, 'assets/inventory-web', `${path.replace(/\.[^./]+$/, '')}.webp`);

const missing = [];
let total = 0;

for (const item of snapshot.items ?? []) {
  for (const path of item.ph ?? []) {
    total += 1;
    if (!existsSync(localFile(path))) missing.push(`#${item.n} ${item.b} — ${path}`);
  }
}

if (missing.length === 0) {
  console.log(`photos: ${total}/${total} in the catalogue have a local copy.`);
} else {
  console.warn(
    `\n  photos: ${missing.length} of ${total} have NO local copy.\n` +
      `  These show a placeholder whenever Supabase does not answer:\n` +
      missing.map((line) => `    - ${line}`).join('\n') +
      `\n\n  Fix: npm run make-images\n`,
  );
}
