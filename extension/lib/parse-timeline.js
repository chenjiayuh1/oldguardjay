function unwrapTweet(result) {
  if (!result) {
    return null;
  }

  if (result.tweet) {
    return unwrapTweet(result.tweet);
  }

  if (result.__typename === 'TweetWithVisibilityResults') {
    return unwrapTweet(result.tweet ?? result.tweet_results?.result);
  }

  if (result.__typename === 'TweetTombstone' || result.__typename === 'TweetUnavailable') {
    return null;
  }

  return result;
}

function getScreenName(userResult) {
  const user = userResult?.result ?? userResult;
  return user?.legacy?.screen_name ?? user?.core?.screen_name ?? null;
}

function getDisplayName(userResult) {
  const user = userResult?.result ?? userResult;
  return user?.legacy?.name ?? user?.core?.name ?? null;
}

export function extractTweetFromResult(result) {
  const tweet = unwrapTweet(result);
  if (!tweet?.legacy) {
    return null;
  }

  const legacy = tweet.legacy;
  const username = getScreenName(tweet.core?.user_results);
  if (!username || !legacy.id_str) {
    return null;
  }

  const retweetedStatus = legacy.retweeted_status_result?.result;
  const isRetweet = Boolean(retweetedStatus || legacy.full_text?.startsWith('RT @'));
  const isReply = Boolean(legacy.in_reply_to_status_id_str);

  return {
    id: legacy.id_str,
    text: legacy.full_text ?? '',
    createdAt: legacy.created_at,
    username,
    displayName: getDisplayName(tweet.core?.user_results) ?? username,
    url: `https://x.com/${username}/status/${legacy.id_str}`,
    metrics: {
      likes: legacy.favorite_count ?? 0,
      retweets: legacy.retweet_count ?? 0,
      replies: legacy.reply_count ?? 0,
      quotes: legacy.quote_count ?? 0,
    },
    isRetweet,
    isReply,
  };
}

function collectEntries(payload) {
  const instructions =
    payload?.data?.home?.home_timeline_urt?.instructions ??
    payload?.data?.home?.home_latest_timeline_urt?.instructions ??
    payload?.data?.home?.home_timeline_urt?.timeline?.instructions ??
    [];

  const entries = [];

  for (const instruction of instructions) {
    if (instruction.type === 'TimelineAddEntries' && Array.isArray(instruction.entries)) {
      entries.push(...instruction.entries);
      continue;
    }

    if (instruction.type === 'TimelineReplaceEntry' && instruction.entry) {
      entries.push(instruction.entry);
    }
  }

  return entries;
}

export function parseTimelineResponse(payload) {
  const entries = collectEntries(payload);
  const tweets = [];
  let bottomCursor = null;

  for (const entry of entries) {
    const content = entry?.content;
    if (!content) {
      continue;
    }

    if (content.__typename === 'TimelineTimelineCursor' || content.cursorType) {
      if (content.cursorType === 'Bottom') {
        bottomCursor = content.value ?? bottomCursor;
      }
      continue;
    }

    if (content.__typename === 'TimelineTimelineItem' && content.itemContent) {
      const tweet = extractTweetFromResult(content.itemContent.tweet_results?.result);
      if (tweet) {
        tweets.push(tweet);
      }
      continue;
    }

    if (content.__typename === 'TimelineTimelineModule' && Array.isArray(content.items)) {
      for (const moduleItem of content.items) {
        const tweet = extractTweetFromResult(moduleItem.item?.itemContent?.tweet_results?.result);
        if (tweet) {
          tweets.push(tweet);
        }
      }
    }
  }

  return { tweets, bottomCursor };
}