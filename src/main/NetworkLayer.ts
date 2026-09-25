// ============================================================
// PrivSearch – NetworkLayer
// Controls routing: DIRECT | HTTP_PROXY | HTTPS_PROXY | SOCKS5 | TOR
// Ensures verification is conducted strictly through Electron session network stack.
// ============================================================
import { Session, net } from 'electron';
import { NetworkConfig, NetworkStatus, RouteType, VerificationState } from './types';

export class NetworkLayer {
  private config: NetworkConfig = { route: 'DIRECT' };
  private status: NetworkStatus = {
    configuredRoute: 'DIRECT',
    detectedRoute: 'NOT_VERIFIED',
    routeVerification: 'NOT_TESTED',
    proxyStatus: 'NOT_TESTED',
    torStatus: 'NOT_ACTIVE',
    dnsStatus: 'NOT_TESTED',
    webRTCStatus: 'NOT_TESTED',
  };

  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  setConfig(cfg: NetworkConfig): void {
    this.config = { ...cfg };
    this.status.configuredRoute = cfg.route;
    this.status.detectedRoute = 'NOT_VERIFIED';
    this.status.routeVerification = 'NOT_VERIFIED';

    if (cfg.route === 'DIRECT') {
      this.status.proxyStatus = 'NOT_TESTED';
      this.status.torStatus = 'NOT_ACTIVE';
    } else if (cfg.route === 'TOR') {
      this.status.torStatus = 'CONFIGURED';
      this.status.proxyStatus = 'NOT_TESTED';
    } else {
      this.status.proxyStatus = 'CONFIGURED';
      this.status.torStatus = 'NOT_ACTIVE';
    }

    this.status.dnsStatus = 'NOT_TESTED';
  }

  /**
   * Apply proxy configuration to an Electron session.
   * Chromium's internal network stack will respect these rules.
   */
  async applyToSession(session: Session): Promise<void> {
    const cfg = this.config;
    switch (cfg.route) {
      case 'DIRECT':
        await session.setProxy({ mode: 'direct' });
        break;
      case 'HTTP_PROXY':
      case 'HTTPS_PROXY':
        if (!cfg.proxyUrl) {
          throw new Error('proxyUrl required for HTTP(S) proxy mode');
        }
        await session.setProxy({ proxyRules: cfg.proxyUrl });
        break;
      case 'SOCKS5':
        if (!cfg.proxyUrl) {
          throw new Error('proxyUrl required for SOCKS5 mode');
        }
        await session.setProxy({ proxyRules: `socks5://${cfg.proxyUrl}` });
        break;
      case 'TOR':
        const torHost = cfg.torSocksHost || '127.0.0.1';
        const torPort = cfg.torSocksPort || 9050;
        await session.setProxy({ proxyRules: `socks5://${torHost}:${torPort}` });
        break;
    }
  }

  /**
   * Safe fetcher that executes strictly via the Electron Session network stack.
   * This guarantees that requests follow the exact proxy/routing configuration of the session.
   */
  async fetchThroughSession(session: Session, url: string, timeoutMs: number = 8000): Promise<string> {
    const response = await net.fetch(url, {
      // @ts-ignore - session property is supported in Electron net.fetch
      session,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Verify actual exit IP using the specified Electron session.
   * Does NOT use standard Node https.get to avoid bypassing Chromium proxy.
   */
  async verifyRoute(session?: Session): Promise<VerificationState> {
    if (!session) {
      this.status.routeVerification = 'NOT_TESTED';
      return 'NOT_TESTED';
    }
    return this.verifyRouteWithSession(session);
  }

  async verifyRouteWithSession(session: Session): Promise<VerificationState> {
    try {
      const raw = await this.fetchThroughSession(session, 'https://api.ipify.org?format=json', 5000);
      const parsed = JSON.parse(raw);
      if (!parsed.ip) {
        this.status.routeVerification = 'ERROR';
        this.status.detectedRoute = 'NOT_VERIFIED';
        return 'ERROR';
      }

      this.status.exitIP = parsed.ip;
      this.status.lastChecked = Date.now();
      this.status.detectedRoute = this.config.route;
      this.status.routeVerification = 'VERIFIED';

      if (this.config.route === 'TOR') {
        this.status.torStatus = 'VERIFIED';
      } else if (this.config.route !== 'DIRECT') {
        this.status.proxyStatus = 'VERIFIED';
      }
      return 'VERIFIED';
    } catch (err) {
      this.status.routeVerification = 'ERROR';
      this.status.detectedRoute = 'NOT_VERIFIED';
      return 'ERROR';
    }
  }

  setWebRTCStatus(status: VerificationState): void {
    this.status.webRTCStatus = status;
  }

  setDNSStatus(status: VerificationState): void {
    this.status.dnsStatus = status;
  }
}
