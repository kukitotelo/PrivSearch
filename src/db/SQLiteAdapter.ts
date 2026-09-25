// ============================================================
// PrivSearch – SQLiteAdapter
// Uses built-in node:sqlite (DatabaseSync) available in Node 22+.
// Zero native compilation / zero node-gyp dependencies.
// ============================================================

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import {
  StorageAdapter, ObservationRecord, DomainRecord,
  IPRecord, RelationshipRecord
} from './StorageAdapter';

export class SQLiteAdapter implements StorageAdapter {
  private db?: DatabaseSync;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  private resolveSchemaPath(): string {
    const localPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(localPath)) return localPath;

    const srcPath = path.resolve(__dirname, '../../src/db/schema.sql');
    if (fs.existsSync(srcPath)) return srcPath;

    const rootPath = path.resolve(__dirname, '../src/db/schema.sql');
    if (fs.existsSync(rootPath)) return rootPath;

    throw new Error(`schema.sql not found at ${localPath} or ${srcPath}`);
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    const schemaFile = this.resolveSchemaPath();
    const schema = fs.readFileSync(schemaFile, 'utf-8');
    this.db.exec(schema);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  private get(): DatabaseSync {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }

  async insertObservation(obs: ObservationRecord): Promise<number> {
    const db = this.get();
    const stmt = db.prepare(`
      INSERT INTO observations
        (source, source_type, timestamp, type, value, confidence,
         raw_reference, first_seen, last_seen, observation_type)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      obs.source,
      obs.sourceType,
      obs.timestamp,
      obs.type,
      obs.value,
      obs.confidence,
      obs.rawReference || null,
      obs.firstSeen || null,
      obs.lastSeen || null,
      obs.observationType
    );
    return Number(result.lastInsertRowid);
  }

  async queryObservations(filter: Partial<ObservationRecord>): Promise<ObservationRecord[]> {
    const db = this.get();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.type) { conditions.push('type = ?'); params.push(filter.type); }
    if (filter.source) { conditions.push('source = ?'); params.push(filter.source); }
    if (filter.value) { conditions.push('value LIKE ?'); params.push(`%${filter.value}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`SELECT * FROM observations ${where} ORDER BY timestamp DESC LIMIT 500`);
    const rows = stmt.all(...params) as any[];

    return rows.map((r: any) => ({
      id: r.id,
      source: r.source,
      sourceType: r.source_type,
      timestamp: r.timestamp,
      type: r.type,
      value: r.value,
      confidence: r.confidence,
      rawReference: r.raw_reference,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      observationType: r.observation_type,
    }));
  }

  async upsertDomain(domain: DomainRecord): Promise<void> {
    const db = this.get();
    db.prepare(`
      INSERT INTO domains (domain, first_seen, last_seen)
      VALUES (?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET last_seen = excluded.last_seen
    `).run(domain.domain, domain.firstSeen, domain.lastSeen);
  }

  async getDomain(domain: string): Promise<DomainRecord | null> {
    const db = this.get();
    const row = db.prepare('SELECT * FROM domains WHERE domain = ?').get(domain) as any;
    if (!row) return null;
    return { id: row.id, domain: row.domain, firstSeen: row.first_seen, lastSeen: row.last_seen };
  }

  async upsertIP(ip: IPRecord): Promise<void> {
    const db = this.get();
    db.prepare(`
      INSERT INTO ips (ip, asn, country, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET last_seen = excluded.last_seen,
        asn = COALESCE(excluded.asn, ips.asn),
        country = COALESCE(excluded.country, ips.country)
    `).run(ip.ip, ip.asn || null, ip.country || null, ip.firstSeen, ip.lastSeen);
  }

  async getIP(ip: string): Promise<IPRecord | null> {
    const db = this.get();
    const row = db.prepare('SELECT * FROM ips WHERE ip = ?').get(ip) as any;
    if (!row) return null;
    return { id: row.id, ip: row.ip, asn: row.asn, country: row.country, firstSeen: row.first_seen, lastSeen: row.last_seen };
  }

  async insertRelationship(rel: RelationshipRecord): Promise<void> {
    const db = this.get();
    db.prepare(`
      INSERT INTO relationships
        (from_type, from_value, to_type, to_value, relationship_type, confidence, source, timestamp)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rel.fromType,
      rel.fromValue,
      rel.toType,
      rel.toValue,
      rel.relationshipType,
      rel.confidence,
      rel.source,
      rel.timestamp
    );
  }

  async getRelationships(fromValue: string): Promise<RelationshipRecord[]> {
    const db = this.get();
    const rows = db.prepare(
      'SELECT * FROM relationships WHERE from_value = ? OR to_value = ? ORDER BY timestamp DESC'
    ).all(fromValue, fromValue) as any[];

    return rows.map((r: any) => ({
      id: r.id,
      fromType: r.from_type,
      fromValue: r.from_value,
      toType: r.to_type,
      toValue: r.to_value,
      relationshipType: r.relationship_type,
      confidence: r.confidence,
      source: r.source,
      timestamp: r.timestamp,
    }));
  }

  async clearAll(): Promise<void> {
    const db = this.get();
    db.exec(`
      DELETE FROM observations;
      DELETE FROM domains;
      DELETE FROM ips;
      DELETE FROM dns_records;
      DELETE FROM certificates;
      DELETE FROM services;
      DELETE FROM technologies;
      DELETE FROM urls;
      DELETE FROM relationships;
    `);
  }

  async getStats(): Promise<{ domains: number; ips: number; observations: number; relationships: number }> {
    const db = this.get();
    const d = db.prepare('SELECT COUNT(*) as c FROM domains').get() as any;
    const i = db.prepare('SELECT COUNT(*) as c FROM ips').get() as any;
    const o = db.prepare('SELECT COUNT(*) as c FROM observations').get() as any;
    const r = db.prepare('SELECT COUNT(*) as c FROM relationships').get() as any;
    return {
      domains: d.c,
      ips: i.c,
      observations: o.c,
      relationships: r.c,
    };
  }
}
