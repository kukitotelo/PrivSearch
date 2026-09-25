// ============================================================
// PrivSearch – Shared Types & State Definitions
// ============================================================

export type RouteType = 'DIRECT' | 'HTTP_PROXY' | 'HTTPS_PROXY' | 'SOCKS5' | 'TOR';

export type VerificationState =
  | 'NOT_TESTED'
  | 'NOT_IMPLEMENTED'
  | 'CONFIGURED'
  | 'NOT_VERIFIED'
  | 'VERIFIED'
  | 'POSSIBLE_LEAK'
  | 'ERROR'
  | 'NOT_ACTIVE';

export type SessionPersistenceMode = 'TEMPORARY' | 'PERSISTENT';

export interface NetworkConfig {
  route: RouteType;
  proxyUrl?: string; // host:port or user:pass@host:port
  torSocksHost?: string;
  torSocksPort?: number;
  dnsResolverUrl?: string; // e.g. custom DoH endpoint or system
}

export interface NetworkStatus {
  configuredRoute: RouteType;
  detectedRoute: RouteType | 'NOT_VERIFIED';
  routeVerification: VerificationState;
  proxyStatus: VerificationState;
  torStatus: VerificationState;
  dnsStatus: VerificationState;
  webRTCStatus: VerificationState;
  exitIP?: string;
  lastChecked?: number;
}

export interface PrivacyConfig {
  sessionMode: SessionPersistenceMode;
  blockThirdPartyCookies: boolean;
  sessionCookiesOnly: boolean;
  blockLocalStorage: boolean;
  blockWebRTC: boolean;
  enableTrackingProtection: boolean;
  dnsResolverUrl?: string;
}

export interface PrivacyStatus {
  privateMode: boolean;
  sessionMode: SessionPersistenceMode;
  networkStatus: NetworkStatus;
  cookiePolicy: 'ALLOWED_ALL' | 'SESSION_ONLY' | 'BLOCKED' | 'NOT_IMPLEMENTED';
  localStoragePolicy: 'ALLOWED' | 'ISOLATED_PER_SESSION' | 'BLOCKED' | 'NOT_IMPLEMENTED';
  trackingProtection: 'DISABLED' | 'ENABLED' | 'NOT_IMPLEMENTED';
  webRTCStatus: VerificationState;
  dnsStatus: VerificationState;
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  partitionId: string;
  isTemporary: boolean;
}

export type QueryType = 'URL' | 'DOMAIN' | 'IP' | 'ASN' | 'DORK' | 'PLAIN_TEXT';

export interface ClassifiedQuery {
  raw: string;
  type: QueryType;
  normalizedValue: string;
}

export type ObservationType = 'OBSERVED' | 'HISTORICAL' | 'REFERENCED' | 'CORRELATED' | 'UNVERIFIED';

export interface SearchRecord {
  source: string;
  sourceType: string;
  timestamp: number;
  type: string;
  value: string;
  confidence: number; // 0.0 - 1.0
  rawReference?: string;
  firstSeen?: number;
  lastSeen?: number;
  observationType: ObservationType;
}

export type SectionStatus =
  | 'OK'
  | 'NOT_REQUESTED'
  | 'NOT_IMPLEMENTED'
  | 'SOURCE_UNAVAILABLE'
  | 'ERROR'
  | 'EMPTY'
  | 'RATE_LIMITED';

export interface SearchResultSection {
  label: string;
  status: SectionStatus;
  records: SearchRecord[];
  error?: string;
  durationMs?: number;
}

export interface SearchResults {
  query: ClassifiedQuery;
  timestamp: number;
  sections: {
    web: SearchResultSection;
    infrastructure: SearchResultSection;
    certificates: SearchResultSection;
    dns: SearchResultSection;
    historical: SearchResultSection;
    relationships: SearchResultSection;
  };
}

export interface ConnectorCapabilities {
  supportsProxy: boolean;
  supportsTor: boolean;
  requiresApiKey: boolean;
  networkRequirement: 'DIRECT_ALLOWED' | 'RESPECTS_SESSION_PROXY' | 'EXTERNAL_API';
}
