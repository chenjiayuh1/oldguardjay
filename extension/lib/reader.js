export function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function getScanDays(scan) {
  if (scan?.scanDates?.length) {
    return [...scan.scanDates].sort();
  }

  return scan?.date ? [scan.date] : [];
}

export function formatDayHeading(dayDate, scan) {
  const days = getScanDays(scan);

  if (days.length === 1) {
    return dayDate;
  }

  if (dayDate === scan.date) {
    return `Today · ${dayDate}`;
  }

  return `Yesterday · ${dayDate}`;
}

export function formatScanTitle(scan) {
  const days = getScanDays(scan);

  if (days.length <= 1) {
    return `X Watchlist — ${scan.date}`;
  }

  return `X Watchlist — ${days[0]} – ${days[days.length - 1]}`;
}

export function formatScanSubtitle(scan) {
  const days = getScanDays(scan);

  if (days.length <= 1) {
    return `${scan.tweets.length} posts · scanned ${scan.scannedAt}`;
  }

  return `${scan.tweets.length} posts from yesterday and today · scanned ${scan.scannedAt}`;
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

export function groupTweetsByDayAndAccount(scan) {
  const days = getScanDays(scan);

  return days.map((dayDate) => ({
    dayDate,
    label: formatDayHeading(dayDate, scan),
    accounts: groupTweets({
      ...scan,
      tweets: (scan.tweets ?? []).filter((tweet) => (tweet.dayDate ?? scan.date) === dayDate),
    }),
  }));
}

function renderTweetPost(tweet) {
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
}

export function renderReaderPosts(scan, { headingLevel = 2 } = {}) {
  const accountHeading = headingLevel === 3 ? 'h3' : 'h2';
  const dayHeading = headingLevel === 3 ? 'h4' : 'h3';
  const days = groupTweetsByDayAndAccount(scan);
  const multipleDays = days.length > 1;

  return days
    .map((day) => {
      const accounts = day.accounts
        .map((account) => {
          const posts = account.tweets.map((tweet) => renderTweetPost(tweet)).join('');
          const body = posts || '<p class="reader-empty">No posts</p>';

          return `
            <section class="reader-account">
              <${accountHeading}>@${escapeHtml(account.username)}</${accountHeading}>
              ${body}
            </section>
          `;
        })
        .join('');

      if (!multipleDays) {
        return accounts;
      }

      return `
        <section class="reader-day">
          <${dayHeading} class="reader-day-title">${escapeHtml(day.label)}</${dayHeading}>
          ${accounts || '<p class="reader-empty">No posts</p>'}
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
  <title>${escapeHtml(formatScanTitle(scan))}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.6; color: #18181b; }
    h1 { color: #001a57; margin-bottom: 8px; }
    h2, h3 { margin: 0 0 8px; color: #001a57; }
    h3.reader-day-title, h4.reader-day-title { margin: 0 0 12px; font-size: 16px; color: #3f3f46; }
    a { color: #2563eb; }
    .reader-day { margin-bottom: 32px; }
    .reader-account { margin-bottom: 28px; }
    .reader-post { margin: 12px 0; padding-top: 12px; border-top: 1px solid #eee; }
    .post-text { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; margin: 0 0 8px; }
    .reader-meta { margin: 0; font-size: 13px; color: #666; }
    .reader-empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>${escapeHtml(formatScanTitle(scan))}</h1>
  <p>${escapeHtml(formatScanSubtitle(scan))}</p>
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