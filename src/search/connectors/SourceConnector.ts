// ============================================================
// PrivSearch – SourceConnector Interface
// Connectors must declare their network requirements and capabilities explicitly.
// ============================================================

import { Session } from 'electron';
import { SearchRecord, SectionStatus, ConnectorCapabilities } from '../../main/types';
import { QueryPlan } from '../dork/QueryPlanner';

export interface ConnectorResult {
  source: string;
  status: SectionStatus;
  records: SearchRecord[];
  error?: string;
  durationMs?: number;
}

export interface ConnectorContext {
  session?: Session;
  dnsResolverUrl?: string;
  route: string;
}

export interface SourceConnector {
  readonly id: string;
  readonly name: string;
  readonly sourceTypes: string[];
  readonly capabilities: ConnectorCapabilities;

  /**
   * Execute query with context (providing the Electron session network stack).
   */
  query(plan: QueryPlan, context: ConnectorContext): Promise<ConnectorResult>;

  isAvailable(): boolean;
}
