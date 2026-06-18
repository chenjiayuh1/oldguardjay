import { FALLBACK_GRAPHQL, OPENAPI_QUERY_URL } from './constants.js';
import { scrapeLiveQueryIds } from './scrape-query-ids.js';

let cachedConfig = null;

export function clearGraphqlConfigCache() {
  cachedConfig = null;
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== false));
}

export async function loadGraphqlConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const scrapedQueryIds = await scrapeLiveQueryIds();

  try {
    const response = await fetch(OPENAPI_QUERY_URL);
    if (response.ok) {
      const payload = await response.json();
      cachedConfig = {
        queryIds: {
          UserByScreenName:
            scrapedQueryIds.UserByScreenName ??
            payload.UserByScreenName?.queryId ??
            FALLBACK_GRAPHQL.queryIds.UserByScreenName,
          UserTweets:
            scrapedQueryIds.UserTweets ??
            payload.UserTweets?.queryId ??
            FALLBACK_GRAPHQL.queryIds.UserTweets,
        },
        features: {
          UserByScreenName: compactRecord(payload.UserByScreenName?.features ?? FALLBACK_GRAPHQL.features.UserByScreenName),
          UserTweets: compactRecord(payload.UserTweets?.features ?? FALLBACK_GRAPHQL.features.UserTweets),
        },
        fieldToggles: {
          UserByScreenName: payload.UserByScreenName?.fieldToggles ?? FALLBACK_GRAPHQL.fieldToggles.UserByScreenName,
          UserTweets: payload.UserTweets?.fieldToggles ?? FALLBACK_GRAPHQL.fieldToggles.UserTweets,
        },
      };
      return cachedConfig;
    }
  } catch {
    // Use bundled GraphQL config when the remote index is unavailable.
  }

  cachedConfig = {
    queryIds: {
      UserByScreenName:
        scrapedQueryIds.UserByScreenName ?? FALLBACK_GRAPHQL.queryIds.UserByScreenName,
      UserTweets: scrapedQueryIds.UserTweets ?? FALLBACK_GRAPHQL.queryIds.UserTweets,
    },
    features: {
      UserByScreenName: compactRecord(FALLBACK_GRAPHQL.features.UserByScreenName),
      UserTweets: compactRecord(FALLBACK_GRAPHQL.features.UserTweets),
    },
    fieldToggles: {
      UserByScreenName: { ...FALLBACK_GRAPHQL.fieldToggles.UserByScreenName },
      UserTweets: { ...FALLBACK_GRAPHQL.fieldToggles.UserTweets },
    },
  };

  return cachedConfig;
}