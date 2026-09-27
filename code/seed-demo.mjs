/**
 * seed-demo.mjs — load clearly labeled demo saves into GBrain.
 *
 *   node code/seed-demo.mjs            add data-demo/saves.json as bookmarks/<platform>/demo-<n>
 *   node code/seed-demo.mjs --remove   delete those pages and their memory facts
 *
 * Demo saves use made-up @demo_* authors and carry `demo: true`, so they are
 * never mistaken for real posts. Real saves come in through `add` / `ingest`.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bookmarkPage, putPage, rememberSave } from './gbrain.mjs';
import { DATA_DIR } from './x-auth.mjs';

const GBRAIN = process.env.GBRAIN_BIN || 'gbrain';
const FACTS_FILE = path.join(DATA_DIR, 'demo-facts.json'); // fact ids, so --remove can forget them
const saves = JSON.parse(await readFile(new URL('../data-demo/saves.json', import.meta.url), 'utf8'));
const slugFor = (s, i) => `bookmarks/${s.platform}/demo-${i + 1}`;
const run = (args) => execFileSync(GBRAIN, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

async function readFactIds() {
  try {
    return JSON.parse(await readFile(FACTS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

if (process.argv.includes('--remove')) {
  const factIds = await readFactIds();
  saves.forEach((s, i) => {
    const slug = slugFor(s, i);
    try {
      const rev = JSON.parse(run(['get', slug, '--json'])).revision;
      run(['delete', slug, '--expected-revision', rev, '--purge']);
      console.log(`removed ${slug}`);
    } catch {
      // page already gone
    }
    if (factIds[slug]) {
      try {
        run(['forget', factIds[slug], '--reason', 'demo data removed']);
      } catch {
        // fact already gone
      }
    }
  });
  await writeFile(FACTS_FILE, '{}');
} else {
  const factIds = await readFactIds();
  saves.forEach((s, i) => {
    const slug = slugFor(s, i);
    const savedAt = new Date(Date.now() - s.days_ago * 86_400_000).toISOString();
    const result = putPage(slug, bookmarkPage({ ...s, savedAt, demo: true }));
    if (result === 'created') factIds[slug] = rememberSave({ slug, ...s });
    console.log(`${result} ${slug}`);
  });
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FACTS_FILE, JSON.stringify(factIds, null, 2));
}
