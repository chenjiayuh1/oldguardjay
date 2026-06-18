import { config as loadEnv } from 'dotenv';
import { loadConfig } from '../src/scanner/config';
import { scanAccounts } from '../src/scanner/fetcher';
import { generateSummary } from '../src/scanner/summarizer';
import { loadScanResult, saveScanResult, saveSummary } from '../src/scanner/storage';

loadEnv();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const date = getArg('date') ?? new Date().toISOString().slice(0, 10);
  const mode = (getArg('mode') ?? 'digest') as 'digest' | 'ai';
  const fetchOnly = hasFlag('fetch-only');
  const summarizeOnly = hasFlag('summarize-only');

  const scannerConfig = await loadConfig();

  let scan = summarizeOnly ? await loadScanResult(date) : null;

  if (!summarizeOnly) {
    console.log(`Scanning ${scannerConfig.accounts.length} accounts for ${date}...`);
    scan = await scanAccounts(scannerConfig, date);
    const dataPath = await saveScanResult(scan);
    console.log(`Saved raw scan: ${dataPath}`);
  }

  if (!scan) {
    throw new Error(`No scan data found for ${date}. Run without --summarize-only first.`);
  }

  if (fetchOnly) {
    const totalTweets = scan.accounts.reduce((sum, account) => sum + account.tweets.length, 0);
    console.log(`Fetched ${totalTweets} tweets across ${scan.accounts.length} accounts.`);
    return;
  }

  console.log(`Generating ${mode} summary...`);
  const summary = await generateSummary(scan, scannerConfig, mode);
  const summaryPath = await saveSummary(date, summary);
  console.log(`Saved summary: ${summaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});