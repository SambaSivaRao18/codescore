const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'competition.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) throw err;
  db.all("SELECT teamID, teamName, firstLoginAt, lastSeen FROM Team", [], (err, rows) => {
    if (err) throw err;
    console.table(rows.slice(0, 5));
    db.close();
  });
});
