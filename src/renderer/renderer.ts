export {};

declare global {
  interface Window {
    privSearch: any;
  }
}

let currentTabId: string = '';

const addressBar = document.getElementById('address-bar') as HTMLInputElement;
const tabPrimary = document.getElementById('tab-primary') as HTMLElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
const btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
const btnNewTab = document.getElementById('btn-new-tab') as HTMLButtonElement;
const routeIndicator = document.getElementById('route-indicator') as HTMLElement;
const sessionIndicator = document.getElementById('session-indicator') as HTMLElement;
const dnsIndicator = document.getElementById('dns-indicator') as HTMLElement;
const searchOverlay = document.getElementById('search-results-overlay') as HTMLElement;
const btnCloseSearch = document.getElementById('btn-close-search') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container') as HTMLElement;
const searchQueryDisplay = document.getElementById('search-query-display') as HTMLElement;

async function refreshPrivacyStatus() {
  try {
    const status = await window.privSearch.getPrivacyStatus();
    if (!status) return;

    routeIndicator.textContent = status.networkStatus.configuredRoute;
    sessionIndicator.textContent = status.sessionMode;
    dnsIndicator.textContent = `DNS: ${status.dnsStatus}`;
  } catch (e) {
    console.error('Failed to get privacy status', e);
  }
}

function updateNavButtons(canGoBack?: boolean, canGoForward?: boolean) {
  if (btnBack) {
    btnBack.style.opacity = canGoBack ? '1' : '0.6';
  }
  if (btnForward) {
    btnForward.style.opacity = canGoForward ? '1' : '0.6';
  }
}

async function syncActiveTab() {
  try {
    const active = await window.privSearch.getActiveTab();
    if (active) {
      currentTabId = active.id;
      if (tabPrimary) {
        tabPrimary.querySelector('span')!.textContent = active.title || 'DuckDuckGo';
      }
      if (active.url && active.url !== 'about:blank') {
        addressBar.value = active.url;
      }
      updateNavButtons(active.canGoBack, active.canGoForward);
    }
  } catch (err) {
    console.error('Error syncing active tab:', err);
  }
}

async function closeSearchMode() {
  searchOverlay.style.display = 'none';
  if (window.privSearch?.setViewVisible) {
    await window.privSearch.setViewVisible(true);
  }
}

async function openSearchMode() {
  searchOverlay.style.display = 'block';
  if (window.privSearch?.setViewVisible) {
    await window.privSearch.setViewVisible(false);
  }
}

// Navigation handling (Enter in address bar)
addressBar?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = addressBar.value.trim();
    if (!val) return;

    const classified = await window.privSearch.classifyQuery(val);

    if (classified.type === 'URL') {
      await closeSearchMode();
      await window.privSearch.navigate(currentTabId, classified.normalizedValue);
    } else if (classified.type === 'DOMAIN') {
      await closeSearchMode();
      await window.privSearch.navigate(currentTabId, `https://${classified.normalizedValue}`);
    } else if (classified.type === 'IP') {
      await closeSearchMode();
      await window.privSearch.navigate(currentTabId, `http://${classified.normalizedValue}`);
    } else {
      // Dork or Plain word/phrase -> Indexer and Dork discovery mode
      renderSearchResults(val);
    }
  }
});

function extractNavigableUrl(value: string, rawRef?: string): string | null {
  if (rawRef && /^https?:\/\//i.test(rawRef.trim())) {
    return rawRef.trim();
  }

  const trimmed = (value || '').trim();
  if (trimmed.includes('->')) {
    const parts = trimmed.split('->');
    const target = parts[parts.length - 1].trim();
    if (/^https?:\/\//i.test(target)) return target;
    if (/^[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$/.test(target)) return `https://${target}`;

    const first = parts[0].trim();
    if (/^[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$/.test(first)) return `https://${first}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const cleanDomain = trimmed.replace(/^\*\./, '').trim();
  if (/^[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
    return `https://${cleanDomain}`;
  }

  return null;
}

async function renderSearchResults(query: string) {
  await openSearchMode();
  searchQueryDisplay.textContent = `Descubrimiento & Dorks: "${query}"`;
  resultsContainer.innerHTML = '<p style="color: #8b9bb4; font-size: 14px;">Consultando e indexando fuentes públicas (Web, Certificados crt.sh, DNS, ASN, Índice Local)...</p>';

  const res = await window.privSearch.searchQuery(query);
  if (!res.ok || !res.results) {
    resultsContainer.innerHTML = `<p style="color: #ef4444;">Error ejecutando búsqueda: ${res.error || 'Desconocido'}</p>`;
    return;
  }

  const sections = res.results.sections;
  let html = '';

  for (const [key, section] of Object.entries<any>(sections)) {
    html += `
      <div class="result-section">
        <div class="section-title">
          <span>${section.label || key.toUpperCase()}</span>
          <span style="font-size: 11px; color: #8b9bb4;">ESTADO: ${section.status}</span>
        </div>
    `;

    if (section.status === 'NOT_REQUESTED') {
      html += '<p style="color: #64748b; font-size: 12px;">Fuente no requerida para esta consulta.</p>';
    } else if (section.status === 'NOT_IMPLEMENTED') {
      html += `<p style="color: #f59e0b; font-size: 12px;">NOT IMPLEMENTED (${section.error || 'En desarrollo'})</p>`;
    } else if (section.status === 'SOURCE_UNAVAILABLE') {
      html += `<p style="color: #ef4444; font-size: 12px;">SOURCE UNAVAILABLE (${section.error || 'Sin respuesta'})</p>`;
    } else if (!section.records || section.records.length === 0) {
      html += '<p style="color: #8b9bb4; font-size: 12px;">Sin registros observados para esta fuente.</p>';
    } else {
      for (const rec of section.records) {
        const navUrl = extractNavigableUrl(rec.value, rec.rawReference);
        html += `
          <div class="record-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #283142;">
            <div style="flex: 1; word-break: break-all; margin-right: 12px;">
              <span style="color: #60a5fa; font-weight: bold; margin-right: 6px;">[${rec.type}]</span> 
              <span>${escapeHtml(rec.value)}</span>
              <span style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">
                Fuente: ${escapeHtml(rec.source)} | Tipo: ${rec.observationType} ${rec.confidence ? '| Confianza: ' + Math.round(rec.confidence * 100) + '%' : ''}
              </span>
            </div>
            ${navUrl ? `
              <button class="nav-to-target-btn" data-url="${escapeHtml(navUrl)}" style="background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; white-space: nowrap;">
                Navegar ↗
              </button>
            ` : ''}
          </div>
        `;
      }
    }
    html += '</div>';
  }

  resultsContainer.innerHTML = html;

  // Add click listeners to navigate buttons
  document.querySelectorAll('.nav-to-target-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetUrl = (e.currentTarget as HTMLElement).getAttribute('data-url');
      if (targetUrl) {
        await closeSearchMode();
        addressBar.value = targetUrl;
        await window.privSearch.navigate(currentTabId, targetUrl);
      }
    });
  });
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m] || m);
}

btnCloseSearch?.addEventListener('click', async () => {
  await closeSearchMode();
});

// Navigation actions
btnBack?.addEventListener('click', async () => {
  await closeSearchMode();
  const res = await window.privSearch.goBack(currentTabId);
  if (res) updateNavButtons(res.canGoBack, res.canGoForward);
});

btnForward?.addEventListener('click', async () => {
  await closeSearchMode();
  const res = await window.privSearch.goForward(currentTabId);
  if (res) updateNavButtons(res.canGoBack, res.canGoForward);
});

btnReload?.addEventListener('click', async () => {
  await closeSearchMode();
  await window.privSearch.reload(currentTabId);
});

btnNewTab?.addEventListener('click', async () => {
  await closeSearchMode();
  const result = await window.privSearch.newTab('https://duckduckgo.com');
  if (result && result.tabId) {
    currentTabId = result.tabId;
  }
});

// Keyboard shortcuts for navigation
window.addEventListener('keydown', async (e) => {
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    await closeSearchMode();
    const res = await window.privSearch.goBack(currentTabId);
    if (res) updateNavButtons(res.canGoBack, res.canGoForward);
  }
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    await closeSearchMode();
    const res = await window.privSearch.goForward(currentTabId);
    if (res) updateNavButtons(res.canGoBack, res.canGoForward);
  }
  if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
    e.preventDefault();
    await window.privSearch.reload(currentTabId);
  }
});

// Tab state updates received from main process
window.privSearch.onTabUpdated((tab: any) => {
  if (tab) {
    currentTabId = tab.id;
    if (tabPrimary) {
      tabPrimary.querySelector('span')!.textContent = tab.title || 'Pestaña';
    }
    if (tab.url && tab.url !== 'about:blank') {
      addressBar.value = tab.url;
    }
    updateNavButtons(tab.canGoBack, tab.canGoForward);
  }
});

// Startup initialization
syncActiveTab();
refreshPrivacyStatus();
