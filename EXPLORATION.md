# Hackathon Exploration Log

Session date: 2026-09-27. A record of what we researched, the ideas we explored, the verdict on each, and where the build stopped.

---

## 1. The hackathon

Hosted by River AI, GBrain, Memorable, QM, Superset and UFO. Theme: building at the frontier of AI-native software (extending QM and GBrain, new agent workflows and interfaces, multiplayer, software factories).

### Prize tracks

| Sponsor | Prize |
|---|---|
| GBrain | Solve tedious human problems with a new skill or memory improvement |
| QM | Fork QM and make it do something new. Push the harness in any direction |
| River AI | Best use of a custom model or agent trained with the River API |
| Memorable | Most memorable: the most interesting or innovative use of Memorable |
| UFO | Best extension; best business automation for startups |
| Superset | Best agent swarm: most impressive project built with Superset Pages, running many coding agents in parallel |

### Sponsor research

| Sponsor | What it is | Useful details |
|---|---|---|
| **River AI** (river.ai) | Training and serving for open models: SFT, reinforcement learning, distillation, from Python | Models include Qwen, Kimi, GLM, DeepSeek, Nemotron. River Cloud or on-prem. Docs: docs.river.ai |
| **GBrain** (gbrain.io, github.com/garrytan/gbrain) | One memory for a team, synced to every AI (Claude, ChatGPT, Cursor) over MCP. Plain markdown files with provenance. Built by Garry Tan | Open source. Skills are markdown `SKILL.md` files. Recipes are agent-run install guides. Hosted version at gbrain.io |
| **Memorable** (memorable.sh) | Procedural memory for agents: turns an agent's tool-call trace into a reusable procedure and recalls it on similar tasks | `POST /v1/extract` takes `tool_calls[]` and returns steps plus postconditions. Stores in a local store, your GBrain DB, or QM Postgres. CLI: `npx memorable-cli` |
| **QM** (qm.ycombinator.com, github.com/yc-software/qm) | YC's multiplayer agent harness for Slack and web. Each person and room gets its own memory, files, sandbox and crons | MIT license. Harness-agnostic (Pi, OpenCode, Codex, Claude Code). `skills-seed/` includes memory, miniapp, publish |
| **Superset** (superset.sh, docs.superset.sh) | macOS app that runs many coding agents in parallel, each in its own git worktree | CLI, TypeScript SDK (`@superset_sh/sdk`, alpha), MCP server at `https://api.superset.sh/mcp`. Agent status comes from lifecycle hooks in `~/.superset/bin` |
| **Superset Pages** | Agents publish HTML pages (`superset pages publish file.html`). Teammates pin comments to elements; the watching agent gets the comment plus element context, updates and republishes | MCP covers list, get, publish, and comment reply/resolve. Open question: can a Page run JS or fetch live data? |
| **UFO** (ufo.ai, github.com/ufo-ai/ufo-core) | "Business agent operating system". Open-source runtime (Python, Apache-2.0) for team agents in chat | "Everything is an extension": tools, connectors, subagents, surfaces |

---

## 2. The original thesis

> You can offload your thinking to AI, but you can't offload your understanding.

Supporting narrative: knowledge is intelligence moving wide; understanding is intelligence moving deep. Intelligence is quantitative and can be measured (IQ); understanding is a quality and cannot. Understanding depends on awareness, not memory. Knowledge is the dots; intelligence is connecting the dots.

---

## 3. Ideas explored, in order

### 3.1 Plumb: a "depth layer" for agent-built software
Before merging agent work, ask the human explain / predict / transfer questions about the load-bearing decisions, and record depth per person in GBrain. Coined **understanding debt**: code and decisions no human understands.
- Verdict: good framing, and it evolved into 3.2 and 3.3.

### 3.2 Fog of War: an RTS view of a Superset swarm
The codebase is the map, agents are units, and fog is understanding debt. Agents capture territory, but only you can clear the fog, by answering a question about that area. The map could be a Superset Page, with pinned comments as the scout action.
- Prize fit: Superset (strong), GBrain (strong), Memorable (veterancy and tech tree from procedures).
- Verdict: the best demo concept. Parked when the direction changed.

### 3.3 GBrain skill: `understanding-audit`
Built and tested (details in section 5). A gstack `/plan-ceo-review` audit then concluded it was **nearly useless as written**:
- It is pull-based: nobody asks to be quizzed, least of all the person merging 40 agent PRs.
- It adds a chore instead of removing one, which clashes with the GBrain prize wording.
- The quiz part already exists (ChatGPT Study Mode, Claude learning modes, Claude Code Learning output style).
- Nothing reads the data yet, and team mode has a cold-start problem.
- Writing people's wrong answers into a shared brain is a trust problem.
- What was worth keeping: a per-person understanding record, tied to a commit, that goes stale when the code changes.
- Suggested fix: push-based daily "fog report", one question, private by default. **Decision: dropped it and moved on to the map.**

### 3.4 Three reframes on the thesis
Design rule taken from the narrative: the product must make you *feel* the gap, keep you *aware in the moment*, and never score you.
1. **Blackout**: "Understanding is what's left when you turn the AI off." The swarm builds, the power cuts, a bug appears, and you have 3 minutes with no AI. Best demo.
2. **Call the Play**: predict the agent's next move before it happens. Watching passively is sleep; predicting is being awake.
3. **Mirror**: import your AI chat history and map wide vs deep vs repeatedly offloaded ("you asked how to write a regex 31 times").

### 3.5 "Too many harnesses" problem statement
> ChatGPT unified the interface; now dozens of harnesses fragment it again. In a gold rush any shovel works.

Critique:
- It's an observation, not a pain.
- The shovel analogy cuts against you: shovel sellers got rich.
- The sponsors already build the obvious answers: one layer over every tool (Superset, QM, UFO) and one memory across every tool (GBrain, Memorable).
- It holds two contradictory claims (tools differ vs any shovel works).

Stronger version: if any shovel works, intelligence is a commodity, and the scarce things are **context** (GBrain and Memorable cover it) and **understanding** (uncovered).

New insight: **spreading your AI use across tools hides how much you've offloaded.** Each tool sees only a slice of your repeated questions; only a unified memory can see all 31 of them. This became "Mirror across all tools".

### 3.6 Bookmarks you never revisit (final direction)
> I bookmark across X, YouTube, TikTok, Reels, LinkedIn and things people send me, and never come back to them.

- Real problem: saving isn't hard. **Nothing brings bookmarks back at the moment they'd be useful.**
- Thesis link: a bookmark is the original form of offloading ("I'll understand this later"). Summarizing bookmarks with AI just offloads them again.
- Product: bring bookmarks back **based on what you're doing right now**. When you start a task in any AI connected to GBrain, show at most 3 relevant saves and why. Readwise brings items back on a schedule, not by relevance.
- Focus: **X first** (where most bookmarks are), with YouTube links inside tweets handled by GBrain's existing `media-ingest`.
- Prize fit: GBrain's "solve tedious human problems with a new skill or memory improvement" almost word for word.
- Verdict: good, doable, shippable in a day. The novel part is relevance-based resurfacing; import alone is table stakes.

---

## 4. Technical findings

### GBrain
- **Install:** `bun install -g github:garrytan/gbrain` failed with a missing patch file (`patches/postgres@3.4.9.patch`). The documented fallback worked: clone to `~/gbrain`, then `bun install && bun link`. Now at **v0.59.0.0**.
- **Local brain:** `gbrain init --pglite --no-embedding` gives keyless PGLite with search mode `conservative`.
  - Semantic search needs an embedding key: Voyage (the default) or OpenAI.
  - Keyword search did not find a page written moments earlier. `gbrain list --type <type>` did.
- **Page writes:** `gbrain put <slug> < file.md` creates a page. **Replacing an existing page needs `--expected-revision <rev>`**, taken from `gbrain get <slug> --json | jq -r .revision`. Without it the write is rejected with `revision_conflict`. The same applies to `delete`.
- **Skill format:** `skills/<name>/SKILL.md` with frontmatter (`name`, `version`, `description`, `triggers`, `tools`, `mutating`, `writes_pages`, `writes_to`).
  - The conformance test requires `## Contract`, `## Anti-Patterns` and `## Output Format` sections.
  - Routing tests go in `routing-eval.jsonl`; `gbrain routing-eval` runs them.
- **Skillpacks:** a repo with `skillpack.json` (`api_version: gbrain-skillpack-v1`; `homepage` is required) plus `skills/`. Install with `gbrain skillpack scaffold <owner/repo | ./dir>`.
- **Recipes:** `recipes/<id>.md` are install guides for an agent, not shipped code. Code-bearing recipes follow `recipes/agent-voice/` (`code/`, `skills/`, `install/manifest.json`, `tests/`, `package.json`).
- **Relevant existing skills and recipes:**
  - `idea-ingest` (links and tweets), `media-ingest` (YouTube, video, PDF), `article-enrichment`, `capture`, `chat-connectors` (ChatGPT and Claude history), `briefing`, `concept-synthesis`.
  - **`x-to-brain`** recipe: timeline, mentions and keyword search via an app-only Bearer token. **It does not cover bookmarks**, and it ships no collector code (the agent writes it).
  - **`retrieval-reflex`**: injects page pointers when a *name* (person or company) appears in your message. Not topic- or task-based, which is the gap resurfacing would fill.
- Init also offered "ambient memory writeback" (`gbrain config set memory.auto_writeback salient`). Not enabled.

### X API
- **Pricing:** pay-per-use, no subscription. Posts: Read costs **$0.005 per post**, so 145 bookmarks is about $0.73 and 1,000 about $5. Capped at 3M post reads per month.
- **Bookmarks endpoint:** `GET /2/users/{id}/bookmarks`, max 100 per page with `pagination_token`. Needs an **OAuth 2.0 user token** with scopes `bookmark.read tweet.read users.read`. Add `offline.access` for a refresh token.
- The xmarks config defaults to an 800-bookmark cap (possibly an X limit; not verified).

### Existing project: `~/Documents/Projects/xmarks`
- A Next.js "bookmark roaster": X OAuth 2.0 PKCE login, bookmark fetch, a Grok roast, and a shareable poster card.
- The X app was set up at console.x.com with callback `http://127.0.0.1:3000/api/auth/x/callback` and scopes `users.read tweet.read bookmark.read`.
- On 2026-06-06 it pulled **145 bookmarks for @balexle** (not truncated). Top terms included claude, build, product, design and video.
- Its bookmark fetch only requests `created_at, entities, lang`, so it misses long posts, quotes and media.

---

## 5. What got built

### `~/Documents/Projects/fog-of-war/` (dropped)
A GBrain skillpack with the `understanding-audit` skill.
- Passed 9/9 routing evals and the conformance sections.
- Installed cleanly with `gbrain skillpack scaffold`.
- A test page round-tripped through the brain and was then purged.
- Known issues: the links to `../conventions/*.md` don't exist in the pack, and no live quiz was ever run.

### This repo: `~/Documents/Projects/intelligence/` (X bookmarks collector, unfinished)

| File | Purpose |
|---|---|
| `code/x-auth.mjs` | OAuth 2.0 PKCE, a 0600 token store in `data/token.json`, refresh-token support, `X_SCOPES` override, `xGet` with credit and rate-limit hints, and pending logins remembered for 10 minutes (`data/pending-auth.json`) so stale tabs still work |
| `code/login.mjs` | A temporary local server on the registered callback URL. Opens the consent page and saves the token. Keeps waiting on errors or unknown approvals |
| `code/collect.mjs` | Paginated, incremental bookmark pull (stops when it reaches known IDs; `--full` re-reads everything) with fuller fields (note_tweet, article, referenced tweets, media, link unwinding). Links are classified as youtube / article / github / pdf / x. Writes are atomic to `data/bookmarks/<id>.json` plus `data/state.json`. Capped by `XB_MAX_BOOKMARKS` (default 800), and prints the run cost |
| `package.json` | `npm run login`, `npm run collect` (Node 20.6+ `--env-file`) |
| `.env` / `.env.example` | The three X credentials copied from xmarks. `.env` and `data/` are gitignored |

**Status: blocked at X login.** X's consent page shows *"Something went wrong. You weren't able to give access to the App."*
- No callback ever reached the local server, so X rejects the request on its side.
- It happens with and without `offline.access`, so scope is not the cause.
- A leftover "state mismatch" callback earlier was most likely a stale redirect, not a successful approval.
- Likely causes, unverified, probably from X's move to the pay-per-use console since June:
  1. The callback URL is no longer registered exactly.
  2. OAuth 2.0 user authentication is off, or the app type isn't "Web App".
  3. The app isn't attached to a project with credits.
- Checking the console with gstack browse didn't work out:
  - Chrome cookies live under `Profile 1`–`Profile 5`, which the direct import can't read.
  - Arc was blocked at the Keychain.
  - x.com didn't show up in the cookie picker.
  - The session was stopped before the handoff login finished.
- Next step for whoever resumes: open console.x.com → app → **User authentication settings** and check those three items. Or run xmarks (`npm run dev` in `~/Documents/Projects/xmarks`) to see whether the known-good code fails too.

---

## 6. If resumed: planned build for X bookmarks into GBrain

```
X bookmarks API ─▶ collect.mjs ─▶ data/bookmarks/*.json
                                    │
            ingest: one GBrain page per bookmark (bookmarks/x/<id>)
              ├─ YouTube links → media-ingest
              ├─ article links → idea-ingest / article-enrichment
              └─ "why I saved it" (agent's best guess, correctable)
                                    │
  task starts in Claude / Cursor / ChatGPT (via GBrain MCP)
                                    │
          bookmark-resurface skill → at most 3 relevant saves, with why
```

**Remaining pieces:**
1. Unblock X login (section 5).
2. `code/ingest.mjs`: JSON to markdown pages via `gbrain put`, tagging links for the right skill.
3. An embedding key (OpenAI or Voyage) for semantic matching.
4. `skills/bookmark-resurface/SKILL.md`, plus the MCP hookup: `claude mcp add gbrain -- gbrain serve --surface verbs`.
5. Package it as a recipe (`x-bookmarks-to-brain.md` plus `install/manifest.json`, `tests/`, README) in the `agent-voice` style, optionally as a PR to garrytan/gbrain.
6. Demo: "N saved, few ever opened" → live import → start a real task in Claude → a months-old bookmark comes back.

---

## 7. Leftovers on this machine

- `~/gbrain`: GBrain source, linked as the `gbrain` CLI.
- `~/.gbrain/`: the local PGLite brain (empty apart from the bundled memory skills).
- `~/Documents/Projects/fog-of-war/`: the dropped skillpack (a git repo with no commits).
- `~/Documents/Projects/intelligence/`: this repo (a git repo with no commits). `.env` holds live X credentials; don't commit it.
- gstack upgrade available: 1.47 → 1.91 (`/gstack-upgrade`).
