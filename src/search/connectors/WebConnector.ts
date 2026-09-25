// ============================================================
// PrivSearch – WebConnector
// Queries public multi-source search index strictly via context.fetch.
// Zero tracking, respects active session proxy and returns observable web results.
// ============================================================

import { SourceConnector, ConnectorResult, ConnectorContext } from './SourceConnector';
import { QueryPlan } from '../dork/QueryPlanner';
import { SearchRecord, ConnectorCapabilities } from '../../main/types';

export class WebConnector implements SourceConnector {
  readonly id = 'web';
  readonly name = 'Web Search';
  readonly sourceTypes = ['web'];
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
    const queryTerms = [
      ...plan.terms,
      ...plan.filters.map(f => `${f.field}:${f.value}`),
    ];

    const queryString = queryTerms.join(' ').trim();
    if (!queryString) {
      return {
        source: this.id,
        status: 'OK',
        records: [],
        durationMs: Date.now() - start,
      };
    }

    const records: SearchRecord[] = [];

    try {
      const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(queryString)}&format=json&no_html=1&skip_disambig=1`;
      const res = await context.fetch(endpoint, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return {
          source: this.id,
          status: 'SOURCE_UNAVAILABLE',
          records: [],
          error: `Web source returned HTTP ${res.status}`,
          durationMs: Date.now() - start,
        };
      }

      const data = await res.json() as any;

      // 1. Primary abstract result
      if (data.AbstractURL && data.Heading) {
        records.push({
          source: 'public_web_index',
          sourceType: 'web',
          timestamp: Date.now(),
          type: 'WEB_PAGE',
          value: `${data.Heading}: ${data.AbstractText || ''} -> ${data.AbstractURL}`,
          confidence: 0.95,
          rawReference: data.AbstractURL,
          observationType: 'OBSERVED',
        });
      }

      // 2. Direct results array
      if (Array.isArray(data.Results)) {
        for (const r of data.Results) {
          if (r.FirstURL && r.Text) {
            records.push({
              source: 'public_web_index',
              sourceType: 'web',
              timestamp: Date.now(),
              type: 'WEB_PAGE',
              value: `${r.Text} -> ${r.FirstURL}`,
              confidence: 0.9,
              rawReference: r.FirstURL,
              observationType: 'OBSERVED',
            });
          }
        }
      }

      // 3. Related topics
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 15)) {
          if (topic.FirstURL && topic.Text) {
            records.push({
              source: 'public_web_index',
              sourceType: 'web',
              timestamp: Date.now(),
              type: 'WEB_PAGE',
              value: `${topic.Text} -> ${topic.FirstURL}`,
              confidence: 0.85,
              rawReference: topic.FirstURL,
              observationType: 'OBSERVED',
            });
          } else if (Array.isArray(topic.Topics)) {
            // Nested topic group
            for (const sub of topic.Topics.slice(0, 5)) {
              if (sub.FirstURL && sub.Text) {
                records.push({
                  source: 'public_web_index',
                  sourceType: 'web',
                  timestamp: Date.now(),
                  type: 'WEB_PAGE',
                  value: `${sub.Text} -> ${sub.FirstURL}`,
                  confidence: 0.8,
                  rawReference: sub.FirstURL,
                  observationType: 'OBSERVED',
                });
              }
            }
          }
        }
      }

      return {
        source: this.id,
        status: records.length > 0 ? 'OK' : 'EMPTY',
        records,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        source: this.id,
        status: 'SOURCE_UNAVAILABLE',
        records: [],
        error: `Failed to query web index: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }
}
