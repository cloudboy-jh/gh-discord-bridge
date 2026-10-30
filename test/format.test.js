import test from 'node:test';
import assert from 'node:assert/strict';
import * as formatter from '../src/format.js';

const repository = { name: 'gh-discord-bridge', full_name: 'cloudboy-jh/gh-discord-bridge', html_url: 'https://github.com/cloudboy-jh/gh-discord-bridge' };
const compare = `${repository.html_url}/compare/before...after`;
const commit = (i) => ({ id: String(i).padStart(40, 'a'), message: `Subject ${i}\n\nLong body`, url: `${repository.html_url}/commit/${String(i).padStart(40, 'a')}` });

test('push is one compact repo-first embed with five linked subjects and overflow', () => {
  const message = formatter.formatMessage('push', { repository, sender: { login: 'cloudboy-jh' }, ref: 'refs/heads/main', compare, commits: Array.from({ length: 7 }, (_, i) => commit(i)) });
  assert.equal(message.content, undefined);
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  assert.equal(message.embeds.length, 1);
  const embed = message.embeds[0];
  assert.equal(embed.author.name, 'gh-discord-bridge');
  assert.equal(embed.title, '7 commits to main');
  assert.equal(embed.url, compare);
  assert.equal(embed.description.split('\n').length, 6);
  assert.ok(embed.description.includes('[`aaaaaaa`]'));
  assert.ok(embed.description.includes('Subject 4'));
  assert.ok(embed.description.includes(`[View 2 more commits](${compare})`));
  assert.ok(!embed.description.includes('Long body'));
  assert.ok(!JSON.stringify(embed).includes('cloudboy-jh"'));
  assert.equal(typeof embed.color, 'number');
});

for (const [event, action, object, title] of [
  ['pull_request', 'opened', { number: 12, title: 'Compact embeds', html_url: `${repository.html_url}/pull/12` }, 'Opened PR #12: Compact embeds'],
  ['pull_request', 'closed', { number: 12, title: 'Compact embeds', merged: true, html_url: `${repository.html_url}/pull/12` }, 'Merged PR #12: Compact embeds'],
  ['pull_request', 'closed', { number: 12, title: 'Compact embeds', merged: false, html_url: `${repository.html_url}/pull/12` }, 'Closed PR #12: Compact embeds'],
  ['issues', 'reopened', { number: 3, title: 'Broken formatting', html_url: `${repository.html_url}/issues/3` }, 'Reopened issue #3: Broken formatting'],
  ['release', 'published', { tag_name: 'v1.1', name: 'Compact embeds', body: 'Do not dump these notes', html_url: `${repository.html_url}/releases/tag/v1.1` }, 'Published release v1.1: Compact embeds'],
  ['release', 'published', { tag_name: 'v1.1', name: 'v1.1', html_url: `${repository.html_url}/releases/tag/v1.1` }, 'Published release v1.1'],
]) {
  test(`${title} is a linked compact embed`, () => {
    const key = event === 'issues' ? 'issue' : event;
    const embed = formatter.formatMessage(event, { repository, action, [key]: object }).embeds[0];
    assert.equal(embed.title, title);
    assert.equal(embed.url, object.html_url);
    assert.equal(embed.description, undefined);
    assert.equal(embed.author.name, repository.name);
  });
}

test('stars and other events remain supported without raw event syntax', () => {
  const star = formatter.formatMessage('star', { repository: { ...repository, stargazers_count: 4 }, action: 'created', sender: { login: 'visitor' } }).embeds[0];
  assert.equal(star.title, 'visitor starred the repository');
  assert.equal(star.description, '4 stars total');
  const other = formatter.formatMessage('issue_comment', { repository, action: 'created', comment: { html_url: `${repository.html_url}/issues/3#issuecomment-1` } }).embeds[0];
  assert.equal(other.title, 'Issue comment created');
  assert.equal(other.url, `${repository.html_url}/issues/3#issuecomment-1`);
});

for (const [extra, title] of [
  [{ commits: [commit(1)] }, '1 commit to main'],
  [{ deleted: true, commits: [] }, 'Deleted branch main'],
  [{ created: true, commits: [] }, 'Created branch main'],
  [{ created: true, commits: [commit(1)] }, 'Created branch main · 1 commit'],
  [{ commits: [] }, 'Updated branch main'],
  [{ forced: true, commits: [commit(1)] }, 'Force-pushed 1 commit to main'],
  [{ ref: 'refs/tags/v1.1', created: true, commits: [] }, 'Created tag v1.1'],
  [{ size: 10, commits: [commit(1)] }, '10 commits to main'],
]) {
  test(`push handles ${title}`, () => {
    const embed = formatter.formatMessage('push', { repository, ref: 'refs/heads/main', compare, ...extra }).embeds[0];
    assert.equal(embed.title, title);
    if (extra.size) assert.ok(embed.description.includes('View 9 more commits'));
    if (extra.deleted) assert.equal(embed.url, repository.html_url);
    assert.notEqual(embed.description, '');
  });
}

test('untrusted text stays on one line, escaped and within Discord limits', () => {
  const subject = '**bold** [click](https://example.com) @everyone';
  const embed = formatter.formatMessage('push', { repository, ref: 'refs/heads/main', compare, commits: [{ ...commit(1), message: `${subject}\nbody` }] }).embeds[0];
  assert.ok(embed.description.includes('\\*\\*bold\\*\\*'));
  assert.ok(embed.description.includes('\\[click\\]'));
  const long = formatter.formatMessage('push', { repository, ref: `refs/heads/${'x'.repeat(500)}`, compare, commits: Array.from({ length: 7 }, (_, i) => ({ ...commit(i), message: '*'.repeat(5000) })) }).embeds[0];
  assert.ok(long.title.length <= 256);
  assert.ok(long.description.length <= 4096);
  assert.ok(long.description.includes('View 2 more commits'));
});

test('long commit links remain intact when all five subjects are oversized', () => {
  const url = `https://github.com/${'x'.repeat(493)}`;
  const embed = formatter.formatMessage('push', { repository, ref: 'refs/heads/main', compare: url, commits: Array.from({ length: 7 }, (_, i) => ({ ...commit(i), url, message: '*'.repeat(5000) })) }).embeds[0];
  assert.equal(embed.description.split(`](${url})`).length - 1, 6);
  assert.ok(embed.description.includes(`[View 2 more commits](${url})`));
  assert.ok(embed.description.length <= 4096);
});

test('missing optional data never leaks undefined or invalid links', () => {
  const message = formatter.formatMessage('push', { ref: 'refs/heads/main', commits: [{ message: 'A subject' }] });
  const encoded = JSON.stringify(message);
  assert.ok(!encoded.includes('undefined'));
  assert.equal(message.embeds[0].description, 'A subject');
});

test('non-HTTPS links are omitted and URL parentheses cannot break markdown', () => {
  const embed = formatter.formatMessage('push', { repository: { ...repository, html_url: 'javascript:alert(1)' }, compare: 'javascript:alert(1)', commits: [{ ...commit(1), url: `${repository.html_url}/commit/a(b)` }] }).embeds[0];
  assert.equal(embed.url, undefined);
  assert.equal(embed.author.url, undefined);
  assert.ok(embed.description.includes('/commit/a%28b%29)'));
});
