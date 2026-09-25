-- PrivSearch SQLite Schema
-- Designed to migrate to PostgreSQL/OpenSearch later
-- All timestamps are Unix epoch milliseconds

CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL UNIQUE,
  asn TEXT,
  country TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dns_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  record_type TEXT NOT NULL,
  value TEXT NOT NULL,
  ttl INTEGER,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  UNIQUE(domain, record_type, value)
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  common_name TEXT NOT NULL,
  issuer TEXT,
  subject TEXT,
  san TEXT, -- comma-separated SANs
  not_before INTEGER,
  not_after INTEGER,
  source TEXT NOT NULL,
  raw_reference TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT,
  service_name TEXT,
  banner TEXT,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  UNIQUE(ip, port, protocol)
);

CREATE TABLE IF NOT EXISTS technologies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  ip TEXT,
  technology TEXT NOT NULL,
  version TEXT,
  category TEXT,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  snippet TEXT,
  domain TEXT,
  status_code INTEGER,
  content_type TEXT,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  raw_reference TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  observation_type TEXT NOT NULL DEFAULT 'UNVERIFIED'
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  url TEXT,
  requires_key INTEGER NOT NULL DEFAULT 0,
  last_queried INTEGER,
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_type TEXT NOT NULL,
  from_value TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_value TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_value ON observations(value);
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source);
CREATE INDEX IF NOT EXISTS idx_dns_domain ON dns_records(domain);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_type, from_value);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_type, to_value);
CREATE INDEX IF NOT EXISTS idx_urls_domain ON urls(domain);
