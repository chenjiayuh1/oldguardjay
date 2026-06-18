export const DEFAULT_ACCOUNTS = [
  'GarryTan',
  'TruthGundlach',
  'micsolana',
  'pmarca',
  'paulg',
  'austen',
  'elonmusk',
  'karpathy',
  'yunta_tsai',
  'blader',
  'friedberg',
  'kevinakwok',
  'patrickc',
  'charlesmurray',
  'SteveMillerOC',
  'MsMelChen',
  'jhong',
];

export function normalizeAccounts(input) {
  const lines = Array.isArray(input) ? input : String(input).split('\n');
  const accounts = [];
  const seen = new Set();

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      continue;
    }

    const urlMatch = line.match(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i);
    if (urlMatch) {
      line = urlMatch[1];
    }

    line = line.replace(/^@/, '').trim();
    const key = line.toLowerCase();

    if (!line || seen.has(key)) {
      continue;
    }

    seen.add(key);
    accounts.push(line);
  }

  return accounts;
}

export async function loadDefaultAccounts() {
  const response = await fetch(chrome.runtime.getURL('config/accounts.json'));
  if (!response.ok) {
    return DEFAULT_ACCOUNTS;
  }

  const payload = await response.json();
  const accounts = normalizeAccounts(payload.accounts ?? []);
  return accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;
}