const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  try {
    let sqlite;
    try {
      sqlite = require('node:sqlite');
    } catch (importErr) {
      console.log('ELECTRON_NODE_SQLITE: NOT_SUPPORTED - ' + importErr.message);
      app.exit(1);
      return;
    }

    if (!sqlite || !sqlite.DatabaseSync) {
      console.log('ELECTRON_NODE_SQLITE: NOT_SUPPORTED - DatabaseSync is undefined in Electron runtime');
      app.exit(1);
      return;
    }

    const testDbPath = path.join(app.getPath('temp'), `privsearch_smoke_${Date.now()}.db`);
    const db = new sqlite.DatabaseSync(testDbPath);

    // 1 & 2. Create table
    db.exec('CREATE TABLE smoke_test (id INTEGER PRIMARY KEY, msg TEXT NOT NULL);');

    // 3. Insert record
    const insertStmt = db.prepare('INSERT INTO smoke_test (msg) VALUES (?)');
    insertStmt.run('PrivSearch Electron DatabaseSync Verification');

    // 4. Read record
    const selectStmt = db.prepare('SELECT * FROM smoke_test WHERE id = 1');
    const row = selectStmt.get();

    if (!row || row.msg !== 'PrivSearch Electron DatabaseSync Verification') {
      console.log('ELECTRON_NODE_SQLITE: ERROR - Insert/Select verification mismatch');
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      app.exit(1);
      return;
    }

    // 5. Close database
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    // 6. Print confirmation
    console.log('SQLITE_ELECTRON_OK');
    console.log('ELECTRON_NODE_SQLITE: VERIFIED');
    app.exit(0);
  } catch (err) {
    console.error('ELECTRON_NODE_SQLITE: ERROR', err);
    app.exit(1);
  }
});
