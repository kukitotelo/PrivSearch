// ============================================================
// PrivSearch – InfrastructureConnector
// Phase 1 stub: Declares status honestly as NOT_IMPLEMENTED.
// ============================================================

import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { ConnectorCapabilities } from '../../main/types';

export class InfrastructureConnector implements SourceConnector {
  readonly id = 'infrastructure';
  readonly name = 'Public Infrastructure Scanner';
  readonly sourceTypes = ['infrastructure'];
  readonly capabilities: ConnectorCapabilities = {
    supportsProxy: true,
    supportsTor: true,
    requiresApiKey: true,
    networkRequirement: 'EXTERNAL_API',
  };

  isAvailable(): boolean {
    return false;
  }

  async query(_plan: QueryPlan, _context: ConnectorContext): Promise<ConnectorResult> {
    return {
      source: this.id,
      status: 'NOT_IMPLEMENTED',
      records: [],
      error: 'Infrastructure connectors scheduled for Phase 6',
    };
  }
}
