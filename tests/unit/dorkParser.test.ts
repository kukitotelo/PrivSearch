import { DorkParser } from '../../src/search/dork/DorkParser';
import {
  FieldExprNode, RangeExprNode, PhraseExprNode,
  TermExprNode, AndNode, OrNode, NotNode
} from '../../src/search/dork/DorkTypes';

describe('PrivSearch DorkParser Exhaustive Tests', () => {
  const parser = new DorkParser();

  test('1. Simple domain field', () => {
    const res = parser.parse('domain:example.com');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('FieldExpr');
    const node = res.ast as FieldExprNode;
    expect(node.field).toBe('domain');
    expect(node.value).toBe('example.com');
  });

  test('2. IP field', () => {
    const res = parser.parse('ip:192.168.1.1');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('FieldExpr');
    const node = res.ast as FieldExprNode;
    expect(node.field).toBe('ip');
    expect(node.value).toBe('192.168.1.1');
  });

  test('3. Numeric port field', () => {
    const res = parser.parse('port:443');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('FieldExpr');
    const node = res.ast as FieldExprNode;
    expect(node.field).toBe('port');
    expect(node.value).toBe(443);
  });

  test('4. Numeric range port field', () => {
    const res = parser.parse('port:80-443');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('RangeExpr');
    const node = res.ast as RangeExprNode;
    expect(node.field).toBe('port');
    expect(node.low).toBe(80);
    expect(node.high).toBe(443);
  });

  test('5. Explicit AND operator', () => {
    const res = parser.parse('domain:example.com AND port:443');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('AND');
    const andNode = res.ast as AndNode;
    expect(andNode.left.type).toBe('FieldExpr');
    expect(andNode.right.type).toBe('FieldExpr');
  });

  test('6. Explicit OR operator', () => {
    const res = parser.parse('domain:example.com OR domain:test.com');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('OR');
    const orNode = res.ast as OrNode;
    expect(orNode.left.type).toBe('FieldExpr');
    expect(orNode.right.type).toBe('FieldExpr');
  });

  test('7. NOT operator', () => {
    const res = parser.parse('NOT port:22');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('NOT');
    const notNode = res.ast as NotNode;
    expect(notNode.operand.type).toBe('FieldExpr');
    expect((notNode.operand as FieldExprNode).field).toBe('port');
    expect((notNode.operand as FieldExprNode).value).toBe(22);
  });

  test('8. Grouping with parentheses: (A OR B) AND C', () => {
    const res = parser.parse('(domain:example.com OR domain:test.com) AND port:443');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('AND');
    const andNode = res.ast as AndNode;
    expect(andNode.left.type).toBe('OR');
    expect(andNode.right.type).toBe('FieldExpr');
  });

  test('9. Quoted value in field', () => {
    const res = parser.parse('service:"nginx"');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('FieldExpr');
    const node = res.ast as FieldExprNode;
    expect(node.field).toBe('service');
    expect(node.value).toBe('nginx');
  });

  test('10. Exact phrase standalone', () => {
    const res = parser.parse('"exact phrase"');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('PhraseExpr');
    const node = res.ast as PhraseExprNode;
    expect(node.value).toBe('exact phrase');
  });

  test('11. Implicit AND between terms: foo bar', () => {
    const res = parser.parse('foo bar');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('AND');
    const andNode = res.ast as AndNode;
    expect(andNode.left.type).toBe('TermExpr');
    expect((andNode.left as TermExprNode).value).toBe('foo');
    expect(andNode.right.type).toBe('TermExpr');
    expect((andNode.right as TermExprNode).value).toBe('bar');
  });

  test('12. Precedence: NOT > AND > OR without parentheses', () => {
    // A OR B AND NOT C -> A OR (B AND (NOT C))
    const res = parser.parse('domain:a.com OR domain:b.com AND NOT port:22');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.ast.type).toBe('OR');
    const orNode = res.ast as OrNode;
    expect(orNode.left.type).toBe('FieldExpr');
    expect(orNode.right.type).toBe('AND');
    const andNode = orNode.right as AndNode;
    expect(andNode.left.type).toBe('FieldExpr');
    expect(andNode.right.type).toBe('NOT');
  });

  test('13. Error handling: empty or unbalanced query', () => {
    const emptyRes = parser.parse('   ');
    expect(emptyRes.success).toBe(false);

    const unclosedParen = parser.parse('(domain:example.com AND port:443');
    expect(unclosedParen.success).toBe(false);
  });
});
