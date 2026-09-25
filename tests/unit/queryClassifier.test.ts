import { QueryClassifier } from '../../src/search/QueryClassifier';

describe('QueryClassifier Tests', () => {
  const classifier = new QueryClassifier();

  test('Classifies full URL', () => {
    const res = classifier.classify('https://example.com/test');
    expect(res.type).toBe('URL');
  });

  test('Classifies plain domain', () => {
    const res = classifier.classify('example.com');
    expect(res.type).toBe('DOMAIN');
    expect(res.normalizedValue).toBe('example.com');
  });

  test('Classifies IPv4', () => {
    const res = classifier.classify('192.168.1.1');
    expect(res.type).toBe('IP');
  });

  test('Classifies ASN', () => {
    const res = classifier.classify('AS15169');
    expect(res.type).toBe('ASN');
    expect(res.normalizedValue).toBe('AS15169');
  });

  test('Classifies Dork expression', () => {
    const res = classifier.classify('domain:example.com AND port:443');
    expect(res.type).toBe('DORK');
  });

  test('Classifies plain text search', () => {
    const res = classifier.classify('cybersecurity research report');
    expect(res.type).toBe('PLAIN_TEXT');
  });
});
