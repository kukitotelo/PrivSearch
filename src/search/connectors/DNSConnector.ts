// ============================================================
// PrivSearch – DNSConnector
// Uses configurable DNS-over-HTTPS endpoint via Electron session fetch
// or marks as UNVERIFIED / NOT_CONFIGURED.
// ============================================================

import { net } from 'electron';
import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { SearchRecord, ConnectorCapabilities } from '../../main/types';

const TYPE_MAP: Record<number, string> = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA',
  15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

export class DNSConnector implements SourceConnector {
  readonly id = 'dns';
  readonly name = 'DNS Resolver';
  readonly sourceTypes = ['dns'];
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
    const domainFilters = plan.filters.filter(f =>
      ['domain', 'hostname', 'site'].includes(f.field)
    );
    const targets: string[] = [
      ...domainFilters.map(f => String(f.value)),
      ...plan.terms.filter(t => /^[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$/.test(t.replace(/"/g, ''))),
    ];

    if (targets.length === 0) {
      return {
        source: this.id,
        status: 'OK',
        records: [],
        durationMs: Date.now() - start,
      };
    }

    // Default DoH resolver endpoint (configurable)
    const resolverBase = context.dnsResolverUrl || 'https://cloudflare-dns.com/dns-query';
    const records: SearchRecord[] = [];

    for (const target of targets.slice(0, 5)) {
      try {
        const queryUrl = `${resolverBase}?name=${encodeURIComponent(target)}&type=ANY`;
        const fetchOptions: any = {
          headers: { 'Accept': 'application/dns-json' },
          signal: AbortSignal.timeout(6000),
        };
        if (context.session) {
          fetchOptions.session = context.session;
        }

        const res = await net.fetch(queryUrl, fetchOptions);
        if (!res.ok) {
          throw new Error(`DNS DoH error HTTP ${res.status}`);
        }
        const data = await res.json() as any;

        if (data.Answer) {
          for (const answer of data.Answer) {
            records.push({
              source: resolverBase,
              sourceType: 'dns',
              timestamp: Date.now(),
              type: `DNS_${TYPE_MAP[answer.type] || answer.type}`,
              value: answer.data,
              confidence: 0.95,
              rawReference: queryUrl,
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              observationType: 'OBSERVED',
            });
          }
        }
      } catch (err: any) {
        records.push({
          source: resolverBase,
          sourceType: 'dns',
          timestamp: Date.now(),
          type: 'DNS_QUERY_FAILURE',
          value: `Failed resolving ${target}: ${err.message}`,
          confidence: 0,
          observationType: 'UNVERIFIED',
        });
      }
    }

    return {
      source: this.id,
      status: 'OK',
      records,
      durationMs: Date.now() - start,
    };
  }
}
