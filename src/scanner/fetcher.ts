import type { AccountConfig, AccountTweets, DailyScanResult, ScannerConfig, Tweet } from './types';
import { normalizeAccount } from './config';

const API_BASE = 'https://api.x.com/2';

interface XUser {
  id: string;
  username: string;
  name: string;
}

interface XTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
}

function getBearerToken(): string {
  const token = process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error('Missing X_BEARER_TOKEN (or TWITTER_BEARER_TOKEN) in environment');
  }
  return token;
}

async function xFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getBearerToken()}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X API ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toTweet(tweet: XTweet, username: string): Tweet {
  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    url: `https://x.com/${username}/status/${tweet.id}`,
    metrics: {
      likes: tweet.public_metrics?.like_count ?? 0,
      retweets: tweet.public_metrics?.retweet_count ?? 0,
      replies: tweet.public_metrics?.reply_count ?? 0,
      quotes: tweet.public_metrics?.quote_count ?? 0,
    },
  };
}

async function lookupUsers(usernames: string[]): Promise<Map<string, XUser>> {
  const users = new Map<string, XUser>();
  const chunkSize = 100;

  for (let i = 0; i < usernames.length; i += chunkSize) {
    const chunk = usernames.slice(i, i + chunkSize);
    const query = new URLSearchParams({
      usernames: chunk.join(','),
      'user.fields': 'username,name',
    });

    const data = await xFetch<{ data?: XUser[] }>(`/users/by?${query.toString()}`);
    for (const user of data.data ?? []) {
      users.set(user.username.toLowerCase(), user);
    }

    if (i + chunkSize < usernames.length) {
      await sleep(1100);
    }
  }

  return users;
}

async function fetchUserTweets(
  user: XUser,
  startTime: string,
  endTime: string,
  maxResults: number,
): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  let paginationToken: string | undefined;

  while (tweets.length < maxResults) {
    const params = new URLSearchParams({
      max_results: String(Math.min(100, maxResults - tweets.length)),
      start_time: startTime,
      end_time: endTime,
      exclude: 'retweets,replies',
      'tweet.fields': 'created_at,public_metrics',
    });

    if (paginationToken) {
      params.set('pagination_token', paginationToken);
    }

    const data = await xFetch<{
      data?: XTweet[];
      meta?: { next_token?: string };
    }>(`/users/${user.id}/tweets?${params.toString()}`);

    for (const tweet of data.data ?? []) {
      tweets.push(toTweet(tweet, user.username));
    }

    paginationToken = data.meta?.next_token;
    if (!paginationToken || tweets.length >= maxResults) {
      break;
    }

    await sleep(1100);
  }

  return tweets;
}

function getDayWindow(date: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid date: ${date}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const findUtcMidnight = (targetYear: number, targetMonth: number, targetDay: number) => {
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
        return instant.toISOString();
      }
    }

    throw new Error(`Could not resolve timezone window for ${date} in ${timeZone}`);
  };

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    startTime: findUtcMidnight(year, month, day),
    endTime: findUtcMidnight(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
    ),
  };
}

export async function scanAccounts(
  config: ScannerConfig,
  date = new Date().toISOString().slice(0, 10),
): Promise<DailyScanResult> {
  const normalized = config.accounts.map(normalizeAccount);
  const usernames = normalized.map((account) => account.username);
  const users = await lookupUsers(usernames);
  const { startTime, endTime } = getDayWindow(date, config.summary.timezone);

  const accounts: AccountTweets[] = [];

  for (const account of normalized) {
    const user = users.get(account.username);

    if (!user) {
      accounts.push({
        username: account.username,
        label: account.label,
        group: account.group,
        tweets: [],
        error: 'User not found',
      });
      continue;
    }

    try {
      const tweets = await fetchUserTweets(
        user,
        startTime,
        endTime,
        config.summary.maxTweetsPerAccount,
      );

      accounts.push({
        username: account.username,
        label: account.label,
        group: account.group,
        tweets,
      });
    } catch (error) {
      accounts.push({
        username: account.username,
        label: account.label,
        group: account.group,
        tweets: [],
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }

    await sleep(1100);
  }

  return {
    date,
    scannedAt: new Date().toISOString(),
    accounts,
  };
}

export function listConfiguredAccounts(config: ScannerConfig): AccountConfig[] {
  return config.accounts.map(normalizeAccount);
}