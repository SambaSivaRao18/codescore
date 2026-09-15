const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'competition.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    process.exit(1);
  } else {
    console.log('Connected to the SQLite database.');

    // Recalculate team scores
    const query = `
      UPDATE Team
      SET teamScore = (
        SELECT COALESCE(SUM(c.marks), 0)
        FROM student_progress sp
        JOIN Challenges c ON sp.questionId = c.challengeID
        WHERE sp.studentId = Team.teamID AND sp.status = 'solved'
      )
    `;

    db.run(query, [], function(err) {
      if (err) {
        console.error('Error updating scores:', err.message);
      } else {
        console.log(`Updated scores for teams. Changes: ${this.changes}`);
      }
      db.close();
    });
  }
});
