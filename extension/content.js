const pendingRequests = new Map();

function injectFetcher() {
  if (document.getElementById('x-account-scanner-fetcher')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'x-account-scanner-fetcher';
  script.src = chrome.runtime.getURL('injected/fetch-accounts.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function waitForResult(requestId, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Timed out while fetching the watchlist.'));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });
  });
}

window.addEventListener('x-account-scanner-result', (event) => {
  const requestId = event.detail?.requestId;
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);

  if (event.detail?.ok) {
    pending.resolve(event.detail.result);
    return;
  }

  pending.reject(new Error(event.detail?.error ?? 'Unknown fetch error'));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FETCH_ACCOUNTS_FOR_DAY') {
    return false;
  }

  injectFetcher();

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  waitForResult(requestId)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  window.dispatchEvent(
    new CustomEvent('x-account-scanner-fetch', {
      detail: {
        requestId,
        options: message.options,
      },
    }),
  );

  return true;
});

injectFetcher();