/**
 * x-auth.mjs — OAuth 2.0 (PKCE) for the X API, with a local token store.
 *
 * Bookmarks are private, so they need a user-context token (the app-only
 * Bearer token used by the x-to-brain recipe cannot read them). We request
 * offline.access so later syncs can refresh without another browser login.
 *
 * The token file holds a live credential: it is written 0600 and never logged.
 */

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const X_API = 'https://api.x.com';
const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
// offline.access yields a refresh token. Override with X_SCOPES if the app
// rejects it (X then shows "You weren't able to give access to the App").
export const SCOPES = process.env.X_SCOPES?.trim() || 'tweet.read users.read bookmark.read offline.access';

export const DATA_DIR = path.resolve(process.env.XB_DATA_DIR || 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'token.json');

export function config() {
  const clientId = process.env.X_CLIENT_ID;
  const callbackUrl = process.env.X_CALLBACK_URL;
  if (!clientId || !callbackUrl) {
    throw new Error('Missing X_CLIENT_ID or X_CALLBACK_URL. Copy .env.example to .env and fill it in.');
  }
  return { clientId, clientSecret: process.env.X_CLIENT_SECRET, callbackUrl };
}

export function createPkce() {
  const { clientId, callbackUrl } = config();
  const state = randomBytes(16).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return { state, verifier, url };
}

async function tokenRequest(params) {
  const { clientId, clientSecret } = config();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  // Confidential clients authenticate with Basic; public clients send client_id only.
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }
  const res = await fetch(`${X_API}/2/oauth2/token`, {
    method: 'POST',
    headers,
    body: new URLSearchParams({ client_id: clientId, ...params }).toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`X token request failed (${res.status}): ${body}`);
  const token = JSON.parse(body);
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    expires_at: Date.now() + (token.expires_in ?? 7200) * 1000,
  };
}

export function exchangeCode(code, verifier) {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config().callbackUrl,
    code_verifier: verifier,
  });
}

// Every authorize URL we hand out is remembered for 10 minutes, so approving
// from an older browser tab (a previous login attempt) still completes.
const PENDING_FILE = path.join(DATA_DIR, 'pending-auth.json');
const PENDING_TTL_MS = 10 * 60 * 1000;

async function readPending() {
  try {
    const all = JSON.parse(await readFile(PENDING_FILE, 'utf8'));
    return all.filter((p) => Date.now() - p.created_at < PENDING_TTL_MS);
  } catch {
    return [];
  }
}

export async function rememberPending({ state, verifier }) {
  await mkdir(DATA_DIR, { recursive: true });
  const pending = [...(await readPending()), { state, verifier, created_at: Date.now() }];
  await writeFile(PENDING_FILE, JSON.stringify(pending), { mode: 0o600 });
}

/** Returns the PKCE verifier for a state we issued recently, or null. */
export async function takePending(state) {
  const pending = await readPending();
  const match = pending.find((p) => p.state === state);
  if (!match) return null;
  await writeFile(PENDING_FILE, JSON.stringify(pending.filter((p) => p !== match)), { mode: 0o600 });
  return match.verifier;
}

export async function saveToken(token) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${TOKEN_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(token, null, 2), { mode: 0o600 });
  await rename(tmp, TOKEN_FILE);
}

/** Returns a usable access token, refreshing it if it expires within a minute. */
export async function getAccessToken() {
  let token;
  try {
    token = JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
  } catch {
    throw new Error('Not logged in to X. Run: npm run login');
  }
  if (token.expires_at - Date.now() > 60_000) return token.access_token;
  if (!token.refresh_token) {
    throw new Error('X token expired and there is no refresh token. Run: npm run login');
  }
  const next = await tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
  // X rotates refresh tokens; keep the old one only if a new one was not issued.
  await saveToken({ ...next, refresh_token: next.refresh_token ?? token.refresh_token });
  return next.access_token;
}

export async function xGet(pathAndQuery, accessToken) {
  const res = await fetch(`${X_API}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.text();
  if (!res.ok) {
    const hint = /credits/i.test(body)
      ? ' Your X developer account is out of credits: top up at console.x.com.'
      : res.status === 429
        ? ' Rate limited: wait 15 minutes and re-run.'
        : '';
    throw new Error(`X API ${res.status} on ${pathAndQuery.split('?')[0]}.${hint}\n${body}`);
  }
  return JSON.parse(body);
}
