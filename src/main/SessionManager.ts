// ============================================================
// PrivSearch – SessionManager
// Manages per-tab Electron sessions with explicit persistence policies:
// - TEMPORARY: In-memory partition (e.g. "tab-<uuid>"). No disk writes.
// - PERSISTENT: Disk-backed partition ("persist:tab-<uuid>").
// Enforces cookie, network and permission policies.
// ============================================================
import { session, Session } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { PrivacyConfig, NetworkConfig, SessionPersistenceMode } from './types';
import { NetworkLayer } from './NetworkLayer';
import { PermissionManager } from './PermissionManager';

interface TabSession {
  tabId: string;
  partitionId: string;
  isTemporary: boolean;
  session: Session;
  createdAt: number;
}

export class SessionManager {
  private sessions = new Map<string, TabSession>();
  private networkLayer: NetworkLayer;
  private permissionManager: PermissionManager;
  private privacyConfig: PrivacyConfig;

  constructor(
    networkLayer: NetworkLayer,
    permissionManager: PermissionManager,
    privacyConfig: PrivacyConfig
  ) {
    this.networkLayer = networkLayer;
    this.permissionManager = permissionManager;
    this.privacyConfig = privacyConfig;
  }

  /**
   * Create an isolated session for a tab.
   * If sessionMode is TEMPORARY, the partition name omits 'persist:',
   * keeping cookies, cache, and storage strictly in memory.
   */
  async createTabSession(tabId: string, customMode?: SessionPersistenceMode): Promise<Session> {
    const mode = customMode || this.privacyConfig.sessionMode;
    const isTemporary = mode === 'TEMPORARY';
    const id = uuidv4();
    const partitionId = isTemporary ? `tab-${id}` : `persist:tab-${id}`;

    const tabSession = session.fromPartition(partitionId, { cache: !isTemporary });

    // Apply network layer proxy configuration to this session
    await this.networkLayer.applyToSession(tabSession);

    // Apply privacy policies (cookies, headers, storage)
    this.applyPrivacyPolicies(tabSession);

    // Wire permission manager strictly through this session
    tabSession.setPermissionRequestHandler((webContents, permission, callback) => {
      this.permissionManager.handleRequest(webContents, permission, callback);
    });

    this.sessions.set(tabId, {
      tabId,
      partitionId,
      isTemporary,
      session: tabSession,
      createdAt: Date.now(),
    });

    return tabSession;
  }

  getTabSession(tabId: string): Session | undefined {
    return this.sessions.get(tabId)?.session;
  }

  getPartitionInfo(tabId: string): { partitionId: string; isTemporary: boolean } | undefined {
    const s = this.sessions.get(tabId);
    if (!s) return undefined;
    return { partitionId: s.partitionId, isTemporary: s.isTemporary };
  }

  private applyPrivacyPolicies(sess: Session): void {
    // Real Third-Party Cookie Blocking via WebRequest
    if (this.privacyConfig.blockThirdPartyCookies) {
      sess.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
        const headers = { ...details.requestHeaders };

        // Identify third-party contexts by comparing initiator/referrer host with target URL host
        if ((details as any).initiator) {
          try {
            const initHost = new URL((details as any).initiator).hostname;
            const reqHost = new URL(details.url).hostname;
            // Cross-origin request: strip Cookie header to prevent cross-site tracking cookies
            if (initHost && reqHost && !reqHost.endsWith(initHost) && !initHost.endsWith(reqHost)) {
              delete headers['Cookie'];
            }
          } catch {
            // Safe fallback on URL parsing error: do not alter
          }
        }

        callback({ requestHeaders: headers });
      });

      sess.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
        const headers = { ...details.responseHeaders };
        // Strip Set-Cookie on cross-origin resource loads if initiator exists
        if ((details as any).initiator) {
          try {
            const initHost = new URL((details as any).initiator).hostname;
            const reqHost = new URL(details.url).hostname;
            if (initHost && reqHost && !reqHost.endsWith(initHost) && !initHost.endsWith(reqHost)) {
              delete headers['set-cookie'];
              delete headers['Set-Cookie'];
            }
          } catch {}
        }
        callback({ responseHeaders: headers });
      });
    }
  }

  async clearTabSession(tabId: string): Promise<void> {
    const s = this.sessions.get(tabId);
    if (!s) return;
    await s.session.clearStorageData();
    await s.session.clearCache();
    this.sessions.delete(tabId);
  }

  async clearAllSessions(): Promise<void> {
    for (const tabId of Array.from(this.sessions.keys())) {
      await this.clearTabSession(tabId);
    }
  }

  updatePrivacyConfig(cfg: PrivacyConfig): void {
    this.privacyConfig = cfg;
  }
}
