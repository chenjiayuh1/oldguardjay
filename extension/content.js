const pendingRequests = new Map();

async function getXSession() {
  const urls = ['https://x.com/', 'https://twitter.com/'];

  for (const url of urls) {
    const ct0 = await chrome.cookies.get({ url, name: 'ct0' });
    const authToken = await chrome.cookies.get({ url, name: 'auth_token' });

    if (ct0?.value && authToken?.value) {
      return {
        ct0: ct0.value,
        authToken: authToken.value,
      };
    }
  }

  throw new Error(
    'X login cookies not found in this Chrome profile. Open x.com, sign in, refresh the page, then sync again.',
  );
}

function injectFetcher() {
  if (window.__xAccountScannerInjected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'x-account-scanner-fetcher';
    script.src = chrome.runtime.getURL('injected/fetch-accounts.js');
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load the X page fetcher.'));
    (document.head || document.documentElement).appendChild(script);
  });
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

if (!globalThis.__xAccountScannerResultListenerAdded) {
  globalThis.__xAccountScannerResultListenerAdded = true;

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
}

if (!globalThis.__xAccountScannerMessageListenerAdded) {
  globalThis.__xAccountScannerMessageListenerAdded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type !== 'FETCH_ACCOUNTS_FOR_DAY') {
      return false;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    Promise.all([injectFetcher(), getXSession()])
      .then(([, auth]) => {
        waitForResult(requestId)
          .then((result) => sendResponse({ ok: true, result }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));

        window.dispatchEvent(
          new CustomEvent('x-account-scanner-fetch', {
            detail: {
              requestId,
              options: {
                ...message.options,
                auth,
              },
            },
          }),
        );
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });
}

injectFetcher().catch(() => {});