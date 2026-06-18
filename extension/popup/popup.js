async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response === undefined) {
    throw new Error('No response from extension background. Reload the extension and try again.');
  }
  return response;
}

function setBusy(isBusy) {
  document.getElementById('sync-btn').disabled = isBusy;
  document.getElementById('export-btn').disabled = isBusy;
}

function setStatusMessage(message) {
  document.getElementById('status-message').textContent = message;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function accountsToText(accounts) {
  return accounts.map((username) => `https://x.com/${username}`).join('\n');
}

function applySettings(settings, accounts) {
  document.getElementById('accounts').value = accountsToText(accounts);
  document.getElementById('timezone').value = settings.timezone;
  document.getElementById('schedule-hour').value = String(settings.scheduleHour);
  document.getElementById('schedule-minute').value = String(settings.scheduleMinute);
  document.getElementById('include-retweets').checked = settings.includeRetweets;
  document.getElementById('include-replies').checked = settings.includeReplies;
}

function readSettingsPatch() {
  return {
    timezone: document.getElementById('timezone').value,
    scheduleHour: Number(document.getElementById('schedule-hour').value),
    scheduleMinute: Number(document.getElementById('schedule-minute').value),
    includeRetweets: document.getElementById('include-retweets').checked,
    includeReplies: document.getElementById('include-replies').checked,
  };
}

function renderStatus(payload) {
  const today = payload.todayScan?.date ?? payload.lastScan?.date ?? '—';
  document.getElementById('today-date').textContent = today;
  document.getElementById('tweet-count').textContent = String(
    payload.todayScan?.tweets?.length ?? payload.lastScan?.tweetCount ?? 0,
  );
  document.getElementById('account-count').textContent = String(
    payload.accounts?.length ?? payload.lastScan?.watchedAccountCount ?? 0,
  );

  if (payload.scanProgress?.message) {
    setStatusMessage(payload.scanProgress.message);
    return;
  }

  if (payload.lastScan?.scannedAt) {
    setStatusMessage(
      `Last sync: ${new Date(payload.lastScan.scannedAt).toLocaleString()}. Use Export markdown to save a file.`,
    );
    return;
  }

  setStatusMessage('Sign in to x.com, then sync. Posts stay in the extension until you export.');
}

async function refreshStatus() {
  const response = await sendMessage({ type: 'GET_STATUS' });
  if (!response?.ok) {
    setStatusMessage(response?.error ?? 'Could not load status.');
    return;
  }

  applySettings(response.settings, response.accounts);
  renderStatus(response);
}

document.getElementById('sync-btn').addEventListener('click', async () => {
  setBusy(true);
  setStatusMessage('Syncing watchlist accounts...');

  try {
    const response = await sendMessage({ type: 'RUN_SCAN' });
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Sync failed.');
    }

    const errors = (response.result.accountResults ?? []).filter((account) => account.error);
    if (response.result.tweets.length === 0 && errors.length > 0) {
      const sample = errors
        .slice(0, 2)
        .map((account) => `@${account.username}: ${account.error}`)
        .join(' | ');
      throw new Error(`${errors.length} account fetch errors. ${sample}`);
    }

    const errorNote = errors.length ? ` (${errors.length} account errors)` : '';
    setStatusMessage(
      `Saved ${response.result.tweets.length} posts from ${response.result.watchedAccountCount} accounts for ${response.result.date}.${errorNote}`,
    );
    await refreshStatus();
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : 'Sync failed.');
  } finally {
    setBusy(false);
  }
});

document.getElementById('export-btn').addEventListener('click', async () => {
  setBusy(true);

  try {
    const status = await sendMessage({ type: 'GET_STATUS' });
    const date = status?.todayScan?.date ?? status?.lastScan?.date;
    if (!date) {
      throw new Error('No saved scan to export yet.');
    }

    const response = await sendMessage({ type: 'GET_MARKDOWN', date });
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Export failed.');
    }

    downloadText(`${date}-watchlist.md`, response.markdown);
    setStatusMessage(`Exported ${date}-watchlist.md`);
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : 'Export failed.');
  } finally {
    setBusy(false);
  }
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  setBusy(true);

  try {
    const accountsText = document.getElementById('accounts').value;
    const accountsResponse = await sendMessage({
      type: 'SAVE_ACCOUNTS',
      accounts: accountsText.split('\n'),
    });

    if (!accountsResponse?.ok) {
      throw new Error(accountsResponse?.error ?? 'Could not save watchlist.');
    }

    const settingsResponse = await sendMessage({
      type: 'SAVE_SETTINGS',
      settings: readSettingsPatch(),
    });

    if (!settingsResponse?.ok) {
      throw new Error(settingsResponse?.error ?? 'Could not save settings.');
    }

    setStatusMessage(`Saved ${accountsResponse.accounts.length} accounts.`);
    await refreshStatus();
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : 'Could not save watchlist.');
  } finally {
    setBusy(false);
  }
});

refreshStatus().catch((error) => {
  setStatusMessage(error instanceof Error ? error.message : 'Could not load status.');
});