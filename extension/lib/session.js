export async function getXSession() {
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