// ============================================================
// PrivSearch – SearchEngine
// Orchestrates multi-source indexing, querying, and correlation.
// Automatically indexes new observations to local SQLite database.
// ============================================================

import { Session, net } from 'electron';
import { SearchResults, SearchResultSection, SearchRecord } from '../main/types';
import { QueryClassifier } from './QueryClassifier';
import { DorkParser } from './dork/DorkParser';
import { QueryPlanner, SourceType } from './dork/QueryPlanner';
import { SourceConnector, ConnectorContext } from './connectors/SourceConnector';
import { DNSConnector } from './connectors/DNSConnector';
import { CertificateConnector } from './connectors/CertificateConnector';
import { ASNConnector } from './connectors/ASNConnector';
import { WebConnector } from './connectors/WebConnector';
import { InfrastructureConnector } from './connectors/InfrastructureConnector';
import { StorageAdapter } from '../db/StorageAdapter';

export class SearchEngine {
  private classifier = new QueryClassifier();
  private dorkParser = new DorkParser();
  private planner = new QueryPlanner();
  private connectors: Map<string, SourceConnector> = new Map();
  private storage?: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage;
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

        // Persist newly discovered observations to local SQLite database
        if (this.storage && result.records && result.records.length > 0) {
          for (const rec of result.records.slice(0, 30)) {
            this.storage.insertObservation({
              source: rec.source,
              sourceType: rec.sourceType,
              timestamp: rec.timestamp,
              type: rec.type,
              value: rec.value,
              confidence: rec.confidence,
              rawReference: rec.rawReference,
              firstSeen: rec.firstSeen,
              lastSeen: rec.lastSeen,
              observationType: rec.observationType,
            }).catch(() => {});
          }
        }
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

    // Query local database for historical / previously observed records
    let historicalRecords: SearchRecord[] = [];
    if (this.storage) {
      try {
        const localObs = await this.storage.queryObservations({ value: rawQuery.trim() });
        historicalRecords = localObs.map(o => ({
          source: `local_db (${o.source})`,
          sourceType: o.sourceType,
          timestamp: o.timestamp,
          type: o.type,
          value: o.value,
          confidence: o.confidence,
          rawReference: o.rawReference,
          observationType: 'HISTORICAL',
        }));
      } catch {}
    }

    return {
      query: classified,
      timestamp: ts,
      sections: {
        web: resultMap.get('web') || { label: 'Web', status: 'NOT_REQUESTED', records: [] },
        infrastructure: resultMap.get('infrastructure') || { label: 'Infrastructure', status: 'NOT_REQUESTED', records: [] },
        certificates: resultMap.get('certificates') || { label: 'Certificates', status: 'NOT_REQUESTED', records: [] },
        dns: resultMap.get('dns') || { label: 'DNS', status: 'NOT_REQUESTED', records: [] },
        historical: {
          label: 'Índice Local / Histórico',
          status: historicalRecords.length > 0 ? 'OK' : 'EMPTY',
          records: historicalRecords,
        },
        relationships: { label: 'Relaciones Correlacionadas', status: 'NOT_IMPLEMENTED', records: [], error: 'Phase 7 graph engine' },
      },
    };
  }

  getConnectors(): SourceConnector[] {
    return Array.from(this.connectors.values());
  }
}
