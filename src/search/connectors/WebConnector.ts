// ============================================================
// PrivSearch – WebConnector
// Phase 1 stub: Declares status honestly as NOT_IMPLEMENTED.
// ============================================================

import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { ConnectorCapabilities } from '../../main/types';

export class WebConnector implements SourceConnector {
  readonly id = 'web';
  readonly name = 'Web Aggregator';
  readonly sourceTypes = ['web'];
  readonly capabilities: ConnectorCapabilities = {
    supportsProxy: true,
    supportsTor: true,
    requiresApiKey: false,
    networkRequirement: 'RESPECTS_SESSION_PROXY',
  };

  isAvailable(): boolean {
    return false;
  }

  async query(_plan: QueryPlan, _context: ConnectorContext): Promise<ConnectorResult> {
    return {
      source: this.id,
      status: 'NOT_IMPLEMENTED',
      records: [],
      error: 'Web multi-source aggregator scheduled for Phase 3',
    };
  }
}
