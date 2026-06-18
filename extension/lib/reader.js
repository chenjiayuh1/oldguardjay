export function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function groupTweets(scan) {
  const order = scan.watchedAccounts ?? [];
  const grouped = new Map();

  for (const username of order) {
    grouped.set(username.toLowerCase(), { username, displayName: username, tweets: [] });
  }

  for (const tweet of scan.tweets ?? []) {
    const key = (tweet.watchedUsername ?? tweet.username).toLowerCase();
    const bucket = grouped.get(key) ?? {
      username: tweet.username,
      displayName: tweet.displayName ?? tweet.username,
      tweets: [],
    };
    bucket.tweets.push(tweet);
    grouped.set(key, bucket);
  }

  if (order.length > 0) {
    return order.map((username) => grouped.get(username.toLowerCase())).filter(Boolean);
  }

  return [...grouped.values()];
}

export function renderReaderPosts(scan) {
  const accounts = groupTweets(scan);

  return accounts
    .map((account) => {
      const posts = account.tweets
        .map((tweet) => {
          const tags = [tweet.isRetweet ? '轉推' : null, tweet.isReply ? '回覆' : null].filter(Boolean);

          return `
            <article class="reader-post">
              <p class="post-text">${escapeHtml(tweet.text)}</p>
              <p class="reader-meta">
                <a class="open-on-x" href="${escapeHtml(tweet.url)}" target="_blank" rel="noopener noreferrer">Open on X</a>
                · ${escapeHtml(tweet.createdAt)}
                · ❤️ ${tweet.metrics.likes} · 🔁 ${tweet.metrics.retweets}
                ${tags.length ? ` · ${tags.join(' · ')}` : ''}
              </p>
            </article>
          `;
        })
        .join('');

      return `
        <section class="reader-account">
          <h2>@${escapeHtml(account.username)}</h2>
          ${posts || '<p class="reader-empty">No posts today</p>'}
        </section>
      `;
    })
    .join('');
}

export function renderReaderDocument(scan) {
  const body = renderReaderPosts(scan);

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <base target="_blank" />
  <title>X Watchlist — ${escapeHtml(scan.date)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.6; color: #18181b; }
    h1 { color: #001a57; margin-bottom: 8px; }
    h2 { margin: 0 0 8px; color: #001a57; font-size: 18px; }
    a { color: #2563eb; }
    .reader-account { margin-bottom: 28px; }
    .reader-post { margin: 12px 0; padding-top: 12px; border-top: 1px solid #eee; }
    .post-text { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; margin: 0 0 8px; }
    .reader-meta { margin: 0; font-size: 13px; color: #666; }
    .reader-empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>X Watchlist — ${escapeHtml(scan.date)}</h1>
  <p>${scan.tweets.length} posts · scanned ${escapeHtml(scan.scannedAt)}</p>
  ${body}
  <script>
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a.open-on-x');
      if (!link) return;
      event.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    });
  </script>
</body>
</html>`;
}