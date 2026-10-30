import { formatMessage } from './format.js';

export default {
	async fetch(request, env) {
		if (request.method !== 'POST') {
			return new Response('ok');
		}

		const payload = await request.json();
		const event = request.headers.get('x-github-event');

		if (!event) {
			return new Response('missing x-github-event header', { status: 400 });
		}

		if (event === 'ping') {
			return new Response('pong');
		}

		const body = JSON.stringify(formatMessage(event, payload));
		
		const resp = await fetch(env.DISCORD_WEBHOOK, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		});

		await resp.body?.cancel();
		return new Response(resp.ok ? 'sent' : 'discord delivery failed', { status: resp.ok ? 200 : 502 });
	},
};
