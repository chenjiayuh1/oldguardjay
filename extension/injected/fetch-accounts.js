(() => {
  if (window.__xAccountScannerInjected) {
    return;
  }
  window.__xAccountScannerInjected = true;

  const BEARER_TOKEN =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const DEFAULT_GRAPHQL = {
    queryIds: {
      UserByScreenName: '681MIj51w00Aj6dY0GXnHw',
      UserTweets: 'RyDU3I9VJtPF-Pnl6vrRlw',
    },
    features: {
      UserByScreenName: {},
      UserTweets: {},
    },
    fieldToggles: {
      UserByScreenName: { withPayments: false, withAuxiliaryUserLabels: true },
      UserTweets: { withArticlePlainText: true },
    },
  };

  let activeGraphql = DEFAULT_GRAPHQL;

  function normalizeAccounts(input) {
    const lines = Array.isArray(input) ? input : [];
    const accounts = [];
    const seen = new Set();

    for (const rawLine of lines) {
      let line = String(rawLine).trim();
      if (!line) continue;

      const urlMatch = line.match(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i);
      if (urlMatch) line = urlMatch[1];

      line = line.replace(/^@/, '').trim();
      const key = line.toLowerCase();
      if (!line || seen.has(key)) continue;

      seen.add(key);
      accounts.push(line);
    }

    return accounts;
  }

  let sessionAuth = null;

  function compactFeatures(features) {
    return Object.fromEntries(Object.entries(features).filter(([, value]) => value !== false));
  }

  function buildGraphqlUrl(operationName, variables) {
    const queryId = activeGraphql.queryIds[operationName] ?? DEFAULT_GRAPHQL.queryIds[operationName];
    const features = activeGraphql.features[operationName] ?? {};
    const fieldToggles = activeGraphql.fieldToggles[operationName] ?? {};

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(compactFeatures(features)),
    });

    if (Object.keys(fieldToggles).length > 0) {
      params.set('fieldToggles', JSON.stringify(fieldToggles));
    }

    return `https://x.com/i/api/graphql/${queryId}/${operationName}?${params.toString()}`;
  }

  function createTransactionId() {
    return [...crypto.getRandomValues(new Uint8Array(95))]
      .map((value) => {
        const index = (value / 255) * 61 | 0;
        return String.fromCharCode(index + (index > 9 ? (index > 35 ? 61 : 55) : 48));
      })
      .join('');
  }

  function getAuthHeaders(operationName, context = {}) {
    const csrfToken = sessionAuth?.ct0;
    const authToken = sessionAuth?.authToken;

    if (!csrfToken || !authToken) {
      throw new Error(
        'X session was not passed to the page fetcher. Reload the extension and try again.',
      );
    }

    const referer =
      operationName === 'UserTweets' && context.username
        ? `https://x.com/${context.username}`
        : 'https://x.com/home';

    return {
      authorization: `Bearer ${BEARER_TOKEN}`,
      'x-csrf-token': csrfToken,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'x-client-transaction-id': createTransactionId(),
      'content-type': 'application/json',
      referer,
    };
  }

  async function graphqlGet(operationName, variables, context = {}) {
    const response = await fetch(buildGraphqlUrl(operationName, variables), {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(operationName, context),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${operationName} failed (${response.status}): ${body.slice(0, 300)}`);
    }

    return response.json();
  }

  function unwrapTweet(result) {
    if (!result) return null;
    if (result.tweet) return unwrapTweet(result.tweet);
    if (result.__typename === 'TweetWithVisibilityResults') {
      return unwrapTweet(result.tweet ?? result.tweet_results?.result);
    }
    if (result.__typename === 'TweetTombstone' || result.__typename === 'TweetUnavailable') {
      return null;
    }
    return result;
  }

  function findNoteTweetText(node, depth = 0) {
    if (!node || depth > 8 || typeof node !== 'object') {
      return null;
    }

    if (node.__typename === 'NoteTweet' && typeof node.text === 'string' && node.text) {
      return node.text;
    }

    const direct =
      node.note_tweet_results?.result?.text ??
      node.note_tweet?.note_tweet_results?.result?.text;
    if (direct) {
      return direct;
    }

    for (const value of Object.values(node)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const found = findNoteTweetText(value, depth + 1);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function getTweetText(tweet) {
    const note = findNoteTweetText(tweet);
    if (note) {
      return note;
    }

    const article =
      tweet?.article?.article_results?.result?.plain_text ??
      tweet?.legacy?.extended_tweet?.full_text;
    if (article) {
      return article;
    }

    const retweeted = tweet?.legacy?.retweeted_status_result?.result;
    if (retweeted) {
      const inner = getTweetText(unwrapTweet(retweeted));
      if (inner) {
        return inner;
      }
    }

    return tweet?.legacy?.full_text ?? tweet?.legacy?.text ?? tweet?.text ?? '';
  }

  function extractTweetFromResult(result, expectedUsername) {
    const tweet = unwrapTweet(result);
    if (!tweet) return null;

    const legacy = tweet.legacy ?? {};
    const user = tweet.core?.user_results?.result;
    const username = user?.legacy?.screen_name ?? user?.core?.screen_name;
    const id = legacy.id_str ?? tweet.rest_id;
    const text = getTweetText(tweet);
    const createdAt = legacy.created_at ?? tweet.created_at;

    if (!username || !id || !createdAt) return null;

    const isRetweet = Boolean(legacy.retweeted_status_result?.result || text.startsWith('RT @'));
    const isReply = Boolean(legacy.in_reply_to_status_id_str);

    return {
      id: String(id),
      text,
      createdAt,
      username,
      displayName: user?.legacy?.name ?? user?.core?.name ?? username,
      url: `https://x.com/${username}/status/${id}`,
      metrics: {
        likes: legacy.favorite_count ?? 0,
        retweets: legacy.retweet_count ?? 0,
        replies: legacy.reply_count ?? 0,
        quotes: legacy.quote_count ?? 0,
      },
      isRetweet,
      isReply,
      watchedUsername: expectedUsername,
    };
  }

  function collectEntries(payload) {
    const user = payload?.data?.user?.result;
    const instructions =
      user?.timeline_v2?.timeline?.instructions ??
      user?.timeline?.timeline?.instructions ??
      [];

    const entries = [];

    for (const instruction of instructions) {
      if (instruction.type === 'TimelineAddEntries' && Array.isArray(instruction.entries)) {
        entries.push(...instruction.entries);
      }
      if (instruction.type === 'TimelineReplaceEntry' && instruction.entry) {
        entries.push(instruction.entry);
      }
      if (instruction.type === 'TimelinePinEntry' && instruction.entry) {
        entries.push(instruction.entry);
      }
    }

    return entries;
  }

  function parseUserTweetsResponse(payload, expectedUsername) {
    const entries = collectEntries(payload);
    const tweets = [];
    let bottomCursor = null;

    for (const entry of entries) {
      const content = entry?.content;
      if (!content) continue;

      if (content.cursorType === 'Bottom' || content.__typename === 'TimelineTimelineCursor') {
        if (content.cursorType === 'Bottom') {
          bottomCursor = content.value ?? bottomCursor;
        }
        continue;
      }

      if (content.__typename === 'TimelineTimelineItem' && content.itemContent) {
        const tweet = extractTweetFromResult(content.itemContent.tweet_results?.result, expectedUsername);
        if (tweet) tweets.push(tweet);
        continue;
      }

      if (content.__typename === 'TimelineTimelineModule' && Array.isArray(content.items)) {
        for (const moduleItem of content.items) {
          const tweet = extractTweetFromResult(
            moduleItem.item?.itemContent?.tweet_results?.result,
            expectedUsername,
          );
          if (tweet) tweets.push(tweet);
        }
      }
    }

    return { tweets, bottomCursor };
  }

  function getDayBounds(dateString, timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (!match) throw new Error(`Invalid date: ${dateString}`);

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const findUtcMidnight = (targetYear, targetMonth, targetDay) => {
      for (let utcHour = 0; utcHour < 48; utcHour += 1) {
        const instant = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, utcHour, 0, 0, 0));
        const formatted = instant.toLocaleString('en-US', {
          timeZone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        const [datePart, timePart] = formatted.split(', ');
        const [m, d, y] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (y === targetYear && m === targetMonth && d === targetDay && hour === 0 && minute === 0) {
          return instant;
        }
      }
      throw new Error(`Could not resolve timezone window for ${dateString} in ${timeZone}`);
    };

    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    return {
      start: findUtcMidnight(year, month, day),
      end: findUtcMidnight(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate()),
    };
  }

  function isWithinDay(createdAt, dateString, timeZone) {
    const created = new Date(createdAt);
    const { start, end } = getDayBounds(dateString, timeZone);
    return created >= start && created < end;
  }

  function formatDateInTimezone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  async function lookupUser(username) {
    const payload = await graphqlGet('UserByScreenName', {
      screen_name: username,
    });

    const user = payload?.data?.user?.result;
    if (!user?.rest_id) {
      throw new Error(`User @${username} not found`);
    }

    return {
      id: user.rest_id,
      username: user.legacy?.screen_name ?? user.core?.screen_name ?? username,
      displayName: user.legacy?.name ?? user.core?.name ?? username,
    };
  }

  async function fetchAccountTweetsForDays(user, options) {
    const {
      dates,
      date,
      timeZone,
      maxPagesPerAccount = 8,
      includeRetweets = true,
      includeReplies = false,
    } = options;

    const scanDates = dates ?? (date ? [date] : []);
    if (scanDates.length === 0) {
      throw new Error('No scan dates provided.');
    }

    const seen = new Set();
    const collected = [];
    let cursor = null;
    let reachedOlderThanTargetRange = false;
    const oldestDate = [...scanDates].sort()[0];
    const { start: rangeStart } = getDayBounds(oldestDate, timeZone);

    for (let page = 0; page < maxPagesPerAccount; page += 1) {
      const variables = {
        userId: user.id,
        count: 40,
        includePromotedContent: false,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
      };

      if (cursor) {
        variables.cursor = cursor;
      }

      const payload = await graphqlGet('UserTweets', variables, { username: user.username });
      const { tweets, bottomCursor } = parseUserTweetsResponse(payload, user.username);

      if (tweets.length === 0 && !bottomCursor) {
        break;
      }

      for (const tweet of tweets) {
        if (seen.has(tweet.id)) continue;
        seen.add(tweet.id);

        const created = new Date(tweet.createdAt);
        if (created < rangeStart) {
          reachedOlderThanTargetRange = true;
          continue;
        }

        const dayDate = formatDateInTimezone(created, timeZone);
        if (!scanDates.includes(dayDate)) continue;
        if (!includeRetweets && tweet.isRetweet) continue;
        if (!includeReplies && tweet.isReply) continue;

        collected.push({ ...tweet, dayDate });
      }

      if (reachedOlderThanTargetRange || !bottomCursor || bottomCursor === cursor) {
        break;
      }

      cursor = bottomCursor;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return collected;
  }

  async function fetchWatchlistForDay(options) {
    sessionAuth = options.auth ?? null;

    activeGraphql = {
      queryIds: {
        ...DEFAULT_GRAPHQL.queryIds,
        ...(options.graphql?.queryIds ?? {}),
      },
      features: {
        UserByScreenName: {
          ...DEFAULT_GRAPHQL.features.UserByScreenName,
          ...(options.graphql?.features?.UserByScreenName ?? {}),
        },
        UserTweets: {
          ...DEFAULT_GRAPHQL.features.UserTweets,
          ...(options.graphql?.features?.UserTweets ?? {}),
        },
      },
      fieldToggles: {
        UserByScreenName: {
          ...DEFAULT_GRAPHQL.fieldToggles.UserByScreenName,
          ...(options.graphql?.fieldToggles?.UserByScreenName ?? {}),
        },
        UserTweets: {
          ...DEFAULT_GRAPHQL.fieldToggles.UserTweets,
          ...(options.graphql?.fieldToggles?.UserTweets ?? {}),
        },
      },
    };

    const accounts = normalizeAccounts(options.accounts);
    if (accounts.length === 0) {
      throw new Error('Add at least one account to your watchlist.');
    }

    const collected = [];
    const accountResults = [];

    for (const username of accounts) {
      try {
        const user = await lookupUser(username);
        const tweets = await fetchAccountTweetsForDays(user, options);

        accountResults.push({
          username: user.username,
          displayName: user.displayName,
          tweetCount: tweets.length,
        });
        collected.push(...tweets);
      } catch (error) {
        accountResults.push({
          username,
          displayName: username,
          tweetCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    collected.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const scanDates = options.dates ?? (options.date ? [options.date] : []);

    return {
      date: options.date,
      scanDates,
      scannedAt: new Date().toISOString(),
      watchedAccounts: accounts,
      tweets: collected,
      accountCount: accountResults.filter((account) => account.tweetCount > 0).length,
      watchedAccountCount: accounts.length,
      accountResults,
    };
  }

  window.addEventListener('x-account-scanner-fetch', async (event) => {
    const requestId = event.detail?.requestId;
    const options = event.detail?.options ?? {};

    try {
      const result = await fetchWatchlistForDay(options);
      window.dispatchEvent(
        new CustomEvent('x-account-scanner-result', {
          detail: { requestId, ok: true, result },
        }),
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('x-account-scanner-result', {
          detail: {
            requestId,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  });
})();