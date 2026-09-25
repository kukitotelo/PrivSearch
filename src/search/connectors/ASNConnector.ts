// ============================================================
// PrivSearch – ASNConnector
// Queries bgpview.io via Electron session network stack.
// ============================================================

import { net } from 'electron';
import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { SearchRecord, ConnectorCapabilities } from '../../main/types';

export class ASNConnector implements SourceConnector {
  readonly id = 'asn';
  readonly name = 'BGPView ASN/IP';
  readonly sourceTypes = ['asn', 'infrastructure'];
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
    const records: SearchRecord[] = [];

    const ipFilters = plan.filters.filter(f => f.field === 'ip').map(f => String(f.value));
    const asnFilters = plan.filters.filter(f => f.field === 'asn').map(f => String(f.value));

    if (ipFilters.length === 0 && asnFilters.length === 0) {
      return { source: this.id, status: 'OK', records: [], durationMs: Date.now() - start };
    }

    for (const ip of ipFilters.slice(0, 3)) {
      try {
        const queryUrl = `https://api.bgpview.io/ip/${encodeURIComponent(ip)}`;
        const opts: any = { signal: AbortSignal.timeout(8000) };
        if (context.session) opts.session = context.session;

        const res = await net.fetch(queryUrl, opts);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data?.data) {
            records.push({
              source: 'bgpview.io',
              sourceType: 'asn',
              timestamp: Date.now(),
              type: 'IP_BGP_INFO',
              value: JSON.stringify({
                ip,
                rir: data.data.rir_allocation,
                prefixes: (data.data.prefixes || []).slice(0, 5),
              }),
              confidence: 0.9,
              rawReference: queryUrl,
              observationType: 'OBSERVED',
            });
          }
        }
      } catch (err: any) {
        return {
          source: this.id,
          status: 'SOURCE_UNAVAILABLE',
          records,
          error: `bgpview IP lookup failed: ${err.message}`,
          durationMs: Date.now() - start,
        };
      }
    }

    for (const asn of asnFilters.slice(0, 3)) {
      try {
        const num = asn.replace(/^AS/i, '');
        const queryUrl = `https://api.bgpview.io/asn/${encodeURIComponent(num)}`;
        const opts: any = { signal: AbortSignal.timeout(8000) };
        if (context.session) opts.session = context.session;

        const res = await net.fetch(queryUrl, opts);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data?.data) {
            records.push({
              source: 'bgpview.io',
              sourceType: 'asn',
              timestamp: Date.now(),
              type: 'ASN_INFO',
              value: JSON.stringify({
                asn: data.data.asn,
                name: data.data.name,
                description: data.data.description,
                country: data.data.country_code,
              }),
              confidence: 0.9,
              rawReference: queryUrl,
              observationType: 'OBSERVED',
            });
          }
        }
      } catch (err: any) {
        return {
          source: this.id,
          status: 'SOURCE_UNAVAILABLE',
          records,
          error: `bgpview ASN lookup failed: ${err.message}`,
          durationMs: Date.now() - start,
        };
      }
    }

    return { source: this.id, status: 'OK', records, durationMs: Date.now() - start };
  }
}
