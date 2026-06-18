import { formatDayHeading, getScanDays } from './reader.js';

export function groupTweetsByWatchedAccount(scan) {
  const order = scan.watchedAccounts ?? [];
  const grouped = new Map();

  for (const username of order) {
    grouped.set(username.toLowerCase(), {
      username,
      displayName: username,
      tweets: [],
      error: null,
    });
  }

  for (const result of scan.accountResults ?? []) {
    const bucket = grouped.get(result.username.toLowerCase()) ?? {
      username: result.username,
      displayName: result.displayName ?? result.username,
      tweets: [],
      error: null,
    };
    bucket.displayName = result.displayName ?? bucket.displayName;
    bucket.error = result.error ?? null;
    grouped.set(result.username.toLowerCase(), bucket);
  }

  for (const tweet of scan.tweets ?? []) {
    const key = (tweet.watchedUsername ?? tweet.username).toLowerCase();
    const bucket = grouped.get(key) ?? {
      username: tweet.username,
      displayName: tweet.displayName ?? tweet.username,
      tweets: [],
      error: null,
    };
    bucket.tweets.push(tweet);
    grouped.set(key, bucket);
  }

  if (order.length > 0) {
    return order.map((username) => grouped.get(username.toLowerCase())).filter(Boolean);
  }

  return [...grouped.values()].sort((a, b) => a.username.localeCompare(b.username));
}

function renderAccountMarkdown(account, { accountHeadingLevel = 2 } = {}) {
  const heading = '#'.repeat(accountHeadingLevel);
  const lines = [`${heading} @${account.username}${account.displayName ? ` (${account.displayName})` : ''}`];

  if (account.error) {
    lines.push('', `> 擷取失敗：${account.error}`, '');
    return lines;
  }

  if (account.tweets.length === 0) {
    lines.push('', '_無貼文_', '');
    return lines;
  }

  for (const tweet of account.tweets) {
    const tags = [tweet.isRetweet ? '轉推' : null, tweet.isReply ? '回覆' : null].filter(Boolean);

    lines.push(
      '',
      tweet.text.replace(/\n/g, '\n> '),
      '',
      `> [連結](${tweet.url}) · ${tweet.createdAt} · ❤️ ${tweet.metrics.likes} · 🔁 ${tweet.metrics.retweets}${
        tags.length ? ` · ${tags.join(' · ')}` : ''
      }`,
      '',
    );
  }

  return lines;
}

export function toMarkdown(scan) {
  const days = getScanDays(scan);
  const rangeLabel =
    days.length > 1 ? `${days[0]} – ${days[days.length - 1]}` : scan.date;

  const lines = [
    `# X Watchlist 摘要 — ${rangeLabel}`,
    '',
    `掃描時間：${scan.scannedAt}`,
    `追蹤帳號：${scan.watchedAccountCount ?? scan.watchedAccounts?.length ?? 0}`,
    `有貼文的帳號：${scan.accountCount ?? 0}`,
    `貼文數：${scan.tweets.length}`,
    '',
  ];

  if (days.length <= 1) {
    for (const account of groupTweetsByWatchedAccount(scan)) {
      lines.push(...renderAccountMarkdown(account));
    }
    return `${lines.join('\n').trim()}\n`;
  }

  for (const dayDate of days) {
    lines.push(`## ${formatDayHeading(dayDate, scan)}`, '');

    const dayScan = {
      ...scan,
      tweets: (scan.tweets ?? []).filter((tweet) => (tweet.dayDate ?? scan.date) === dayDate),
    };

    for (const account of groupTweetsByWatchedAccount(dayScan)) {
      lines.push(...renderAccountMarkdown(account, { accountHeadingLevel: 3 }));
    }
  }

  return `${lines.join('\n').trim()}\n`;
}