const colors = { blue: 0x3b82f6, green: 0x22c55e, purple: 0xa855f7, red: 0xef4444, gray: 0x64748b, gold: 0xeab308 };
const words = (value) => String(value || '').replaceAll('_', ' ');
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const singleLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const truncate = (value, limit) => value.length <= limit ? value : `${value.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
const markdown = (value) => value.replace(/[\\`*_{}\[\]()<>~|]/g, '\\$&');

function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 512) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    const encoded = url.href.replace(/[()]/g, (char) => char === '(' ? '%28' : '%29');
    return encoded.length <= 512 ? encoded : undefined;
  } catch {
    return undefined;
  }
}

function commitLine(commit) {
  const subject = markdown(truncate(singleLine(String(commit.message || '').split(/\r?\n/)[0]) || 'Untitled commit', 160));
  const sha = /^[a-f0-9]{7,40}$/i.test(commit.id || '') ? commit.id.slice(0, 7) : '';
  const url = safeUrl(commit.url);
  const prefix = sha ? url ? `[\`${sha}\`](${url}) ` : `\`${sha}\` ` : '';
  // Five 700-character lines leave room for even a maximum-length comparison URL.
  return prefix + truncate(subject, 700 - prefix.length).replace(/\\+(?=…$)/, '');
}

export function formatMessage(event, payload) {
  const repo = payload.repository || {};
  const action = words(payload.action);
  const embed = {
    author: { name: repo.name || repo.full_name?.split('/').pop() || 'unknown', url: repo.html_url },
    color: colors.gray,
    title: capitalize(`${words(event)} ${action}`.trim()),
    url: payload.comment?.html_url || repo.html_url,
  };

  if (event === 'push') {
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const count = Number.isSafeInteger(payload.size) ? Math.max(commits.length, payload.size) : commits.length;
    const isTag = payload.ref?.startsWith('refs/tags/');
    const ref = singleLine(payload.ref?.replace(/^refs\/(heads|tags)\//, '') || 'unknown');
    const kind = isTag ? 'tag' : 'branch';
    const compareUrl = safeUrl(payload.compare);
    const lines = payload.deleted ? [] : commits.slice(0, 5).map(commitLine);
    const remaining = count - lines.length;
    const overflow = remaining > 0 && !payload.deleted ? compareUrl
      ? `[View ${remaining} more commits](${compareUrl})`
      : `${remaining} more commits` : '';
    // Reserve space for the comparison link even with unusually long subjects or URLs.
    const subjects = truncate(lines.join('\n'), 4096 - (overflow ? overflow.length + 1 : 0));
    embed.description = [subjects, overflow].filter(Boolean).join('\n') || undefined;
    if (payload.deleted || payload.created || isTag || !count) {
      const verb = payload.deleted ? 'Deleted' : payload.created ? 'Created' : 'Updated';
      const summary = payload.created && !isTag && count ? ` · ${count} ${count === 1 ? 'commit' : 'commits'}` : '';
      embed.title = `${verb} ${kind} ${ref}${summary}`;
    } else {
      embed.title = `${payload.forced ? 'Force-pushed ' : ''}${count} ${count === 1 ? 'commit' : 'commits'} to ${ref}`;
    }
    embed.url = payload.deleted ? repo.html_url : compareUrl || repo.html_url;
    embed.color = payload.deleted ? colors.red : colors.blue;
  } else if (event === 'pull_request' || event === 'issues') {
    const item = (event === 'pull_request' ? payload.pull_request : payload.issue) || {};
    const merged = event === 'pull_request' && payload.action === 'closed' && item.merged;
    const verb = merged ? 'Merged' : capitalize(action || 'updated');
    embed.title = `${verb} ${event === 'pull_request' ? 'PR' : 'issue'} #${item.number || payload.number}: ${item.title || 'Untitled'}`;
    embed.url = item.html_url || repo.html_url;
    embed.color = merged ? colors.purple : payload.action === 'closed' ? colors.red : colors.green;
  } else if (event === 'release') {
    const release = payload.release || {};
    const tag = release.tag_name || 'untagged';
    embed.title = `${capitalize(action || 'published')} release ${tag}${release.name && release.name !== tag ? `: ${release.name}` : ''}`;
    embed.url = release.html_url || repo.html_url;
    embed.color = colors.purple;
  } else if (event === 'star') {
    embed.title = `${payload.sender?.login || 'Someone'} ${payload.action === 'deleted' ? 'unstarred' : 'starred'} the repository`;
    embed.description = `${repo.stargazers_count || 0} stars total`;
    embed.color = colors.gold;
  }

  embed.author.name = truncate(singleLine(embed.author.name), 256);
  embed.author.url = safeUrl(embed.author.url);
  embed.title = truncate(singleLine(embed.title), 256);
  embed.url = safeUrl(embed.url);
  return { allowed_mentions: { parse: [] }, embeds: [embed] };
}
