// ============================================================
// PrivSearch – CertificateConnector
// Queries crt.sh strictly using context.fetch (session-bound).
// Accepts both full domains and bare keywords/brands.
// ============================================================

import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { SearchRecord, ConnectorCapabilities } from '../../main/types';

export class CertificateConnector implements SourceConnector {
  readonly id = 'certificates';
  readonly name = 'Certificate Transparency (crt.sh)';
  readonly sourceTypes = ['certificates'];
  readonly capabilities: ConnectorCapabilities = {
    supportsProxy: true,
    supportsTor: true,
    requiresApiKey: false,
    networkRequirement: 'RESPECTS_SESSION_PROXY',
  };

  isAvailable(): boolean {
    return true;
  }

  async query(plan: QueryPlan, context: ConnectorContext): Promise<ConnectorResult> {
    const start = Date.now();
    // Gather domain filters + any terms/words of 2 or more characters
    const targets = [
      ...plan.filters
        .filter(f => ['domain', 'hostname', 'cert', 'certificate', 'site'].includes(f.field))
        .map(f => String(f.value)),
      ...plan.terms.filter(t => t.trim().length >= 2),
    ];

    if (targets.length === 0) {
      return { source: this.id, status: 'OK', records: [], durationMs: Date.now() - start };
    }

    const records: SearchRecord[] = [];

    // Query up to 3 target terms
    for (const target of targets.slice(0, 3)) {
      try {
        const cleanTarget = target.replace(/"/g, '').trim();
        const queryUrl = `https://crt.sh/?q=${encodeURIComponent(cleanTarget)}&output=json`;
        const res = await context.fetch(queryUrl, { signal: AbortSignal.timeout(10000) });

        if (!res.ok) {
          return {
            source: this.id,
            status: 'SOURCE_UNAVAILABLE',
            records: [],
            error: `crt.sh returned HTTP ${res.status}`,
            durationMs: Date.now() - start,
          };
        }

        const entries = (await res.json()) as any[];
        for (const entry of (entries || []).slice(0, 50)) {
          const commonName = entry.common_name || entry.name_value || '';
          records.push({
            source: 'crt.sh',
            sourceType: 'certificates',
            timestamp: Date.now(),
            type: 'CERTIFICATE',
            value: commonName,
            confidence: 1.0,
            rawReference: `https://crt.sh/?id=${entry.id}`,
            firstSeen: entry.not_before ? new Date(entry.not_before).getTime() : undefined,
            lastSeen: entry.not_after ? new Date(entry.not_after).getTime() : undefined,
            observationType: 'OBSERVED',
          });
        }
      } catch (err: any) {
        return {
          source: this.id,
          status: 'SOURCE_UNAVAILABLE',
          records,
          error: `Failed to contact crt.sh: ${err.message}`,
          durationMs: Date.now() - start,
        };
      }
    }

    return { source: this.id, status: 'OK', records, durationMs: Date.now() - start };
  }
}
