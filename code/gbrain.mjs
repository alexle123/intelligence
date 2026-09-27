/**
 * gbrain.mjs — the two page operations the ingesters need, via the gbrain CLI.
 * Replacing an existing page requires its current revision, so `putPage`
 * reads it first.
 */

import { execFileSync } from 'node:child_process';

const GBRAIN = process.env.GBRAIN_BIN || 'gbrain';

function currentRevision(slug) {
  try {
    const out = execFileSync(GBRAIN, ['get', slug, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out).revision ?? null;
  } catch {
    return null; // page does not exist yet
  }
}

/** Creates or replaces a page. Returns 'created' or 'updated'. */
export function putPage(slug, markdown) {
  const rev = currentRevision(slug);
  const args = ['put', slug, ...(rev ? ['--expected-revision', rev] : [])];
  execFileSync(GBRAIN, args, { input: markdown, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe'] });
  return rev ? 'updated' : 'created';
}

/**
 * Records a save as a memory fact, alongside its page.
 *
 * Why both: agents in other harnesses (Muse, Grok Bot, Claude.ai) reach the
 * brain through the MCP `recall` verb. Its response leads with the facts arm
 * (`facts`, `total`); with only pages, agents read `total: 0` as "nothing
 * saved" and stop. A one-line fact per save fixes that, and lets
 * `recall(since: "7 days ago")` answer "what did I save lately".
 * Call only when a page is first created: without an embedding provider,
 * duplicate detection is degraded, so re-runs would stack duplicates.
 */
export function rememberSave({ slug, platform, author, text }) {
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
  const who = process.env.XB_OWNER || 'the user';
  const fact = `${who} saved a ${PLATFORM_LABELS[platform] ?? platform} post${author ? ` by ${author}` : ''}: "${snippet}" (page ${slug})`;
  const out = execFileSync(
    GBRAIN,
    ['remember', fact, '--provenance', `bookmark save: ${slug}`, '--entity', process.env.XB_OWNER_ENTITY || 'people/me', '--kind', 'event'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out.match(/fact #(\d+)/)?.[1] ?? null;
}

/** JSON strings are valid YAML scalars, which keeps frontmatter escaping trivial. */
export const yamlString = (value) => JSON.stringify(value ?? null);

export const PLATFORM_LABELS = { x: 'X', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', web: 'the web' };

/** Markdown for one bookmark page (type: bookmark), shared by add and seed-demo. */
export function bookmarkPage({ platform, text, url = null, author = null, savedAt, note = null, demo = false }) {
  const firstLine = text.split('\n').find((l) => l.trim()) ?? text;
  const title = `${author ? `${author}: ` : ''}${firstLine.length > 70 ? `${firstLine.slice(0, 67).trimEnd()}...` : firstLine}`;
  return [
    '---',
    'type: bookmark',
    `source: ${platform}`,
    `title: ${yamlString(title)}`,
    `url: ${yamlString(url)}`,
    `author: ${yamlString(author)}`,
    `saved_at: ${yamlString(savedAt)}`,
    `note: ${yamlString(note)}`,
    ...(demo ? ['demo: true'] : []),
    '---',
    '',
    `# ${title}`,
    '',
    text,
    ...(note && note !== text ? ['', `Why I saved it: ${note}`] : []),
    '',
    `Source: ${PLATFORM_LABELS[platform] ?? platform} save${url ? `, ${url}` : ''}${demo ? ' (demo data)' : ''}`,
    '',
  ].join('\n');
}
