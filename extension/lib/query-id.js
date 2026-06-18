import { FALLBACK_QUERY_IDS, OPENAPI_QUERY_URL } from './constants.js';

const cachedQueryIds = {};

export async function resolveQueryId(operationName) {
  if (cachedQueryIds[operationName]) {
    return cachedQueryIds[operationName];
  }

  try {
    const response = await fetch(OPENAPI_QUERY_URL);
    if (response.ok) {
      const payload = await response.json();
      const queryId = payload?.[operationName]?.queryId;
      if (queryId) {
        cachedQueryIds[operationName] = queryId;
        return queryId;
      }
    }
  } catch {
    // Fall back to hardcoded query IDs.
  }

  const fallback = FALLBACK_QUERY_IDS[operationName];
  if (!fallback) {
    throw new Error(`No query ID available for ${operationName}`);
  }

  cachedQueryIds[operationName] = fallback;
  return fallback;
}

export async function getQueryIds(operationNames) {
  const queryIds = {};

  for (const operationName of operationNames) {
    queryIds[operationName] = await resolveQueryId(operationName);
  }

  return queryIds;
}