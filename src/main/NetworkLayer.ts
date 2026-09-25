// ============================================================
// PrivSearch – NetworkLayer
// Controls routing: DIRECT | HTTP_PROXY | HTTPS_PROXY | SOCKS5 | TOR
// Ensures verification is conducted strictly through Electron session network stack.
// Zero @ts-ignore. Honest verification states.
// ============================================================
import { Session, net } from 'electron';
import { NetworkConfig, NetworkStatus, VerificationState } from './types';

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
   * Apply proxy configuration to an Electron session using official Chromium proxy rules.
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
   * If a session is provided, it uses session.fetch(url, init).
   * Otherwise, it uses net.fetch(url, init) from default session.
   * Fully typed, zero @ts-ignore.
   */
  async fetchThroughSession(session: Session | undefined, url: string, timeoutMs: number = 8000): Promise<string> {
    const fetchFn = session ? session.fetch.bind(session) : net.fetch;
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Verify actual network route using the specified Electron session.
   * Crucial rule: A successful generic IP check alone DOES NOT verify TOR or SOCKS proxy.
   * Real verification checks:
   * - DIRECT: Confirmed if public IP lookup responds.
   * - TOR: Confirmed ONLY if check.torproject.org confirms IsTor === true.
   * - PROXY: Marked CONFIGURED unless confirmed against expected proxy exit IP.
   */
  async verifyRouteWithSession(session: Session): Promise<VerificationState> {
    const route = this.config.route;

    if (route === 'DIRECT') {
      try {
        const raw = await this.fetchThroughSession(session, 'https://api.ipify.org?format=json', 5000);
        const parsed = JSON.parse(raw);
        if (parsed.ip) {
          this.status.exitIP = parsed.ip;
          this.status.lastChecked = Date.now();
          this.status.detectedRoute = 'DIRECT';
          this.status.routeVerification = 'VERIFIED';
          return 'VERIFIED';
        }
      } catch {
        this.status.routeVerification = 'ERROR';
        return 'ERROR';
      }
    }

    if (route === 'TOR') {
      try {
        // Query official Tor check endpoint via the session network stack
        const raw = await this.fetchThroughSession(session, 'https://check.torproject.org/api/ip', 8000);
        const parsed = JSON.parse(raw);
        this.status.exitIP = parsed.IP;
        this.status.lastChecked = Date.now();

        if (parsed.IsTor === true) {
          this.status.detectedRoute = 'TOR';
          this.status.torStatus = 'VERIFIED';
          this.status.routeVerification = 'VERIFIED';
          return 'VERIFIED';
        } else {
          // Connected through network, but Tor Project says this is NOT a Tor exit node!
          this.status.detectedRoute = 'NOT_VERIFIED';
          this.status.torStatus = 'POSSIBLE_LEAK';
          this.status.routeVerification = 'POSSIBLE_LEAK';
          return 'POSSIBLE_LEAK';
        }
      } catch {
        this.status.torStatus = 'ERROR';
        this.status.routeVerification = 'ERROR';
        return 'ERROR';
      }
    }

    // For HTTP/HTTPS/SOCKS5:
    // We can fetch exit IP, but cannot assume it is VERIFIED unless we know the proxy exit IP.
    try {
      const raw = await this.fetchThroughSession(session, 'https://api.ipify.org?format=json', 6000);
      const parsed = JSON.parse(raw);
      if (parsed.ip) {
        this.status.exitIP = parsed.ip;
        this.status.lastChecked = Date.now();
        // Do NOT blindly set VERIFIED. Keep as CONFIGURED with detected exit IP.
        this.status.proxyStatus = 'CONFIGURED';
        this.status.routeVerification = 'NOT_VERIFIED';
        return 'NOT_VERIFIED';
      }
    } catch {
      this.status.proxyStatus = 'ERROR';
      this.status.routeVerification = 'ERROR';
      return 'ERROR';
    }

    return 'NOT_VERIFIED';
  }

  async verifyRoute(session?: Session): Promise<VerificationState> {
    if (!session) {
      this.status.routeVerification = 'NOT_TESTED';
      return 'NOT_TESTED';
    }
    return this.verifyRouteWithSession(session);
  }

  setWebRTCStatus(status: VerificationState): void {
    this.status.webRTCStatus = status;
  }

  setDNSStatus(status: VerificationState): void {
    this.status.dnsStatus = status;
  }
}
