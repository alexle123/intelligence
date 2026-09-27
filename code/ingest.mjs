/**
 * ingest.mjs — write X bookmarks into GBrain as `bookmarks/x/<id>` pages.
 *
 * Source, in order:
 *   1. data/bookmarks/*.json   (collect.mjs output: full bookmarks with ids, links, authors)
 *   2. XB_SEED_FILE            (xmarks .debug/last-run.json: sample tweet texts only)
 *
 * Deterministic: no model calls. Re-running updates pages in place, passing
 * the current revision as GBrain requires for replacements.
 *
 *   node code/ingest.mjs [--facts]
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { putPage, rememberSave, yamlString } from './gbrain.mjs';
import { DATA_DIR } from './x-auth.mjs';

const SEED_FILE =
  process.env.XB_SEED_FILE || path.join(process.env.HOME, 'Documents/Projects/xmarks/.debug/last-run.json');

async function loadCollected() {
  const dir = path.join(DATA_DIR, 'bookmarks');
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
}

async function loadSeed() {
  const run = JSON.parse(await readFile(SEED_FILE, 'utf8'));
  const savedAt = run.savedAt ?? null;
  return (run.fingerprint?.sampleTweets ?? []).map((text) => ({
    // No tweet id in the seed, so derive a stable one from the text.
    id: `seed-${createHash('sha256').update(text).digest('hex').slice(0, 12)}`,
    url: null,
    text,
    author: null,
    links: [],
    first_seen_at: savedAt,
    created_at: null,
  }));
}

function titleFor(b) {
  const firstLine = b.text.split('\n').find((l) => l.trim()) ?? b.text;
  const clipped = firstLine.length > 70 ? `${firstLine.slice(0, 67).trimEnd()}...` : firstLine;
  return b.author?.username ? `@${b.author.username}: ${clipped}` : clipped;
}

function toPage(b) {
  const links = (b.links ?? []).map((l) => `- [${l.kind}] ${l.title ? `${l.title}: ` : ''}${l.url}`);
  const quoted = (b.referenced ?? [])
    .filter((r) => r.text)
    .map((r) => `> ${r.type}${r.author ? ` ${r.author}` : ''}: ${r.text.replace(/\n/g, '\n> ')}`);

  return [
    '---',
    'type: bookmark',
    'source: x',
    `title: ${yamlString(titleFor(b))}`,
    `url: ${yamlString(b.url)}`,
    `author: ${yamlString(b.author?.username ? `@${b.author.username}` : null)}`,
    `posted_at: ${yamlString(b.created_at)}`,
    `saved_at: ${yamlString(b.first_seen_at)}`,
    `link_kinds: ${JSON.stringify([...new Set((b.links ?? []).map((l) => l.kind))])}`,
    '---',
    '',
    `# ${titleFor(b)}`,
    '',
    b.text,
    ...(quoted.length ? ['', ...quoted] : []),
    ...(links.length ? ['', '## Links', ...links] : []),
    '',
    b.url ? `Source: ${b.url}` : 'Source: X bookmark (imported from an earlier export; original link not kept)',
    '',
  ].join('\n');
}

async function main() {
  let bookmarks = await loadCollected();
  let source = 'data/bookmarks';
  if (bookmarks.length === 0) {
    bookmarks = await loadSeed();
    source = SEED_FILE;
  }
  if (bookmarks.length === 0) {
    console.error('No bookmarks found. Run `npm run collect`, or set XB_SEED_FILE.');
    process.exit(1);
  }

  console.log(`Ingesting ${bookmarks.length} bookmarks from ${source}`);
  const counts = { created: 0, updated: 0, failed: 0 };
  for (const b of bookmarks) {
    const slug = `bookmarks/x/${b.id}`;
    try {
      const result = putPage(slug, toPage(b));
      // --facts backfills memory facts for pages ingested before facts existed.
      if (result === 'created' || process.argv.includes('--facts')) {
        rememberSave({ slug, platform: 'x', author: b.author?.username ? `@${b.author.username}` : null, text: b.text });
      }
      counts[result] += 1;
    } catch (err) {
      counts.failed += 1;
      console.error(`  ${slug}: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
    }
  }
  console.log(`Done: ${counts.created} created, ${counts.updated} updated, ${counts.failed} failed.`);
  console.log('Check: gbrain list --type bookmark');
  if (counts.failed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
