require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// On Render, use DB_PATH env var if set, otherwise default to local file.
// NOTE: Render's filesystem is ephemeral — data resets on redeploy unless
// you use a Render Disk or an external DB. DB_PATH lets you mount a persistent disk.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, 'competition.db');

console.log(`[DB] Using database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    db.serialize(() => {
      // Enable WAL mode for better concurrency
      db.run('PRAGMA journal_mode=WAL');

      // Create Team Table
      db.run(`CREATE TABLE IF NOT EXISTS Team (
        teamID INTEGER PRIMARY KEY AUTOINCREMENT,
        teamName TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        teamScore INTEGER DEFAULT 0,
        currentLevel TEXT DEFAULT 'low',
        isDisqualified BOOLEAN DEFAULT 0,
        lastSeen DATETIME,
        firstLoginAt DATETIME
      )`, () => {
        db.run(`ALTER TABLE Team ADD COLUMN firstLoginAt DATETIME`, () => {});
      });

      // Create Challenge Table
      db.run(`CREATE TABLE IF NOT EXISTS Challenges (
        challengeID INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        marks INTEGER NOT NULL,
        testCases TEXT NOT NULL,
        questionNumber INTEGER
      )`, () => {
        db.run(`ALTER TABLE Challenges ADD COLUMN questionNumber INTEGER`, (err) => {
          // Ignore error if column already exists
        });
      });

      // Create Student Progress Table (Source of truth for sequential question unlocking)
      db.run(`CREATE TABLE IF NOT EXISTS student_progress (
        studentId INTEGER NOT NULL,
        questionId INTEGER NOT NULL,
        status TEXT DEFAULT 'locked',
        allTestsPassed BOOLEAN DEFAULT 0,
        solvedAt DATETIME,
        solvedLanguage TEXT,
        PRIMARY KEY (studentId, questionId)
      )`, () => {
        db.run(`ALTER TABLE student_progress ADD COLUMN solvedLanguage TEXT`, () => {});
      });

      // Seed real data (using INSERT OR IGNORE to add them safely if they don't exist)
      const initialTeams = [
        { teamName: 'codescore', password: 'samba123' },
        { teamName: 'phalgunichinni@gmail.com', password: '8897338969' },
        { teamName: 'varshithadarapaneni@gmail.com', password: '8143571859' },
        { teamName: 'santhoshkumar2006dommeti@gmail.com', password: '7569641633' },
        { teamName: 'ramyadungala2@gmail.com', password: '8897308263' },
        { teamName: 'mounikamadala05@gmail.com', password: '9849332055' },
        { teamName: 'pavithra6305329127@gmail.com', password: '6305329127' },
        { teamName: 'ksknani6@gmail.com', password: '7793958103' },
        { teamName: 'shaikmehatajbegum123@gmail.com', password: '6300437458' },
        { teamName: 'lohigatta@gmail.com', password: '839454345' },
        { teamName: 'nehajalapati8@gmail.com', password: '6302276252' },
        { teamName: 'kavitha62429@gmail.com', password: '9659912777' },
        { teamName: 'yaswanthipasam15@gmail.com', password: '8341423279' },
        { teamName: 'ushaswiniindurthi@gmail.com', password: '8919676994' },
        { teamName: 'komalichebrolu@gmail.com', password: '9121048594' },
        { teamName: 'chpallavi74@gmail.com', password: '9014570840' },
        { teamName: 'ravibabukushal@gmail.com', password: '9032504192' },
        { teamName: 'dr.saitejasri@gmail.com', password: '8074634846' },
        { teamName: 'iniyam68@gmail.com', password: '9618718221' },
        { teamName: 'kevsnagaachyuth@gmail.com', password: '7780335379' },
        { teamName: 'kummithimahendrareddy@gmail.com', password: '7097138529' },
        { teamName: 'ruksaarmohammad14@gmail.com', password: '9390579993' },
        { teamName: 'neelapuchetan045@gmail.com', password: '9346690245' },
        { teamName: 'pallilokesh1993@gmail.com', password: '8096575880' },
        { teamName: 's40823829@gmail.com', password: '7013862633' },
        { teamName: 'rashid14102008@gmail.com', password: '8340857003' },
        { teamName: 'team', password: '123' }
      ];

      initialTeams.forEach(team => {
        db.run(
          `INSERT OR IGNORE INTO Team (teamName, password, teamScore) VALUES (?, ?, 0)`,
          [team.teamName, team.password],
          (err) => {
            if (err) console.error("Error seeding team:", team.teamName, err.message);
          }
        );
      });

      db.get("SELECT COUNT(*) AS count FROM Challenges", (err, row) => {
        if (!err && row && row.count === 0) {
          db.run(`INSERT INTO Challenges (level, title, description, marks, testCases, questionNumber) VALUES 
            ('low', 'Print Hello World', 'Write a program that prints "Hello World" to standard output.', 10, '[{"input":"","expectedOutput":"Hello World","isHidden":false}]', 1)`);
          db.run(`INSERT INTO Challenges (level, title, description, marks, testCases, questionNumber) VALUES 
            ('medium', 'Sum of Two Numbers', 'Given two integers on standard input (each on a new line or space-separated), print their sum.', 20, '[{"input":"5\\n10","expectedOutput":"15","isHidden":false}, {"input":"20\\n30","expectedOutput":"50","isHidden":true}, {"input":"-5\\n10","expectedOutput":"5","isHidden":true}]', 2)`);
          db.run(`INSERT INTO Challenges (level, title, description, marks, testCases, questionNumber) VALUES 
            ('hard', 'Reverse String', 'Write a program that reads a string from standard input and prints it in reverse.', 30, '[{"input":"hello","expectedOutput":"olleh","isHidden":false}, {"input":"racecar","expectedOutput":"racecar","isHidden":true}, {"input":"CodeScore","expectedOutput":"eroCSedoC","isHidden":true}]', 3)`);
        }
      });
    });
  }
});

module.exports = db;
