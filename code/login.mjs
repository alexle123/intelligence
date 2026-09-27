/**
 * login.mjs — one-time browser login to X.
 *
 * Starts a throwaway HTTP server on the host/port/path of X_CALLBACK_URL (the
 * URL already registered on the X app), opens the consent page, exchanges the
 * code, saves the token, and exits. Approvals from any login attempt in the
 * last 10 minutes are accepted, so a stale tab does not break the flow.
 */

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { config, createPkce, exchangeCode, rememberPending, saveToken, takePending } from './x-auth.mjs';

const { callbackUrl } = config();
const callback = new URL(callbackUrl);
const pkce = createPkce();
await rememberPending(pkce);

const server = createServer(async (req, res) => {
  const reqUrl = new URL(req.url, callback.origin);
  if (reqUrl.pathname !== callback.pathname) {
    res.writeHead(404).end();
    return;
  }
  const reply = (status, message) => res.writeHead(status, { 'Content-Type': 'text/plain' }).end(message);

  const error = reqUrl.searchParams.get('error');
  if (error) {
    reply(400, `X login failed: ${error}. Try the newest X tab, or re-run npm run login.`);
    console.error(`X returned error=${error} (${reqUrl.searchParams.get('error_description') ?? 'no description'}). Still waiting.`);
    return;
  }

  const verifier = await takePending(reqUrl.searchParams.get('state'));
  if (!verifier) {
    reply(400, 'This approval came from an expired login attempt. Use the newest X tab.');
    console.error('Got an approval for an unknown or expired login attempt. Still waiting.');
    return;
  }

  try {
    const token = await exchangeCode(reqUrl.searchParams.get('code'), verifier);
    await saveToken(token);
    reply(200, 'Logged in to X. You can close this tab and go back to the terminal.');
    console.log(`Logged in. Scopes granted: ${token.scope}`);
    if (!token.refresh_token) {
      console.log('No refresh token issued; you will need to log in again in ~2 hours.');
    }
    server.close();
  } catch (err) {
    reply(500, 'Token exchange failed. See the terminal.');
    console.error(`${err.message}\nStill waiting; approve again from the newest X tab.`);
  }
});

server.listen(Number(callback.port || 80), callback.hostname, () => {
  console.log(`Waiting for X on ${callback.origin}${callback.pathname}`);
  console.log(`Opening: ${pkce.url}`);
  if (process.platform === 'darwin') execFile('open', [pkce.url.toString()]);
});
