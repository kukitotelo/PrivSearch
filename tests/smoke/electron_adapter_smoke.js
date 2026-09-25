const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const testDb = path.join(app.getPath('temp'), `privsearch_adapter_smoke_${Date.now()}.db`);
  try {
    const { SQLiteAdapter } = require(path.join(__dirname, '../../dist/db/SQLiteAdapter.js'));
    const adapter = new SQLiteAdapter(testDb);

    // 1. Initialize schema from dist/db/schema.sql
    await adapter.initialize();

    // 2. Insert test observation
    const now = Date.now();
    const obsId = await adapter.insertObservation({
      source: 'electron-runtime-test',
      sourceType: 'dns',
      timestamp: now,
      type: 'DNS_A',
      value: '192.168.1.100',
      confidence: 1.0,
      observationType: 'OBSERVED',
      rawReference: 'https://test.local',
    });

    if (typeof obsId !== 'number' || obsId <= 0) {
      throw new Error(`Invalid insertObservation return id: ${obsId}`);
    }

    // 3. Upsert domain
    await adapter.upsertDomain({
      domain: 'test-electron.internal',
      firstSeen: now,
      lastSeen: now,
    });

    // 4. Query back domain
    const dom = await adapter.getDomain('test-electron.internal');
    if (!dom || dom.domain !== 'test-electron.internal') {
      throw new Error('getDomain verification failed');
    }

    // 5. Query back observation
    const observations = await adapter.queryObservations({ source: 'electron-runtime-test' });
    if (!observations || observations.length === 0 || observations[0].value !== '192.168.1.100') {
      throw new Error('queryObservations verification failed');
    }

    // 6. Verify stats
    const stats = await adapter.getStats();
    if (stats.domains < 1 || stats.observations < 1) {
      throw new Error(`Stats mismatch: domains=${stats.domains}, obs=${stats.observations}`);
    }

    // 7. Clean up
    await adapter.close();
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

    console.log('ELECTRON_SQLITE_ADAPTER: VERIFIED');
    app.exit(0);
  } catch (err) {
    console.error('ELECTRON_SQLITE_ADAPTER: ERROR -', err.message);
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    app.exit(1);
  }
});
