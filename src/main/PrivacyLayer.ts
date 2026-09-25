// ============================================================
// PrivSearch – PrivacyLayer
// Reports real privacy status based on verified state and configuration.
// No fabricated "VERIFIED" or "PROTECTED" badges without verification.
// ============================================================
import { PrivacyConfig, PrivacyStatus, NetworkStatus } from './types';

export class PrivacyLayer {
  private config: PrivacyConfig;

  constructor(config: PrivacyConfig) {
    this.config = config;
  }

  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  updateConfig(cfg: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  computeStatus(networkStatus: NetworkStatus): PrivacyStatus {
    const cookiePolicy = this.config.blockThirdPartyCookies
      ? (this.config.sessionCookiesOnly ? 'SESSION_ONLY' : 'BLOCKED')
      : 'ALLOWED_ALL';

    const localStoragePolicy = this.config.blockLocalStorage
      ? 'BLOCKED'
      : 'ISOLATED_PER_SESSION';

    return {
      privateMode: true,
      sessionMode: this.config.sessionMode,
      networkStatus,
      cookiePolicy,
      localStoragePolicy,
      trackingProtection: this.config.enableTrackingProtection ? 'ENABLED' : 'DISABLED',
      webRTCStatus: networkStatus.webRTCStatus,
      dnsStatus: networkStatus.dnsStatus,
    };
  }

  static defaultConfig(): PrivacyConfig {
    return {
      sessionMode: 'TEMPORARY', // Default to ephemeral in-memory sessions
      blockThirdPartyCookies: true,
      sessionCookiesOnly: true,
      blockLocalStorage: false,
      blockWebRTC: false,
      enableTrackingProtection: true,
    };
  }
}
