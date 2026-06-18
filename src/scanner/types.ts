export interface AccountConfig {
  username: string;
  label?: string;
  group?: string;
}

export interface ScannerConfig {
  accounts: AccountConfig[];
  groups: Record<string, string>;
  summary: {
    language: string;
    timezone: string;
    maxTweetsPerAccount: number;
  };
}

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
  };
}

export interface AccountTweets {
  username: string;
  label: string;
  group?: string;
  tweets: Tweet[];
  error?: string;
}

export interface DailyScanResult {
  date: string;
  scannedAt: string;
  accounts: AccountTweets[];
}