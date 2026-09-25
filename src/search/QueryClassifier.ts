// ============================================================
// PrivSearch – QueryClassifier
// Detects what type of input the user entered:
//   URL, domain, IP, ASN, Dork query, or plain text
// ============================================================

import { ClassifiedQuery, QueryType } from '../main/types';

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
const IPV6_RE = /^(\[?)(([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})\]?$/;
const DOMAIN_RE = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const URL_RE = /^https?:\/\//;
const ASN_RE = /^AS\d+$/i;
// Dork: contains a known field operator
const DORK_FIELDS = ['domain', 'hostname', 'ip', 'asn', 'port', 'service', 'cert',
                     'certificate', 'technology', 'site', 'url', 'inurl', 'intitle',
                     'intext', 'filetype'];

export class QueryClassifier {
  classify(raw: string): ClassifiedQuery {
    const trimmed = raw.trim();

    if (!trimmed) {
      return { raw: trimmed, type: 'PLAIN_TEXT', normalizedValue: '' };
    }

    // Full URL
    if (URL_RE.test(trimmed)) {
      return { raw: trimmed, type: 'URL', normalizedValue: trimmed };
    }

    // ASN
    if (ASN_RE.test(trimmed)) {
      return { raw: trimmed, type: 'ASN', normalizedValue: trimmed.toUpperCase() };
    }

    // IP address (v4 or v6)
    if (IPV4_RE.test(trimmed) || IPV6_RE.test(trimmed)) {
      return { raw: trimmed, type: 'IP', normalizedValue: trimmed };
    }

    // Dork query – contains field:value operators or boolean keywords
    const hasDorkField = DORK_FIELDS.some(f => {
      const re = new RegExp(`\\b${f}\\s*:`, 'i');
      return re.test(trimmed);
    });
    const hasBooleans = /\b(AND|OR|NOT)\b/.test(trimmed);
    const hasQuotes = trimmed.includes('"');

    if (hasDorkField || hasBooleans) {
      return { raw: trimmed, type: 'DORK', normalizedValue: trimmed };
    }

    // Plain domain (no spaces, has at least one dot with valid TLD)
    if (!trimmed.includes(' ') && DOMAIN_RE.test(trimmed)) {
      return { raw: trimmed, type: 'DOMAIN', normalizedValue: trimmed.toLowerCase() };
    }

    // Quoted phrase or multi-word = plain text or implicit dork
    return { raw: trimmed, type: 'PLAIN_TEXT', normalizedValue: trimmed };
  }

  /**
   * If a DOMAIN input looks navigable (user wants to browse to it),
   * we return a suggested navigation URL.
   */
  suggestNavigation(classified: ClassifiedQuery): string | null {
    if (classified.type === 'URL') return classified.normalizedValue;
    if (classified.type === 'DOMAIN') return `https://${classified.normalizedValue}`;
    if (classified.type === 'IP') return `http://${classified.normalizedValue}`;
    return null;
  }
}
