import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = { DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/test/token' };
const request = (body = {}, event = 'push') => new Request('https://bridge.test', { method: 'POST', headers: event ? { 'x-github-event': event } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('Worker sends the compact embed without filtering your own activity', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, env.DISCORD_WEBHOOK);
    sent = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  });
  const response = await worker.fetch(request({ repository: { name: 'gh-discord-bridge' }, sender: { login: 'cloudboy-jh' }, ref: 'refs/heads/main', commits: [] }), env);
  assert.equal(response.status, 200);
  assert.equal(sent.embeds[0].title, 'Updated branch main');
  assert.deepEqual(sent.allowed_mentions, { parse: [] });
  assert.equal(sent.content, undefined);
  assert.equal(await response.text(), 'sent');
});

test('Discord rejection is returned as 502', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('error', { status: 400 }));
  assert.equal((await worker.fetch(request(), env)).status, 502);
});

test('GET, ping and a missing event do not forward notifications', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  assert.equal(await (await worker.fetch(new Request('https://bridge.test'), env)).text(), 'ok');
  assert.equal(await (await worker.fetch(request({}, 'ping'), env)).text(), 'pong');
  assert.equal((await worker.fetch(request({}, null), env)).status, 400);
  assert.equal(mock.mock.callCount(), 0);
});
