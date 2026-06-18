const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

const TARGET_OPERATIONS = ['UserTweets', 'UserByScreenName'];

function extractBundleUrls(html) {
  const matches = html.matchAll(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web[^"']+\.js/g);
  return [...new Set([...matches].map((match) => match[0]))];
}

function findOperationQueryId(bundle, operationName) {
  const patterns = [
    new RegExp(`queryId:"([^"]+)"[^}]{0,240}operationName:"${operationName}"`),
    new RegExp(`operationName:"${operationName}"[^}]{0,240}queryId:"([^"]+)"`),
  ];

  for (const pattern of patterns) {
    const match = bundle.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export async function scrapeLiveQueryIds() {
  const found = {};

  const homeResponse = await fetch('https://x.com/', {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!homeResponse.ok) {
    return found;
  }

  const html = await homeResponse.text();
  const bundleUrls = extractBundleUrls(html);

  for (const bundleUrl of bundleUrls.slice(0, 30)) {
    if (TARGET_OPERATIONS.every((operation) => found[operation])) {
      break;
    }

    try {
      const bundleResponse = await fetch(bundleUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!bundleResponse.ok) {
        continue;
      }

      const bundle = await bundleResponse.text();

      for (const operationName of TARGET_OPERATIONS) {
        if (found[operationName]) {
          continue;
        }

        const queryId = findOperationQueryId(bundle, operationName);
        if (queryId) {
          found[operationName] = queryId;
        }
      }
    } catch {
      // Try the next bundle.
    }
  }

  return found;
}