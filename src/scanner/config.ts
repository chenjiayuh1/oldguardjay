import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AccountConfig, ScannerConfig } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'accounts.json');

export async function loadConfig(configPath = CONFIG_PATH): Promise<ScannerConfig> {
  const raw = await readFile(configPath, 'utf8');
  const config = JSON.parse(raw) as ScannerConfig;

  if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
    throw new Error('config/accounts.json must include at least one account');
  }

  return config;
}

export function normalizeAccount(account: AccountConfig) {
  const username = account.username.replace(/^@/, '').trim().toLowerCase();

  return {
    username,
    label: account.label ?? username,
    group: account.group,
  };
}