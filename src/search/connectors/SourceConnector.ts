// ============================================================
// PrivSearch – SourceConnector Interface
// Connectors must declare their network requirements explicitly.
// All network requests must go through context.fetch to respect session proxy rules.
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
  fetch: (url: string, init?: any) => Promise<any>;
}

export interface SourceConnector {
  readonly id: string;
  readonly name: string;
  readonly sourceTypes: string[];
  readonly capabilities: ConnectorCapabilities;

  query(plan: QueryPlan, context: ConnectorContext): Promise<ConnectorResult>;
  isAvailable(): boolean;
}
