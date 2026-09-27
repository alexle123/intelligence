/**
 * add.mjs — save any link as a bookmark page in GBrain.
 *
 *   node code/add.mjs <url> ["why I saved it"]
 *
 * TikTok and Instagram have no API for your saved list, so saves come in one
 * link at a time (copy link from Favorites / Saved). Metadata sources, no keys:
 *   TikTok, YouTube, X  public oEmbed endpoints (caption + author)
 *   Instagram, other    the page's og: tags; IG often hides them, so pass a note
 */

import { createHash } from 'node:crypto';
import { PLATFORM_LABELS as LABELS, bookmarkPage, putPage, rememberSave } from './gbrain.mjs';

const [rawUrl, ...noteParts] = process.argv.slice(2);
const note = noteParts.join(' ').trim() || null;

if (!rawUrl) {
  console.error('Usage: npm run add -- <url> ["why I saved it"]');
  process.exit(1);
}

async function resolve(url) {
  // Short links (vm.tiktok.com, youtu.be, t.co) redirect to the canonical URL.
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    return new URL(res.url || url);
  } catch {
    return new URL(url);
  }
}

function identify(url) {
  const host = url.hostname.replace(/^(www|m|vm|vt)\./, '');
  const p = url.pathname;
  if (host.endsWith('tiktok.com')) return { platform: 'tiktok', id: p.match(/\/video\/(\d+)/)?.[1] };
  if (host === 'instagram.com') return { platform: 'instagram', id: p.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1] };
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = url.searchParams.get('v') ?? p.match(/^\/(?:shorts\/|embed\/)?([\w-]{11})/)?.[1];
    return { platform: 'youtube', id };
  }
  if (host === 'x.com' || host === 'twitter.com') return { platform: 'x', id: p.match(/\/status\/(\d+)/)?.[1] };
  return { platform: 'web', id: null };
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function ogTags(url) {
  // Instagram serves preview tags to link-preview crawlers more often than to browsers.
  const res = await fetch(url, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
  const html = await res.text();
  const tag = (name) =>
    html.match(new RegExp(`<meta[^>]+property="og:${name}"[^>]+content="([^"]*)"`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${name}"`, 'i'))?.[1] ??
    null;
  const decode = (s) => s?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
  return { title: decode(tag('title')), text: decode(tag('description')) };
}

async function metadata(platform, url) {
  const u = encodeURIComponent(url.toString());
  try {
    if (platform === 'tiktok') {
      const d = await getJson(`https://www.tiktok.com/oembed?url=${u}`);
      return { text: d.title, author: d.author_unique_id ? `@${d.author_unique_id}` : d.author_name };
    }
    if (platform === 'youtube') {
      const d = await getJson(`https://www.youtube.com/oembed?url=${u}&format=json`);
      return { text: d.title, author: d.author_name };
    }
    if (platform === 'x') {
      const d = await getJson(`https://publish.twitter.com/oembed?url=${u}&omit_script=true`);
      const text = d.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
      return { text, author: d.author_url ? `@${d.author_url.split('/').pop()}` : d.author_name };
    }
    const og = await ogTags(url);
    return { text: [og.title, og.text].filter(Boolean).join(' — ') || null, author: null };
  } catch {
    return { text: null, author: null };
  }
}

async function main() {
  const url = await resolve(rawUrl);
  const { platform, id: platformId } = identify(url);
  const meta = await metadata(platform, url);

  if (!meta.text && !note) {
    console.error(
      `Couldn't read the caption from ${LABELS[platform]} (Instagram usually hides it).\n` +
        `Re-run with a note: npm run add -- "${rawUrl}" "what it is / why you saved it"`,
    );
    process.exit(1);
  }

  const id = platformId ?? createHash('sha256').update(url.toString()).digest('hex').slice(0, 12);
  const slug = `bookmarks/${platform}/${id}`;
  const page = bookmarkPage({
    platform,
    text: meta.text ?? note,
    url: url.toString(),
    author: meta.author,
    savedAt: new Date().toISOString(),
    note,
  });

  const result = putPage(slug, page);
  if (result === 'created') rememberSave({ slug, platform, author: meta.author, text: meta.text ?? note });
  console.log(`${result} ${slug}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
