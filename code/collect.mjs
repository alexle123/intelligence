/**
 * collect.mjs — pull X bookmarks into data/bookmarks/<id>.json.
 *
 * Deterministic: it fetches and normalizes, it never interprets content
 * (same split as gbrain's x-to-brain recipe: code for data, the agent for
 * judgment).
 *
 * Incremental by default. X returns bookmarks newest first, so the run stops
 * at the first page where every bookmark is already on disk. --full re-reads
 * everything. Each post read costs credits on X's pay-per-use plan, so the
 * run is capped by XB_MAX_BOOKMARKS (default 800).
 *
 *   node code/collect.mjs [--full]
 */

import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, getAccessToken, xGet } from './x-auth.mjs';

const BOOKMARKS_DIR = path.join(DATA_DIR, 'bookmarks');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MAX = Number(process.env.XB_MAX_BOOKMARKS || 800);
const COST_PER_POST = 0.005; // USD, X API pay-per-use "Posts: Read"
const full = process.argv.includes('--full');

const PARAMS = new URLSearchParams({
  max_results: '100',
  'tweet.fields':
    'created_at,author_id,conversation_id,entities,lang,note_tweet,public_metrics,referenced_tweets,attachments,article',
  expansions: 'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id',
  'media.fields': 'type,url,preview_image_url,alt_text,duration_ms',
  'user.fields': 'name,username,description',
});

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

function linkKind(url) {
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
  if (host === 'x.com' || host === 'twitter.com') return 'x';
  if (host === 'github.com') return 'github';
  if (url.pathname.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'article';
}

function extractLinks(tweet) {
  const links = [];
  for (const u of tweet.entities?.urls ?? []) {
    const href = u.unwound_url || u.expanded_url || u.url;
    if (!href) continue;
    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }
    // Media attachments show up as pic.x.com / x.com/.../photo links; skip them.
    if (u.media_key || /\/(photo|video)\/\d+$/.test(parsed.pathname)) continue;
    links.push({
      url: href,
      kind: linkKind(parsed),
      title: u.title ?? null,
      description: u.description ?? null,
    });
  }
  return links;
}

function normalize(tweet, includes, firstSeenAt) {
  const users = new Map((includes.users ?? []).map((u) => [u.id, u]));
  const tweets = new Map((includes.tweets ?? []).map((t) => [t.id, t]));
  const media = new Map((includes.media ?? []).map((m) => [m.media_key, m]));
  const author = users.get(tweet.author_id);

  const referenced = (tweet.referenced_tweets ?? []).map((ref) => {
    const t = tweets.get(ref.id);
    const refAuthor = t ? users.get(t.author_id) : null;
    return {
      type: ref.type, // quoted | replied_to | retweeted
      id: ref.id,
      author: refAuthor ? `@${refAuthor.username}` : null,
      text: t ? (t.note_tweet?.text ?? t.text) : null,
    };
  });

  return {
    id: tweet.id,
    url: `https://x.com/${author?.username ?? 'i'}/status/${tweet.id}`,
    created_at: tweet.created_at,
    first_seen_at: firstSeenAt,
    author: author
      ? { id: author.id, username: author.username, name: author.name, bio: author.description ?? null }
      : { id: tweet.author_id },
    text: tweet.note_tweet?.text ?? tweet.text,
    lang: tweet.lang,
    article_title: tweet.article?.title ?? null,
    links: extractLinks(tweet),
    media: (tweet.attachments?.media_keys ?? [])
      .map((k) => media.get(k))
      .filter(Boolean)
      .map((m) => ({ type: m.type, url: m.url ?? m.preview_image_url ?? null, alt: m.alt_text ?? null })),
    referenced,
    metrics: tweet.public_metrics ?? null,
  };
}

async function main() {
  await mkdir(BOOKMARKS_DIR, { recursive: true });
  const known = new Set((await readdir(BOOKMARKS_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

  const token = await getAccessToken();
  const me = await xGet('/2/users/me', token);
  const userId = me.data.id;
  console.log(`Collecting bookmarks for @${me.data.username} (${known.size} already on disk${full ? ', --full' : ''})`);

  const now = new Date().toISOString();
  let nextToken;
  let fetched = 0;
  let added = 0;

  while (fetched < MAX) {
    const params = new URLSearchParams(PARAMS);
    if (nextToken) params.set('pagination_token', nextToken);
    const page = await xGet(`/2/users/${userId}/bookmarks?${params}`, token);
    const data = page.data ?? [];
    fetched += data.length;

    let newOnPage = 0;
    for (const tweet of data) {
      if (known.has(tweet.id) && !full) continue;
      const file = path.join(BOOKMARKS_DIR, `${tweet.id}.json`);
      let firstSeen = now;
      if (known.has(tweet.id)) {
        firstSeen = JSON.parse(await readFile(file, 'utf8')).first_seen_at ?? now;
      } else {
        added += 1;
      }
      await writeJsonAtomic(file, normalize(tweet, page.includes ?? {}, firstSeen));
      known.add(tweet.id);
      newOnPage += 1;
    }

    console.log(`  page: ${data.length} bookmarks, ${newOnPage} written`);
    nextToken = page.meta?.next_token;
    if (!nextToken) break;
    if (!full && newOnPage === 0) break; // caught up with what we already have
  }

  if (fetched >= MAX && nextToken) {
    console.log(`Stopped at the ${MAX}-bookmark cap (XB_MAX_BOOKMARKS). More remain.`);
  }

  await writeJsonAtomic(STATE_FILE, { user: me.data.username, last_run_at: now, total_on_disk: known.size });
  console.log(`Done: ${added} new, ${known.size} total. X API cost this run: ~$${(fetched * COST_PER_POST).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
