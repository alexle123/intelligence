# intelligence: bookmarks that come back

X, TikTok, Instagram, YouTube: everything you saved "for later".

> You can offload your thinking to AI. You can't offload your understanding.
> A bookmark is understanding you offloaded to "later", and later never comes.

You save things on X to come back to them. You never do. This puts your X bookmarks
into **GBrain**, the memory every AI you use shares, and brings the right one back
**at the moment you start a task it helps with**. No folders, no review queue, no digest.

## How it works

```
X bookmarks ─▶ code/collect.mjs ─▶ code/ingest.mjs ─▶ GBrain pages (bookmarks/x/<id>, type: bookmark)
                                                              │
you type a task in Claude Code ─▶ code/resurface-hook.mjs (every prompt, ~85 ms)
                                                              │
                   Claude opens with "You saved N things for exactly this:" (0–3 picks + why)
                   then does the task. Unrelated prompt → says nothing.
```

- **Retrieval is deterministic, relevance is judgment.** The hook always hands Claude your
  bookmarks (read from GBrain's content folder), and the model only decides which ones fit.
  This is the same split as GBrain's `retrieval-reflex`, and it doesn't rely on the model
  choosing to look.
- **No embedding key needed** at this scale (under 150 bookmarks). Past that, swap the hook
  for GBrain semantic search.
- **`skills/bookmark-resurface/`** is the same behavior as a GBrain skill, for other
  harnesses connected to GBrain (passes `gbrain routing-eval`).

## Every AI you use, not just Claude Code

Each save is stored twice in GBrain: as a page (`bookmarks/<platform>/<id>`) and as a one-line
memory fact ("Alex saved a TikTok by @x: ..."). Any agent connected to GBrain over MCP
(Muse, Grok Bot, Claude, ChatGPT) finds them with the `recall` verb, and
`recall(since: "7 days ago")` gives "what did I save lately".

- **Claude Code (this repo):** `.mcp.json` registers `gbrain serve --surface verbs`, and the hook
  brings saves back without being asked.
- **Muse, Grok Bot, cloud agents:** `gbrain mcp expose --funnel` publishes this brain over
  Tailscale; then follow GBrain's `docs/guides/muse.md` / `grok-bot.md`.

## Run it

```bash
npm run ingest                 # X bookmarks → GBrain (uses data/bookmarks, else the xmarks seed)
npm run add -- "<tiktok / instagram / youtube / x link>" ["why I saved it"]   # one save at a time
npm run seed-demo              # labeled demo saves (Roblox, trip, noise); --remove to delete them
gbrain list --type bookmark    # see them in the brain
claude                         # from this folder; the hook is in .claude/settings.json
```

Live X sync (`npm run login && npm run collect`) is built, but X currently rejects the
app's OAuth login. See EXPLORATION.md §5. The demo uses 18 real bookmarks saved from an
earlier X pull.

## 60-second demo

1. **Graveyard (10s):** "How many of you have bookmarks you've never opened? Me too."
2. **Thesis (10s):** "You can offload thinking to AI, not understanding. A bookmark is
   understanding you offloaded to later. Later never comes."
3. **Ingest (10s):** `gbrain list --type bookmark`: "these are my real X bookmarks, now in GBrain."
4. **Moment 1, X (20s):** in Claude Code, type:
   `Help me plan a weekend trip to Yosemite with 6 friends: carpools, meals, who pays for what.`
   → it opens with the "Palantir for Family Trips" tweet I saved months ago, then plans.
5. **Moment 2, TikTok/Instagram (20s):**
   `Help me build my first Roblox game this weekend. Where do I start?`
   → it brings back the Roblox TikTok/Reel I saved, then helps.
   Backup prompt: `I need to record a polished demo video of my app in the next hour. What tool should I use?`
   → brings back the open-source Screen Studio bookmark.
6. **Restraint (10s):** `Write a SQL query that finds duplicate emails in my users table.`
   → no bookmarks mentioned. "It only speaks up when it's actually useful."

Close: "GBrain is the memory every AI shares. Now your bookmarks are in it, and they come back
when you can use them."
