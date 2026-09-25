// ============================================================
// PrivSearch – SearchEngine
// Orchestrates query classification, planning, and connector dispatch.
// Respects QueryPlanner to execute ONLY requested connectors.
// Passes session fetch context so connectors never bypass NetworkLayer.
// ============================================================

import { Session, net } from 'electron';
import { SearchResults, SearchResultSection } from '../main/types';
import { QueryClassifier } from './QueryClassifier';
import { DorkParser } from './dork/DorkParser';
import { QueryPlanner, SourceType } from './dork/QueryPlanner';
import { SourceConnector, ConnectorContext } from './connectors/SourceConnector';
import { DNSConnector } from './connectors/DNSConnector';
import { CertificateConnector } from './connectors/CertificateConnector';
import { ASNConnector } from './connectors/ASNConnector';
import { WebConnector } from './connectors/WebConnector';
import { InfrastructureConnector } from './connectors/InfrastructureConnector';

export class SearchEngine {
  private classifier = new QueryClassifier();
  private dorkParser = new DorkParser();
  private planner = new QueryPlanner();
  private connectors: Map<string, SourceConnector> = new Map();

  constructor() {
    const list: SourceConnector[] = [
      new DNSConnector(),
      new CertificateConnector(),
      new ASNConnector(),
      new WebConnector(),
      new InfrastructureConnector(),
    ];
    for (const c of list) {
      this.connectors.set(c.id, c);
    }
  }

  async search(rawQuery: string, session?: Session, activeRoute: string = 'DIRECT'): Promise<SearchResults> {
    const ts = Date.now();
    const classified = this.classifier.classify(rawQuery);

    const parseResult = this.dorkParser.parse(rawQuery);
    const plan = parseResult.success
      ? this.planner.plan(parseResult.ast)
      : this.planner.plan({ type: 'TermExpr', value: rawQuery });

    // Ensure session-bound fetch function is passed to connectors
    const safeFetch = (url: string, init?: any) => {
      if (session) {
        return session.fetch(url, init);
      }
      return net.fetch(url, init);
    };

    const context: ConnectorContext = {
      session,
      route: activeRoute,
      fetch: safeFetch,
    };

    const requestedSources = new Set<SourceType>(plan.sources);
    const resultMap = new Map<string, SearchResultSection>();
    const allSourceIds = ['web', 'dns', 'certificates', 'asn', 'infrastructure'];

    const executionPromises = allSourceIds.map(async (id) => {
      const connector = this.connectors.get(id);
      const isRequested = requestedSources.has(id as SourceType);

      if (!isRequested) {
        resultMap.set(id, {
          label: connector?.name || id,
          status: 'NOT_REQUESTED',
          records: [],
        });
        return;
      }

      if (!connector) {
        resultMap.set(id, {
          label: id,
          status: 'NOT_IMPLEMENTED',
          records: [],
          error: `Connector '${id}' not registered`,
        });
        return;
      }

      try {
        const result = await connector.query(plan, context);
        resultMap.set(id, {
          label: connector.name,
          status: result.status,
          records: result.records,
          error: result.error,
          durationMs: result.durationMs,
        });
      } catch (err: any) {
        resultMap.set(id, {
          label: connector.name,
          status: 'ERROR',
          records: [],
          error: err.message || 'Unknown connector error',
        });
      }
    });

    await Promise.all(executionPromises);

    return {
      query: classified,
      timestamp: ts,
      sections: {
        web: resultMap.get('web') || { label: 'Web', status: 'NOT_REQUESTED', records: [] },
        infrastructure: resultMap.get('infrastructure') || { label: 'Infrastructure', status: 'NOT_REQUESTED', records: [] },
        certificates: resultMap.get('certificates') || { label: 'Certificates', status: 'NOT_REQUESTED', records: [] },
        dns: resultMap.get('dns') || { label: 'DNS', status: 'NOT_REQUESTED', records: [] },
        historical: { label: 'Historical', status: 'NOT_IMPLEMENTED', records: [], error: 'Phase 5 indexer' },
        relationships: { label: 'Relationships', status: 'NOT_IMPLEMENTED', records: [], error: 'Phase 7 graph engine' },
      },
    };
  }

  getConnectors(): SourceConnector[] {
    return Array.from(this.connectors.values());
  }
}
