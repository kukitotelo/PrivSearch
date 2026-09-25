// ============================================================
// PrivSearch – StorageAdapter Interface
// Abstract interface for all DB operations.
// Phase 1: implemented by SQLiteAdapter.
// Future: can be replaced by PostgreSQLAdapter or OpenSearch.
// ============================================================

import { SearchRecord } from '../main/types';

export interface ObservationRecord {
  id?: number;
  source: string;
  sourceType: string;
  timestamp: number;
  type: string;
  value: string;
  confidence: number;
  rawReference?: string;
  firstSeen?: number;
  lastSeen?: number;
  observationType: string;
}

export interface DomainRecord {
  id?: number;
  domain: string;
  firstSeen: number;
  lastSeen: number;
}

export interface IPRecord {
  id?: number;
  ip: string;
  asn?: string;
  country?: string;
  firstSeen: number;
  lastSeen: number;
}

export interface RelationshipRecord {
  id?: number;
  fromType: string;
  fromValue: string;
  toType: string;
  toValue: string;
  relationshipType: string;
  confidence: number;
  source: string;
  timestamp: number;
}

export interface StorageAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Observations
  insertObservation(obs: ObservationRecord): Promise<number>;
  queryObservations(filter: Partial<ObservationRecord>): Promise<ObservationRecord[]>;

  // Domains
  upsertDomain(domain: DomainRecord): Promise<void>;
  getDomain(domain: string): Promise<DomainRecord | null>;

  // IPs
  upsertIP(ip: IPRecord): Promise<void>;
  getIP(ip: string): Promise<IPRecord | null>;

  // Relationships
  insertRelationship(rel: RelationshipRecord): Promise<void>;
  getRelationships(fromValue: string): Promise<RelationshipRecord[]>;

  // Maintenance
  clearAll(): Promise<void>;
  getStats(): Promise<{ domains: number; ips: number; observations: number; relationships: number }>;
}
