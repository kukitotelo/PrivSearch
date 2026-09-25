export {};
// ============================================================
// PrivSearch – Renderer Process Script
// Operates under contextIsolation without direct Node.js access.
// Uses window.privSearch exposed bridge.
// ============================================================

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

// Update UI from Privacy Status
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

// Navigation handling
addressBar?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = addressBar.value.trim();
    if (!val) return;

    // 1. Classify query
    const classified = await window.privSearch.classifyQuery(val);

    if (classified.type === 'URL') {
      searchOverlay.style.display = 'none';
      await window.privSearch.navigate(currentTabId, classified.normalizedValue);
    } else if (classified.type === 'DOMAIN') {
      searchOverlay.style.display = 'none';
      await window.privSearch.navigate(currentTabId, `https://${classified.normalizedValue}`);
    } else if (classified.type === 'IP') {
      searchOverlay.style.display = 'none';
      await window.privSearch.navigate(currentTabId, `http://${classified.normalizedValue}`);
    } else {
      // Dork or Plain text -> Open Search Engine
      renderSearchResults(val);
    }
  }
});

async function renderSearchResults(query: string) {
  searchOverlay.style.display = 'block';
  searchQueryDisplay.textContent = `Resultados para: "${query}"`;
  resultsContainer.innerHTML = '<p style="color: #8b9bb4;">Consultando fuentes públicas respetando política de red...</p>';

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
      html += '<p style="color: #8b9bb4; font-size: 12px;">Sin registros observados.</p>';
    } else {
      for (const rec of section.records) {
        html += `
          <div class="record-item">
            <span>[${rec.type}] ${escapeHtml(rec.value)}</span>
            <span style="color: #64748b;">${rec.observationType} (${rec.source})</span>
          </div>
        `;
      }
    }
    html += '</div>';
  }

  resultsContainer.innerHTML = html;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m] || m);
}

btnCloseSearch?.addEventListener('click', () => {
  searchOverlay.style.display = 'none';
});

btnBack?.addEventListener('click', () => {
  if (currentTabId) window.privSearch.goBack(currentTabId);
});

btnForward?.addEventListener('click', () => {
  if (currentTabId) window.privSearch.goForward(currentTabId);
});

btnReload?.addEventListener('click', () => {
  if (currentTabId) window.privSearch.reload(currentTabId);
});

btnNewTab?.addEventListener('click', () => {
  window.privSearch.newTab('https://duckduckgo.com');
});

// Tab state updates from main process
window.privSearch.onTabUpdated((tab: any) => {
  if (tab) {
    currentTabId = tab.id;
    tabPrimary.querySelector('span')!.textContent = tab.title || 'Pestaña';
    if (tab.url && tab.url !== 'about:blank') {
      addressBar.value = tab.url;
    }
  }
});

// Initialize privacy status display
refreshPrivacyStatus();
