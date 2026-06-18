import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DailyScanResult } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'tweets');
const SUMMARY_DIR = path.join(process.cwd(), 'summaries');

export async function saveScanResult(result: DailyScanResult): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, `${result.date}.json`);
  await writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');
  return filePath;
}

export async function loadScanResult(date: string): Promise<DailyScanResult | null> {
  const filePath = path.join(DATA_DIR, `${date}.json`);

  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as DailyScanResult;
  } catch {
    return null;
  }
}

export async function saveSummary(date: string, markdown: string): Promise<string> {
  await mkdir(SUMMARY_DIR, { recursive: true });
  const filePath = path.join(SUMMARY_DIR, `${date}.md`);
  await writeFile(filePath, markdown, 'utf8');
  return filePath;
}