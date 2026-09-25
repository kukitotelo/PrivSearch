// ============================================================
// PrivSearch – DorkParser (Deterministic Recursive-Descent)
// Precedence: NOT > AND (explicit & implicit) > OR
// Full support for field:value, field:range, "phrases", (groups)
// ============================================================

import {
  DorkNode, DorkParseResult, ParseResult, ParseError,
  AndNode, OrNode, NotNode, FieldExprNode, RangeExprNode,
  PhraseExprNode, TermExprNode
} from './DorkTypes';

type Token =
  | { type: 'WORD'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'COLON' }
  | { type: 'DASH' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'PHRASE'; value: string }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'NOT' }
  | { type: 'EOF' };

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Exact phrase in quotes: "exact phrase"
    if (ch === '"') {
      let j = i + 1;
      let phrase = '';
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && j + 1 < input.length) {
          phrase += input[j + 1];
          j += 2;
        } else {
          phrase += input[j];
          j++;
        }
      }
      tokens.push({ type: 'PHRASE', value: phrase });
      i = j < input.length ? j + 1 : j;
      continue;
    }

    // Parentheses
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (ch === ':') { tokens.push({ type: 'COLON' }); i++; continue; }

    // Alphanumeric word, IP, domain, keyword or number/range
    if (/[a-zA-Z0-9_\-\.\*\/]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_\-\.\*\/]/.test(input[j])) {
        // Stop before colon so field:value can be parsed
        if (input[j] === ':') break;
        j++;
      }
      const rawSpan = input.slice(i, j);
      i = j;

      // 1. Check if it's a numeric range: e.g. "80-443"
      const rangeMatch = /^(\d+)-(\d+)$/.exec(rawSpan);
      if (rangeMatch) {
        tokens.push({ type: 'NUMBER', value: parseInt(rangeMatch[1], 10) });
        tokens.push({ type: 'DASH' });
        tokens.push({ type: 'NUMBER', value: parseInt(rangeMatch[2], 10) });
        continue;
      }

      // 2. Check if it's a pure integer: e.g. "443"
      if (/^\d+$/.test(rawSpan)) {
        tokens.push({ type: 'NUMBER', value: parseInt(rawSpan, 10) });
        continue;
      }

      // 3. Keywords
      const upper = rawSpan.toUpperCase();
      if (upper === 'AND') tokens.push({ type: 'AND' });
      else if (upper === 'OR') tokens.push({ type: 'OR' });
      else if (upper === 'NOT') tokens.push({ type: 'NOT' });
      else {
        // Normal word, domain, IP (192.168.1.1), etc.
        tokens.push({ type: 'WORD', value: rawSpan });
      }
      continue;
    }

    // Dash as standalone operator
    if (ch === '-') {
      tokens.push({ type: 'DASH' });
      i++;
      continue;
    }

    // Skip unknown character
    i++;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type']): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new Error(`Expected token ${type} but encountered ${t.type}`);
    }
    return this.consume();
  }

  parse(): DorkNode {
    if (this.peek().type === 'EOF') {
      throw new Error('Empty query expression');
    }
    const node = this.parseOr();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token at end of expression: ${JSON.stringify(this.peek())}`);
    }
    return node;
  }

  // Precedence 1: OR
  private parseOr(): DorkNode {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.consume();
      const right = this.parseAnd();
      left = { type: 'OR', left, right } as OrNode;
    }
    return left;
  }

  // Precedence 2: AND (explicit or implicit)
  private parseAnd(): DorkNode {
    let left = this.parseNot();
    while (
      this.peek().type === 'AND' ||
      this.isStartOfPrimary(this.peek())
    ) {
      if (this.peek().type === 'AND') {
        this.consume();
      }
      if (this.peek().type === 'RPAREN' || this.peek().type === 'EOF' || this.peek().type === 'OR') break;

      const right = this.parseNot();
      left = { type: 'AND', left, right } as AndNode;
    }
    return left;
  }

  private isStartOfPrimary(token: Token): boolean {
    return (
      token.type === 'WORD' ||
      token.type === 'NUMBER' ||
      token.type === 'PHRASE' ||
      token.type === 'NOT' ||
      token.type === 'LPAREN'
    );
  }

  // Precedence 3: NOT
  private parseNot(): DorkNode {
    if (this.peek().type === 'NOT') {
      this.consume();
      const operand = this.parsePrimary();
      return { type: 'NOT', operand } as NotNode;
    }
    return this.parsePrimary();
  }

  // Precedence 4: Primary
  private parsePrimary(): DorkNode {
    const t = this.peek();

    if (t.type === 'LPAREN') {
      this.consume();
      const node = this.parseOr();
      this.expect('RPAREN');
      return node;
    }

    if (t.type === 'PHRASE') {
      this.consume();
      return { type: 'PhraseExpr', value: (t as any).value } as PhraseExprNode;
    }

    if (t.type === 'WORD') {
      this.consume();
      const word = (t as any).value;

      if (this.peek().type === 'COLON') {
        this.consume(); // eat colon
        const next = this.peek();

        // Range: field:80-443
        if (next.type === 'NUMBER') {
          const low = (this.consume() as any).value as number;
          if (this.peek().type === 'DASH') {
            this.consume(); // eat dash
            const highToken = this.expect('NUMBER');
            const high = (highToken as any).value as number;
            return { type: 'RangeExpr', field: word, low, high } as RangeExprNode;
          }
          return { type: 'FieldExpr', field: word, value: low } as FieldExprNode;
        }

        // Phrase: field:"nginx web server"
        if (next.type === 'PHRASE') {
          this.consume();
          return { type: 'FieldExpr', field: word, value: (next as any).value } as FieldExprNode;
        }

        // Word / IP / Domain: field:example.com or field:192.168.1.1
        if (next.type === 'WORD') {
          this.consume();
          return { type: 'FieldExpr', field: word, value: (next as any).value } as FieldExprNode;
        }

        return { type: 'FieldExpr', field: word, value: '' } as FieldExprNode;
      }

      return { type: 'TermExpr', value: word } as TermExprNode;
    }

    if (t.type === 'NUMBER') {
      this.consume();
      return { type: 'TermExpr', value: String((t as any).value) } as TermExprNode;
    }

    throw new Error(`Unexpected token in query: ${JSON.stringify(t)}`);
  }
}

export class DorkParser {
  parse(input: string): DorkParseResult {
    const raw = input.trim();
    if (!raw) {
      return {
        success: false,
        error: 'Empty query',
        raw,
      } as ParseError;
    }

    try {
      const tokens = tokenize(raw);
      const parser = new Parser(tokens);
      const ast = parser.parse();
      return { success: true, ast, raw } as ParseResult;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Syntax error',
        raw,
      } as ParseError;
    }
  }

  serialize(node: DorkNode): string {
    switch (node.type) {
      case 'AND': return `(${this.serialize(node.left)} AND ${this.serialize(node.right)})`;
      case 'OR': return `(${this.serialize(node.left)} OR ${this.serialize(node.right)})`;
      case 'NOT': return `(NOT ${this.serialize(node.operand)})`;
      case 'FieldExpr': return typeof node.value === 'string' && node.value.includes(' ')
        ? `${node.field}:"${node.value}"`
        : `${node.field}:${node.value}`;
      case 'RangeExpr': return `${node.field}:${node.low}-${node.high}`;
      case 'PhraseExpr': return `"${node.value}"`;
      case 'TermExpr': return node.value;
    }
  }
}
