// ============================================================
// PrivSearch – DNSConnector
// Uses configurable DNS-over-HTTPS endpoint strictly via context.fetch.
// Resolves explicit domains and common TLD variations for keywords.
// ============================================================

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

    const explicitTargets = [
      ...domainFilters.map(f => String(f.value)),
      ...plan.terms.filter(t => t.includes('.')),
    ];

    // For bare terms without dots (e.g. "kali"), expand with top TLDs
    const bareTerms = plan.terms.filter(t => !t.includes('.') && t.trim().length >= 2);
    const expandedTargets: string[] = [];
    for (const term of bareTerms.slice(0, 2)) {
      const clean = term.replace(/"/g, '').trim().toLowerCase();
      expandedTargets.push(`${clean}.com`, `${clean}.org`, `${clean}.io`);
    }

    const allTargets = Array.from(new Set([...explicitTargets, ...expandedTargets]));

    if (allTargets.length === 0) {
      return {
        source: this.id,
        status: 'OK',
        records: [],
        durationMs: Date.now() - start,
      };
    }

    const resolverBase = context.dnsResolverUrl || 'https://cloudflare-dns.com/dns-query';
    const records: SearchRecord[] = [];

    for (const target of allTargets.slice(0, 5)) {
      try {
        const queryUrl = `${resolverBase}?name=${encodeURIComponent(target)}&type=ANY`;
        const res = await context.fetch(queryUrl, {
          headers: { 'Accept': 'application/dns-json' },
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) continue;
        const data = await res.json();

        if (data.Answer) {
          for (const answer of data.Answer) {
            records.push({
              source: resolverBase,
              sourceType: 'dns',
              timestamp: Date.now(),
              type: `DNS_${TYPE_MAP[answer.type] || answer.type}`,
              value: `${target} -> ${answer.data}`,
              confidence: 0.95,
              rawReference: queryUrl,
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              observationType: 'OBSERVED',
            });
          }
        }
      } catch (err: any) {
        // Silently skip unresolvable variations
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
