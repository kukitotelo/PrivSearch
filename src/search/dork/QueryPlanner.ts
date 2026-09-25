// ============================================================
// PrivSearch – QueryPlanner
// Translates a Dork AST into source-specific query plans.
// When keywords or phrases are present, expands search across
// ALL available sources (Web, Certificates, DNS, ASN, Local Index).
// ============================================================

import { DorkNode, FieldExprNode, RangeExprNode } from './DorkTypes';

export type SourceType = 'web' | 'dns' | 'certificates' | 'asn' | 'infrastructure' | 'local';

export interface FieldFilter {
  field: string;
  value: string | number;
  op: 'eq' | 'range';
  rangeHigh?: number;
}

export interface QueryPlan {
  sources: SourceType[];
  filters: FieldFilter[];
  terms: string[];
  rawAst: DorkNode;
}

const FIELD_SOURCE_MAP: Record<string, SourceType[]> = {
  domain:      ['dns', 'certificates', 'infrastructure', 'local'],
  hostname:    ['dns', 'certificates', 'infrastructure', 'local'],
  ip:          ['infrastructure', 'asn', 'local'],
  asn:         ['asn', 'local'],
  port:        ['infrastructure', 'local'],
  service:     ['infrastructure', 'local'],
  cert:        ['certificates', 'local'],
  certificate: ['certificates', 'local'],
  technology:  ['infrastructure', 'local'],
  site:        ['web', 'dns', 'certificates', 'local'],
  url:         ['web', 'local'],
  inurl:       ['web', 'local'],
  intitle:     ['web', 'local'],
  intext:      ['web', 'local'],
};

function addAllSources(plan: QueryPlan): void {
  const all: SourceType[] = ['web', 'certificates', 'dns', 'asn', 'infrastructure', 'local'];
  for (const s of all) {
    if (!plan.sources.includes(s)) plan.sources.push(s);
  }
}

function collectNodes(node: DorkNode, plan: QueryPlan): void {
  switch (node.type) {
    case 'AND':
    case 'OR':
      collectNodes(node.left, plan);
      collectNodes(node.right, plan);
      break;
    case 'NOT':
      collectNodes(node.operand, plan);
      break;
    case 'FieldExpr': {
      const sources = FIELD_SOURCE_MAP[node.field.toLowerCase()] ?? ['web', 'local'];
      for (const s of sources) {
        if (!plan.sources.includes(s)) plan.sources.push(s);
      }
      plan.filters.push({ field: node.field.toLowerCase(), value: node.value, op: 'eq' });
      break;
    }
    case 'RangeExpr': {
      const sources = FIELD_SOURCE_MAP[node.field.toLowerCase()] ?? ['infrastructure', 'local'];
      for (const s of sources) {
        if (!plan.sources.includes(s)) plan.sources.push(s);
      }
      plan.filters.push({ field: node.field.toLowerCase(), value: node.low, op: 'range', rangeHigh: node.high });
      break;
    }
    case 'PhraseExpr':
      plan.terms.push(node.value);
      // For general phrases, query all sources to discover everything matching
      addAllSources(plan);
      break;
    case 'TermExpr':
      plan.terms.push(node.value);
      // For bare words, query all available sources for discovery and dorking
      addAllSources(plan);
      break;
  }
}

export class QueryPlanner {
  plan(ast: DorkNode): QueryPlan {
    const qp: QueryPlan = {
      sources: [],
      filters: [],
      terms: [],
      rawAst: ast,
    };
    collectNodes(ast, qp);
    if (qp.sources.length === 0) {
      addAllSources(qp);
    }
    return qp;
  }
}
