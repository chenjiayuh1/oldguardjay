import { loadDefaultAccounts, normalizeAccounts } from './lib/accounts.js';
import { DEFAULT_SETTINGS } from './lib/constants.js';
import { formatDateInTimezone } from './lib/date-utils.js';
import { toMarkdown } from './lib/export.js';
import { clearGraphqlConfigCache, loadGraphqlConfig } from './lib/graphql-config.js';
import { getXSession } from './lib/session.js';

const ALARM_NAME = 'daily-watchlist-scan';

async function getSettings() {
  const stored = await chrome.storage.sync.get({ settings: DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

async function getAccounts() {
  const stored = await chrome.storage.sync.get({ accounts: null });
  if (Array.isArray(stored.accounts) && stored.accounts.length > 0) {
    return normalizeAccounts(stored.accounts);
  }

  return loadDefaultAccounts();
}

async function ensureDefaultAccounts() {
  const stored = await chrome.storage.sync.get({ accounts: null });
  if (!Array.isArray(stored.accounts) || stored.accounts.length === 0) {
    const accounts = await loadDefaultAccounts();
    await chrome.storage.sync.set({ accounts });
  }
}

async function saveScan(result) {
  const key = `scan:${result.date}`;
  await chrome.storage.local.set({ [key]: result });
  await chrome.storage.local.set({
    lastScan: {
      date: result.date,
      scannedAt: result.scannedAt,
      tweetCount: result.tweets.length,
      accountCount: result.accountCount,
      watchedAccountCount: result.watchedAccountCount,
    },
  });
}

async function getScan(date) {
  const key = `scan:${date}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? null;
}

function findXTab(tabs) {
  return tabs.find((tab) => tab.url && /https:\/\/(x|twitter)\.com/.test(tab.url));
}

async function pingContentScript(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'PING' });
}

async function ensureContentScriptReady(tabId) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await pingContentScript(tabId);
      if (response?.ok) {
        return;
      }
    } catch {
      // Content script not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await chrome.tabs.reload(tabId);
  await waitForTabReady(tabId);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await pingContentScript(tabId);
      if (response?.ok) {
        return;
      }
    } catch {
      // Still not ready after reload.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const response = await pingContentScript(tabId);
    if (response?.ok) {
      return;
    }
  } catch (error) {
    throw new Error(
      'Extension could not attach to x.com. Open x.com/home, refresh the page, then sync again.',
    );
  }

  throw new Error(
    'Extension could not attach to x.com. Open x.com/home, refresh the page, then sync again.',
  );
}

async function sendTabMessage(tabId, message) {
  const response = await chrome.tabs.sendMessage(tabId, message);
  return response;
}

async function ensureXTab() {
  const tabs = await chrome.tabs.query({});
  const existing = findXTab(tabs);
  if (existing?.id) {
    return existing;
  }

  return chrome.tabs.create({
    url: 'https://x.com/home',
    active: false,
  });
}

async function waitForTabReady(tabId, maxWaitMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && /https:\/\/(x|twitter)\.com/.test(tab.url || '')) {
      return tab;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for x.com. Open x.com in a tab, log in, then sync again.');
}

async function setScanProgress(message) {
  await chrome.storage.local.set({
    scanProgress: {
      message,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearScanProgress() {
  await chrome.storage.local.remove('scanProgress');
}

async function fetchWatchlistForDate(date, settings, accounts) {
  const tab = await ensureXTab();

  if (!tab.id) {
    throw new Error('Could not open an X tab for scanning.');
  }

  await setScanProgress(`Opening x.com for ${accounts.length} accounts...`);

  await chrome.tabs.update(tab.id, { url: 'https://x.com/home' });
  await waitForTabReady(tab.id);
  await setScanProgress('Attaching extension to x.com...');
  await ensureContentScriptReady(tab.id);
  await setScanProgress(`Fetching posts for ${date}...`);

  clearGraphqlConfigCache();
  const [graphql, auth] = await Promise.all([loadGraphqlConfig(), getXSession()]);

  const response = await sendTabMessage(tab.id, {
    type: 'FETCH_ACCOUNTS_FOR_DAY',
    options: {
      date,
      accounts,
      auth,
      graphql,
      timeZone: settings.timezone,
      maxPagesPerAccount: settings.maxPagesPerAccount,
      includeRetweets: settings.includeRetweets,
      includeReplies: settings.includeReplies,
    },
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Failed to fetch watchlist accounts.');
  }

  return response.result;
}

async function runScan(date) {
  const settings = await getSettings();
  const accounts = await getAccounts();

  try {
    await setScanProgress(`Starting sync for ${accounts.length} accounts...`);
    const result = await fetchWatchlistForDate(date, settings, accounts);
    await saveScan(result);
    return result;
  } finally {
    await clearScanProgress();
  }
}

function scheduleDailyAlarm(settings) {
  const now = new Date();
  const next = new Date();
  next.setHours(settings.scheduleHour, settings.scheduleMinute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  chrome.alarms.create(ALARM_NAME, { when: next.getTime(), periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultAccounts();
  const settings = await getSettings();
  scheduleDailyAlarm(settings);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  try {
    const settings = await getSettings();
    const date = formatDateInTimezone(new Date(), settings.timezone);
    const result = await runScan(date);

    chrome.notifications.create(`scan-${date}`, {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/l1X0XwAAAABJRU5ErkJggg==',
      title: 'X Watchlist Scanner',
      message: `Saved ${result.tweets.length} posts from ${result.watchedAccountCount} accounts for ${date}.`,
    });
  } catch (error) {
    chrome.notifications.create('scan-error', {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/l1X0XwAAAABJRU5ErkJggg==',
      title: 'X Watchlist Scanner',
      message: error instanceof Error ? error.message : 'Daily scan failed.',
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'RUN_SCAN') {
        const settings = await getSettings();
        const date = message.date ?? formatDateInTimezone(new Date(), settings.timezone);
        const result = await runScan(date);
        sendResponse({ ok: true, result });
        return;
      }

      if (message?.type === 'GET_STATUS') {
        const settings = await getSettings();
        const accounts = await getAccounts();
        const today = formatDateInTimezone(new Date(), settings.timezone);
        const stored = await chrome.storage.local.get(['lastScan', 'scanProgress']);
        const todayScan = await getScan(message.date ?? today);
        sendResponse({
          ok: true,
          settings,
          accounts,
          lastScan: stored.lastScan ?? null,
          todayScan,
          scanProgress: stored.scanProgress ?? null,
        });
        return;
      }

      if (message?.type === 'GET_MARKDOWN') {
        const scan = await getScan(message.date);
        if (!scan) {
          sendResponse({ ok: false, error: `No scan saved for ${message.date}` });
          return;
        }
        sendResponse({ ok: true, markdown: toMarkdown(scan) });
        return;
      }

      if (message?.type === 'SAVE_SETTINGS') {
        const settings = { ...(await getSettings()), ...message.settings };
        await chrome.storage.sync.set({ settings });
        scheduleDailyAlarm(settings);
        sendResponse({ ok: true, settings });
        return;
      }

      if (message?.type === 'SAVE_ACCOUNTS') {
        const accounts = normalizeAccounts(message.accounts ?? []);
        if (accounts.length === 0) {
          sendResponse({ ok: false, error: 'Add at least one account.' });
          return;
        }
        await chrome.storage.sync.set({ accounts });
        sendResponse({ ok: true, accounts });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message type.' });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error.',
      });
    }
  })();

  return true;
});