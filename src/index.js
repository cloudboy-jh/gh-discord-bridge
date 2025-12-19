export default {
	async fetch(request, env) {
		if (request.method !== 'POST') {
			return new Response('ok');
		}

		const payload = await request.json();
		const event = request.headers.get('x-github-event');

		if (event === 'ping') {
			return new Response('pong');
		}

		const repo = payload.repository?.full_name || 'unknown';
		const sender = payload.sender?.login || 'ghost';
		const action = payload.action ? ` (${payload.action})` : '';

		let detail = '';
		if (event === 'push') {
			const count = payload.commits?.length || 0;
			const branch = payload.ref?.replace('refs/heads/', '');
			detail = `${count} commit(s) to \`${branch}\``;
		} else if (event === 'pull_request') {
			detail = `PR #${payload.number}: ${payload.pull_request?.title}`;
		} else if (event === 'issues') {
			detail = `Issue #${payload.issue?.number}: ${payload.issue?.title}`;
		} else if (event === 'release') {
			detail = `Release: ${payload.release?.tag_name}`;
		} else if (event === 'star') {
			detail = `⭐ ${payload.repository?.stargazers_count} total`;
		}

		const message = `**${event}**${action} on \`${repo}\` by ${sender}${detail ? '\n' + detail : ''}`;

		await fetch(env.DISCORD_WEBHOOK, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: message }),
		});

		return new Response('ok');
	},
};
