import * as fs from 'fs';
import * as path from 'path';
import { SQLiteAdapter } from '../../src/db/SQLiteAdapter';

describe('PrivSearch SQLiteAdapter Tests', () => {
  const testDbPath = path.join(__dirname, 'test_privsearch.db');
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    adapter = new SQLiteAdapter(testDbPath);
    await adapter.initialize();
  });

  afterAll(async () => {
    await adapter.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('Initializes tables and gets initial zero stats', async () => {
    const stats = await adapter.getStats();
    expect(stats.domains).toBe(0);
    expect(stats.observations).toBe(0);
  });

  test('Inserts and retrieves domain', async () => {
    const now = Date.now();
    await adapter.upsertDomain({ domain: 'example.com', firstSeen: now, lastSeen: now });
    const dom = await adapter.getDomain('example.com');
    expect(dom).not.toBeNull();
    expect(dom?.domain).toBe('example.com');
  });

  test('Inserts and queries observation', async () => {
    const id = await adapter.insertObservation({
      source: 'test-source',
      sourceType: 'dns',
      timestamp: Date.now(),
      type: 'DNS_A',
      value: '93.184.216.34',
      confidence: 1.0,
      observationType: 'OBSERVED',
    });
    expect(id).toBeGreaterThan(0);

    const obs = await adapter.queryObservations({ source: 'test-source' });
    expect(obs.length).toBe(1);
    expect(obs[0].value).toBe('93.184.216.34');
  });
});
