# gh-discord-bridge

A Cloudflare Worker that forwards GitHub webhook events to Discord.

## Setup

### 1. Deploy the Worker

```bash
npx wrangler deploy
```

This will output your worker URL (e.g., `https://gh-bridge.YOUR_SUBDOMAIN.workers.dev`).

### 2. Set the Discord Webhook Secret

```bash
npx wrangler secret put DISCORD_WEBHOOK
```

When prompted, paste your Discord webhook URL (e.g., `https://discord.com/api/webhooks/...`).

### 3. Configure GitHub Webhook

1. Go to your GitHub repo → **Settings** → **Webhooks** → **Add webhook**
2. Set **Payload URL** to your worker URL
3. Set **Content type** to `application/json`
4. Select which events to receive (or choose "Send me everything")
5. Save

## Notifications

Compact, repo-first Discord embeds with clickable headlines and event-colored borders. Your own activity is included; repeated actor names are omitted except for stars.

- **Push:** branch, commit count, and up to five linked short SHAs with commit subjects. Extra commits link to the full comparison. Commit bodies are omitted.
- **Pull request:** action, number, and title. Merged and closed PRs are distinct.
- **Issue:** action, number, and title.
- **Release:** action, tag, and release title without duplicate tags or release notes.
- **Star:** actor and total star count.

Branch/tag creation, deletion, and force-pushes get explicit headlines. Other events retain basic notifications with readable event/action text and a repository or comment link.

Text is bounded to Discord embed limits, commit subjects are Markdown-escaped, and notifications disable mentions.

## Tests

Requires Node.js 22 or newer. No dependencies or Discord credentials needed.

```bash
npm test
```
