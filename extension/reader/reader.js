import {
  escapeHtml,
  formatScanSubtitle,
  formatScanTitle,
  renderReaderPosts,
} from '../lib/reader.js';

function getDateFromQuery() {
  return new URLSearchParams(location.search).get('date');
}

async function loadScan(date) {
  const key = `scan:${date}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? null;
}

function renderScan(scan) {
  document.title = formatScanTitle(scan);
  document.getElementById('app').innerHTML = `
    <h1>${escapeHtml(formatScanTitle(scan))}</h1>
    <p class="subtitle">${escapeHtml(formatScanSubtitle(scan))}</p>
    ${renderReaderPosts(scan)}
  `;
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a.open-on-x');
  if (!link) {
    return;
  }

  event.preventDefault();
  window.open(link.href, '_blank', 'noopener,noreferrer');
});

const date = getDateFromQuery();
if (!date) {
  document.getElementById('app').innerHTML =
    '<p class="error">Missing date. Open this page from the extension popup.</p>';
} else {
  loadScan(date)
    .then((scan) => {
      if (!scan?.tweets?.length) {
        document.getElementById('app').innerHTML =
          '<p class="error">No saved posts for this date. Sync first, then try Read today again.</p>';
        return;
      }

      renderScan(scan);
    })
    .catch((error) => {
      document.getElementById('app').innerHTML = `<p class="error">${escapeHtml(
        error instanceof Error ? error.message : 'Could not load posts.',
      )}</p>`;
    });
}