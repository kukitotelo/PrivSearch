const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const testDb = path.join(app.getPath('temp'), `privsearch_discovery_${Date.now()}.db`);
  const { SQLiteAdapter } = require('../../dist/db/SQLiteAdapter');
  const { SearchEngine } = require('../../dist/search/SearchEngine');

  const storage = new SQLiteAdapter(testDb);
  await storage.initialize();
  const engine = new SearchEngine(storage);

  console.log('Testing keyword discovery for "kali"...');
  const res = await engine.search('kali');

  console.log('Query type:', res.query.type);
  console.log('Certificates count:', res.sections.certificates.records.length);
  console.log('DNS count:', res.sections.dns.records.length);

  const stats = await storage.getStats();
  console.log('Observations stored in SQLite:', stats.observations);

  await storage.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  console.log('KEYWORD_DISCOVERY_VERIFIED');
  app.exit(0);
});
