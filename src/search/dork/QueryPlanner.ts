// ============================================================
// PrivSearch – QueryPlanner
// Translates a Dork AST into source-specific query plans.
// The planner knows which fields map to which sources.
// The DorkParser knows nothing about sources.
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
  terms: string[];         // bare words / phrases
  rawAst: DorkNode;
}

// Field-to-source mapping
const FIELD_SOURCE_MAP: Record<string, SourceType[]> = {
  domain:      ['dns', 'certificates', 'infrastructure', 'local'],
  hostname:    ['dns', 'infrastructure', 'local'],
  ip:          ['infrastructure', 'local'],
  asn:         ['asn', 'local'],
  port:        ['infrastructure', 'local'],
  service:     ['infrastructure', 'local'],
  cert:        ['certificates', 'local'],
  certificate: ['certificates', 'local'],
  technology:  ['infrastructure', 'local'],
  site:        ['web', 'local'],
  url:         ['web', 'local'],
  inurl:       ['web', 'local'],
  intitle:     ['web', 'local'],
  intext:      ['web', 'local'],
};

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
      plan.terms.push(`"${node.value}"`);
      if (!plan.sources.includes('web')) plan.sources.push('web');
      if (!plan.sources.includes('local')) plan.sources.push('local');
      break;
    case 'TermExpr':
      plan.terms.push(node.value);
      if (!plan.sources.includes('web')) plan.sources.push('web');
      if (!plan.sources.includes('local')) plan.sources.push('local');
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
      qp.sources = ['web', 'local'];
    }
    return qp;
  }
}
