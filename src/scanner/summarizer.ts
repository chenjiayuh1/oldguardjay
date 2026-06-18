import type { DailyScanResult, ScannerConfig } from './types';

function formatDigest(scan: DailyScanResult, config: ScannerConfig): string {
  const lines: string[] = [
    `# X 每日摘要 — ${scan.date}`,
    '',
    `掃描時間：${scan.scannedAt}`,
    `帳號數：${scan.accounts.length}`,
    '',
  ];

  const grouped = new Map<string, typeof scan.accounts>();

  for (const account of scan.accounts) {
    const key = account.group ?? 'ungrouped';
    const bucket = grouped.get(key) ?? [];
    bucket.push(account);
    grouped.set(key, bucket);
  }

  for (const [groupKey, accounts] of grouped) {
    const groupLabel = config.groups[groupKey] ?? groupKey;
    lines.push(`## ${groupLabel}`, '');

    for (const account of accounts) {
      lines.push(`### @${account.username}${account.label ? ` (${account.label})` : ''}`);

      if (account.error) {
        lines.push('', `> 擷取失敗：${account.error}`, '');
        continue;
      }

      if (account.tweets.length === 0) {
        lines.push('', '_今日無原創貼文_', '');
        continue;
      }

      for (const tweet of account.tweets) {
        const engagement = `❤️ ${tweet.metrics.likes} · 🔁 ${tweet.metrics.retweets}`;
        lines.push(
          '',
          tweet.text.replace(/\n/g, '\n> '),
          '',
          `> [連結](${tweet.url}) · ${tweet.createdAt} · ${engagement}`,
          '',
        );
      }
    }
  }

  return lines.join('\n').trim() + '\n';
}

function buildPrompt(scan: DailyScanResult, config: ScannerConfig): string {
  const digest = formatDigest(scan, config);

  return [
    'You are a concise news analyst.',
    `Write a daily briefing in ${config.summary.language}.`,
    'Prioritize themes, disagreements, and market-relevant signals.',
    'Group by topic, not by account. Link to notable tweets when useful.',
    'Keep it readable in under 5 minutes.',
    '',
    'Raw scan data:',
    digest,
  ].join('\n');
}

async function summarizeWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY for AI summary mode');
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'Produce clear, structured daily briefings with markdown headings and bullet points.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned an empty summary');
  }

  return content + '\n';
}

export async function generateSummary(
  scan: DailyScanResult,
  config: ScannerConfig,
  mode: 'digest' | 'ai' = 'digest',
): Promise<string> {
  if (mode === 'digest') {
    return formatDigest(scan, config);
  }

  const prompt = buildPrompt(scan, config);
  const summary = await summarizeWithOpenAI(prompt);

  return [
    `# X 每日摘要 — ${scan.date}`,
    '',
    `_AI 摘要 · 掃描時間 ${scan.scannedAt}_`,
    '',
    summary.trim(),
    '',
    '---',
    '',
    '## 原始貼文',
    '',
    formatDigest(scan, config),
  ].join('\n');
}