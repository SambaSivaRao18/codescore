const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'competition.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    db.serialize(() => {
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
        // Migration: Add questionNumber to existing table if it doesn't exist
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

      // Seed dummy data if empty
      db.get("SELECT COUNT(*) AS count FROM Team", (err, row) => {
        if (!err && row && row.count === 0) {
          db.run(`INSERT INTO Team (teamName, password, teamScore) VALUES ('team1', 'password123', 0)`);
          db.run(`INSERT INTO Team (teamName, password, teamScore) VALUES ('team2', 'password123', 0)`);
        }
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
