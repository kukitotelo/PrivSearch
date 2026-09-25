// ============================================================
// PrivSearch – Dork AST Types
// The DorkParser produces trees of these nodes.
// The QueryPlanner translates them into source-specific queries.
// ============================================================

export type DorkNodeType =
  | 'AND' | 'OR' | 'NOT'
  | 'FieldExpr'
  | 'RangeExpr'
  | 'PhraseExpr'
  | 'TermExpr';

export interface BaseNode {
  type: DorkNodeType;
}

export interface AndNode extends BaseNode {
  type: 'AND';
  left: DorkNode;
  right: DorkNode;
}

export interface OrNode extends BaseNode {
  type: 'OR';
  left: DorkNode;
  right: DorkNode;
}

export interface NotNode extends BaseNode {
  type: 'NOT';
  operand: DorkNode;
}

/** field:value */
export interface FieldExprNode extends BaseNode {
  type: 'FieldExpr';
  field: string;
  value: string | number;
}

/** field:low-high */
export interface RangeExprNode extends BaseNode {
  type: 'RangeExpr';
  field: string;
  low: number;
  high: number;
}

/** "exact phrase" */
export interface PhraseExprNode extends BaseNode {
  type: 'PhraseExpr';
  value: string;
}

/** bare word */
export interface TermExprNode extends BaseNode {
  type: 'TermExpr';
  value: string;
}

export type DorkNode =
  | AndNode | OrNode | NotNode
  | FieldExprNode | RangeExprNode
  | PhraseExprNode | TermExprNode;

export interface ParseResult {
  success: true;
  ast: DorkNode;
  raw: string;
}

export interface ParseError {
  success: false;
  error: string;
  position?: number;
  raw: string;
}

export type DorkParseResult = ParseResult | ParseError;
