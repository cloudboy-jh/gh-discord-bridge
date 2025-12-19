# gh-bridge

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

## Supported Events

- **push** - Commits pushed to a branch
- **pull_request** - PR opened, closed, merged, etc.
- **issues** - Issue opened, closed, etc.
- **release** - New releases published
- **star** - Repository starred

Other events will still be forwarded with basic info (event type, repo, sender).
