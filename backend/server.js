const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const { executeCode, SUPPORTED_LANGUAGES } = require('./executor');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

// Rate limiting state: map teamID -> last submission timestamp
const lastSubmissionMap = new Map();
const RATE_LIMIT_MS = 1500; // Minimum 1.5s between submissions per team

/**
 * Normalize output string safely:
 * - Trims leading and trailing whitespace
 * - Normalizes CRLF (\r\n) line endings to LF (\n)
 * - Trims trailing whitespace from each line
 */
function normalizeOutput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Helper: Ensure student_progress table has initial rows for a given teamID
 */
function ensureStudentProgress(teamID) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT challengeID, questionNumber FROM Challenges ORDER BY questionNumber ASC, challengeID ASC`, [], (err, challenges) => {
      if (err) return reject(err);
      if (!challenges || challenges.length === 0) return resolve();

      db.all(`SELECT questionId FROM student_progress WHERE studentId = ?`, [teamID], (err, existing) => {
        if (err) return reject(err);
        const existingIds = new Set(existing ? existing.map(e => e.questionId) : []);

        const stmt = db.prepare(`INSERT OR IGNORE INTO student_progress (studentId, questionId, status, allTestsPassed) VALUES (?, ?, ?, ?)`);

        challenges.forEach((ch, idx) => {
          if (!existingIds.has(ch.challengeID)) {
            // First question is unlocked by default, all others locked
            const status = idx === 0 ? 'unlocked' : 'locked';
            stmt.run(teamID, ch.challengeID, status, 0);
          }
        });

        stmt.finalize((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
}

function getTimerDetails(firstLoginAt) {
  const TOTAL_DURATION_SECONDS = 3600; // 1 hour total competition duration
  if (!firstLoginAt) {
    return { firstLoginAt: null, timerSecondsRemaining: TOTAL_DURATION_SECONDS, isExpired: false };
  }
  const startMs = new Date(firstLoginAt).getTime();
  const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
  const remainingSeconds = Math.max(0, TOTAL_DURATION_SECONDS - elapsedSeconds);
  return {
    firstLoginAt,
    timerSecondsRemaining: remainingSeconds,
    isExpired: remainingSeconds <= 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Disqualification Background Worker (Runs every 5 seconds)
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
  const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
  db.run(
    `UPDATE Team SET isDisqualified = 1 WHERE lastSeen < ? AND isDisqualified = 0`,
    [fifteenSecondsAgo],
    function (err) {
      if (err) {
        console.error('Error updating disqualification:', err);
      } else if (this.changes > 0) {
        console.log(`Disqualified ${this.changes} team(s) due to inactivity.`);
      }
    }
  );
}, 5000);

// ─────────────────────────────────────────────────────────────────────────────
// Authentication & Heartbeat & Disqualification
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { teamName, password } = req.body;
  db.get(`SELECT * FROM Team WHERE teamName = ? AND password = ?`, [teamName, password], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error during login' });
    if (!row) return res.status(401).json({ error: 'Invalid team credentials' });
    if (row.isDisqualified) return res.status(403).json({ error: 'Team is disqualified', isDisqualified: true });

    const now = new Date().toISOString();
    const firstLoginTime = row.firstLoginAt || now;
    db.run(`UPDATE Team SET lastSeen = ?, firstLoginAt = COALESCE(firstLoginAt, ?) WHERE teamID = ?`, [now, now, row.teamID]);

    try {
      await ensureStudentProgress(row.teamID);
    } catch (e) {
      console.error('Failed to initialize student progress:', e);
    }

    const timerInfo = getTimerDetails(firstLoginTime);

    res.json({
      message: 'Login successful',
      teamID: row.teamID,
      teamName: row.teamName,
      level: row.currentLevel,
      firstLoginAt: firstLoginTime,
      timerSecondsRemaining: timerInfo.timerSecondsRemaining,
      isExpired: timerInfo.isExpired
    });
  });
});

app.post('/api/heartbeat', (req, res) => {
  const { teamID } = req.body;
  if (!teamID) return res.status(400).json({ error: 'teamID required' });

  db.get(`SELECT isDisqualified, firstLoginAt FROM Team WHERE teamID = ?`, [teamID], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Team not found' });
    if (row.isDisqualified) return res.status(403).json({ error: 'Team is disqualified' });

    const now = new Date().toISOString();
    const timerInfo = getTimerDetails(row.firstLoginAt || now);
    db.run(`UPDATE Team SET lastSeen = ? WHERE teamID = ?`, [now, teamID], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, timerSecondsRemaining: timerInfo.timerSecondsRemaining, isExpired: timerInfo.isExpired });
    });
  });
});

app.post('/api/disqualify', (req, res) => {
  const { teamID, reason } = req.body;
  if (!teamID) return res.status(400).json({ error: 'teamID required' });

  db.run(`UPDATE Team SET isDisqualified = 1 WHERE teamID = ?`, [teamID], function (err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    console.log(`Team ${teamID} disqualified. Reason: ${reason || 'Window closed or minimized > 10s'}`);
    res.json({ success: true, message: 'Team disqualified' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Questions & Progression Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/questions -> Returns full list of questions with unlocked/solved status for student
app.get('/api/questions', async (req, res) => {
  const { teamID } = req.query;
  if (!teamID) return res.status(400).json({ error: 'teamID required' });

  try {
    await ensureStudentProgress(teamID);

    const query = `
      SELECT 
        c.challengeID as questionId,
        c.questionNumber,
        c.title,
        c.description,
        c.level,
        c.marks,
        c.testCases,
        COALESCE(sp.status, 'locked') as status,
        COALESCE(sp.allTestsPassed, 0) as allTestsPassed
      FROM Challenges c
      LEFT JOIN student_progress sp ON sp.questionId = c.challengeID AND sp.studentId = ?
      ORDER BY c.questionNumber ASC, c.challengeID ASC
    `;

    db.all(query, [teamID], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const sanitizedRows = rows.map((q, arrayIdx) => {
        let testCases = [];
        try {
          testCases = JSON.parse(q.testCases);
        } catch (e) {}

        // Filter hidden test cases from standard list returned to client
        const publicTestCases = testCases
          .filter(tc => !tc.isHidden)
          .map((tc, idx) => ({
            testCaseNumber: idx + 1,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: false
          }));

        return {
          questionId: q.questionId,
          // displayNumber is always 1, 2, 3... based on sorted order regardless of DB questionNumber
          questionNumber: arrayIdx + 1,
          title: q.title,
          description: q.status === 'locked' ? 'Locked question. Complete previous questions first.' : q.description,
          level: q.level,
          marks: q.marks,
          status: q.status,
          allTestsPassed: Boolean(q.allTestsPassed),
          publicTestCases: q.status === 'locked' ? [] : publicTestCases,
          totalTestCases: testCases.length,
        };
      });

      res.json(sanitizedRows);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenge -> Returns specific question details for student
app.get('/api/challenge', async (req, res) => {
  const { teamID, questionId } = req.query;
  if (!teamID) return res.status(400).json({ error: 'teamID required' });

  try {
    await ensureStudentProgress(teamID);

    db.get(`SELECT isDisqualified FROM Team WHERE teamID = ?`, [teamID], (err, team) => {
      if (err || !team) return res.status(404).json({ error: 'Team not found' });
      if (team.isDisqualified) return res.status(403).json({ error: 'Team is disqualified' });

      let sql = `
        SELECT 
          c.challengeID as questionId,
          c.questionNumber,
          c.title,
          c.description,
          c.level,
          c.marks,
          c.testCases,
          COALESCE(sp.status, 'locked') as status
        FROM Challenges c
        LEFT JOIN student_progress sp ON sp.questionId = c.challengeID AND sp.studentId = ?
      `;
      let params = [teamID];

      if (questionId) {
        sql += ` WHERE c.challengeID = ?`;
        params.push(questionId);
      } else {
        // Default to active unlocked/unsolved question or latest unlocked
        sql += ` WHERE sp.status IN ('unlocked', 'solved') ORDER BY c.questionNumber ASC LIMIT 1`;
      }

      db.get(sql, params, (err, challenge) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!challenge) return res.status(404).json({ error: 'No question available' });

        if (challenge.status === 'locked') {
          return res.status(403).json({ error: 'This question is locked. Solve preceding questions first.' });
        }

        db.get(`SELECT COUNT(*) as totalQuestions FROM Challenges`, (err, totalRow) => {
          // Compute sequential display number (1-based) from sorted order
          db.all(`SELECT challengeID FROM Challenges ORDER BY questionNumber ASC, challengeID ASC`, [], (err2, allChallenges) => {
            const displayNumber = allChallenges
              ? allChallenges.findIndex(c => c.challengeID === challenge.questionId) + 1
              : (challenge.questionNumber || 1);

            let testCases = [];
            try {
              testCases = JSON.parse(challenge.testCases);
            } catch (e) {}

            const publicTestCases = testCases
              .filter(tc => !tc.isHidden)
              .map((tc, idx) => ({
                testCaseNumber: idx + 1,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: false
              }));

            res.json({
              challengeID: challenge.questionId,
              questionId: challenge.questionId,
              questionNumber: displayNumber,
              title: challenge.title,
              description: challenge.description,
              level: challenge.level,
              marks: challenge.marks,
              status: challenge.status,
              sampleTestCases: publicTestCases,
              testCases: publicTestCases,
              totalTestCases: testCases.length,
              totalQuestions: totalRow ? totalRow.totalQuestions : 0,
            });
          });
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runtimes -> Expose supported languages allowlist
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/runtimes', (req, res) => {
  res.json(SUPPORTED_LANGUAGES.map(lang => ({ language: lang })));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/submissions (or /api/submit) -> Grade submission server-side
// ─────────────────────────────────────────────────────────────────────────────
const handleSubmission = async (req, res) => {
  const { teamID, questionId, challengeID, language, code } = req.body;
  const qId = questionId || challengeID;

  if (!teamID || !qId) {
    return res.status(400).json({ error: 'teamID and questionId are required' });
  }

  // Rate Limiting Check
  const lastTime = lastSubmissionMap.get(teamID) || 0;
  const now = Date.now();
  if (now - lastTime < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Submission rate limit exceeded. Please wait a moment.' });
  }
  lastSubmissionMap.set(teamID, now);

  // Validate language against strict allowlist
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `Unsupported language: ${language}. Allowed: ${SUPPORTED_LANGUAGES.join(', ')}` });
  }

  try {
    await ensureStudentProgress(teamID);

    // Verify team disqualification and question progression authorization
    db.get(`SELECT isDisqualified FROM Team WHERE teamID = ?`, [teamID], (err, team) => {
      if (err || !team) return res.status(404).json({ error: 'Team not found' });
      if (team.isDisqualified) return res.status(403).json({ error: 'Team is disqualified' });

      db.get(
        `SELECT sp.status, c.challengeID, c.marks, c.questionNumber, c.testCases 
         FROM student_progress sp
         JOIN Challenges c ON c.challengeID = sp.questionId
         WHERE sp.studentId = ? AND sp.questionId = ?`,
        [teamID, qId],
        async (err, record) => {
          if (err) return res.status(500).json({ error: 'Database query error' });
          if (!record) return res.status(404).json({ error: 'Question not found' });

          // Backend Source of Truth: Prevent locked question submission
          if (record.status === 'locked') {
            return res.status(403).json({ error: 'Question is locked. Solve preceding questions first.' });
          }

          let testCases = [];
          try {
            testCases = JSON.parse(record.testCases);
          } catch (e) {
            return res.status(500).json({ error: 'Corrupted test case data' });
          }

          const results = [];
          let allTestsPassed = true;

          for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            const execResult = await executeCode({
              language,
              code,
              stdin: tc.input || '',
            });

            if (execResult.error || execResult.compileError || execResult.exitCode !== 0) {
              allTestsPassed = false;

              results.push({
                testCase: i + 1,
                passed: false,
                error: execResult.compileError || execResult.error || (execResult.stderr ? `Runtime Error:\n${execResult.stderr}` : 'Execution failed'),
                // NEVER return hidden test case inputs or expected outputs to frontend
                ...(tc.isHidden ? {} : { input: tc.input, expectedOutput: tc.expectedOutput }),
              });
            } else {
              const actualNormalized = normalizeOutput(execResult.stdout);
              const expectedNormalized = normalizeOutput(tc.expectedOutput);
              const passed = actualNormalized === expectedNormalized;

              if (!passed) allTestsPassed = false;

              results.push({
                testCase: i + 1,
                passed,
                // Include details ONLY for public test cases
                ...(tc.isHidden ? {} : {
                  input: tc.input,
                  expectedOutput: expectedNormalized,
                  actualOutput: actualNormalized,
                }),
              });
            }
          }

          if (allTestsPassed) {
            const nowIso = new Date().toISOString();

            // Mark question as solved and record language used
            db.run(
              `UPDATE student_progress SET status = 'solved', allTestsPassed = 1, solvedAt = ?, solvedLanguage = ? WHERE studentId = ? AND questionId = ?`,
              [nowIso, language, teamID, qId],
              (updateErr) => {
                if (updateErr) console.error('Failed to update student_progress:', updateErr);

                // Add points to team score
                db.run(`UPDATE Team SET teamScore = teamScore + ? WHERE teamID = ?`, [record.marks, teamID]);

                // Unlock the next sequential question
                db.all(
                  `SELECT c.challengeID, sp.status 
                   FROM Challenges c
                   LEFT JOIN student_progress sp ON sp.questionId = c.challengeID AND sp.studentId = ?
                   ORDER BY c.questionNumber ASC, c.challengeID ASC`,
                  [teamID],
                  (err, allQs) => {
                    if (!err && allQs) {
                      const currentIdx = allQs.findIndex(q => q.challengeID === Number(qId));
                      if (currentIdx !== -1 && currentIdx + 1 < allQs.length) {
                        const nextQ = allQs[currentIdx + 1];
                        if (nextQ.status !== 'solved') {
                          db.run(
                            `UPDATE student_progress SET status = 'unlocked' WHERE studentId = ? AND questionId = ?`,
                            [teamID, nextQ.challengeID]
                          );
                        }
                      }
                    }

                    res.json({
                      success: true,
                      questionId: Number(qId),
                      passed: true,
                      allTestsPassed: true,
                      nextQuestionUnlocked: true,
                      message: 'All test cases passed! Question solved.',
                      results,
                    });
                  }
                );
              }
            );
          } else {
            res.json({
              success: true,
              questionId: Number(qId),
              passed: false,
              allTestsPassed: false,
              nextQuestionUnlocked: false,
              message: 'Some test cases failed. Fix your solution and try again.',
              results,
            });
          }
        }
      );
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/submissions', handleSubmission);
app.post('/api/submit', handleSubmission);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/run-testcase -> Run code against a public test case for testing
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/run-testcase', async (req, res) => {
  const { teamID, questionId, challengeID, language, code, testCaseIndex = 0 } = req.body;
  const qId = questionId || challengeID;

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  db.get(`SELECT testCases FROM Challenges WHERE challengeID = ?`, [qId], async (err, challenge) => {
    if (err || !challenge) return res.status(404).json({ error: 'Question not found' });

    let testCases = [];
    try {
      testCases = JSON.parse(challenge.testCases);
    } catch (e) {
      return res.status(500).json({ error: 'Corrupted test case data' });
    }

    const tc = testCases[testCaseIndex];
    if (!tc) return res.status(400).json({ error: 'Test case index not found' });

    // If test case is hidden, hide inputs from output
    const isHidden = Boolean(tc.isHidden);

    try {
      const result = await executeCode({
        language,
        code,
        stdin: tc.input || '',
      });

      if (result.compileError) {
        return res.json({
          compile: { code: 1, stderr: result.compileError, output: result.compileError },
          passed: false,
        });
      }

      if (result.error) {
        return res.json({
          run: { code: 1, stderr: result.error, output: result.error },
          passed: false,
        });
      }

      const actualNormalized = normalizeOutput(result.stdout);
      const expectedNormalized = normalizeOutput(tc.expectedOutput);
      const passed = actualNormalized === expectedNormalized;

      res.json({
        run: {
          code: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        },
        passed,
        isHidden,
        ...(isHidden ? {} : { expectedOutput: expectedNormalized, actualOutput: actualNormalized }),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/leaderboard', (req, res) => {
  db.all(`SELECT COUNT(*) as totalCount FROM Challenges`, [], (err, challengeCountRow) => {
    const totalQuestions = challengeCountRow?.[0]?.totalCount || 10;

    db.all(`SELECT teamID, teamName, teamScore, currentLevel, isDisqualified, firstLoginAt, lastSeen FROM Team`, (err, teams) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`SELECT studentId, questionId, status, solvedAt, solvedLanguage FROM student_progress WHERE status = 'solved'`, (err2, progressRows) => {
        const teamMap = {};

        teams.forEach((t) => {
          teamMap[t.teamID] = {
            teamID: t.teamID,
            teamName: t.teamName,
            teamScore: t.teamScore || 0,
            currentLevel: t.currentLevel || 'Gold 2',
            isDisqualified: Boolean(t.isDisqualified),
            firstLoginAt: t.firstLoginAt,
            lastSeen: t.lastSeen,
            pythonSolved: 0,
            javaSolved: 0,
            cSolved: 0,
            totalSolved: 0,
            times: [],
          };
        });

        if (progressRows) {
          progressRows.forEach((pr) => {
            const tObj = teamMap[pr.studentId];
            if (tObj) {
              tObj.totalSolved += 1;
              const lang = (pr.solvedLanguage || 'python').toLowerCase();
              if (lang.includes('python')) tObj.pythonSolved += 1;
              else if (lang.includes('java')) tObj.javaSolved += 1;
              else if (lang.includes('c')) tObj.cSolved += 1;
              else tObj.pythonSolved += 1;

              if (pr.solvedAt) {
                tObj.times.push(new Date(pr.solvedAt).getTime());
              }
            }
          });
        }

        const leaderboardData = Object.values(teamMap).map((t) => {
          let avgTimeMinutes = 0;
          if (t.firstLoginAt && t.times.length > 0) {
            const startMs = new Date(t.firstLoginAt).getTime();
            // Correct formula: time from login to the LAST solved question, divided by number solved.
            // This gives the true average minutes-per-question across the whole session.
            const lastSolveMs = Math.max(...t.times);
            const totalElapsedMs = Math.max(0, lastSolveMs - startMs);
            avgTimeMinutes = Number(((totalElapsedMs / (t.times.length * 60000)) || 0).toFixed(1));
          }

          const pyCount = t.pythonSolved;
          const jaCount = t.javaSolved;
          const cCount = t.cSolved;
          const totalS = t.totalSolved || 0;

          // Fill skill bar based on team completion percentage relative to total questions
          const pythonPct = totalQuestions > 0 ? Math.round((pyCount / totalQuestions) * 100) : 0;
          const javaPct = totalQuestions > 0 ? Math.round((jaCount / totalQuestions) * 100) : 0;
          const cPct = totalQuestions > 0 ? Math.round((cCount / totalQuestions) * 100) : 0;
          const overallPct = totalQuestions > 0 ? Math.round((totalS / totalQuestions) * 100) : 0;

          // Format current level as Low, Medium, or Hard
          let rawLevel = (t.currentLevel || 'low').toLowerCase();
          let displayLevel = 'Low';
          if (rawLevel.includes('hard') || t.teamScore >= 40) displayLevel = 'Hard';
          else if (rawLevel.includes('medium') || t.teamScore >= 20) displayLevel = 'Medium';

          return {
            teamID: t.teamID,
            teamName: t.teamName,
            teamScore: t.teamScore,
            currentLevel: displayLevel,
            isDisqualified: t.isDisqualified,
            avgTime: avgTimeMinutes,
            totalSolved: t.totalSolved,
            totalQuestions: totalQuestions,
            overallPercentage: overallPct,
            skills: [
              { language: 'Python', solved: pyCount, total: totalQuestions, percentage: pythonPct, color: 'from-cyan-400 to-emerald-400' },
              { language: 'Java', solved: jaCount, total: totalQuestions, percentage: javaPct, color: 'from-amber-500 to-rose-500' },
              { language: 'C', solved: cCount, total: totalQuestions, percentage: cPct, color: 'from-blue-500 to-indigo-500' },
            ]
          };
        });

        // Dynamic Rank Calculation:
        // Primary: teamScore DESC (higher points = best rank)
        // Secondary: avgTime ASC (lower average time = best rank on tie)
        leaderboardData.sort((a, b) => {
          if (b.teamScore !== a.teamScore) {
            return b.teamScore - a.teamScore;
          }
          return a.avgTime - b.avgTime;
        });

        // Assign rank dynamically based on sorted order
        leaderboardData.forEach((team, idx) => {
          team.rank = idx + 1;
        });

        res.json(leaderboardData);
      });
    });
  });
});

app.put('/api/admin/team/:id/status', (req, res) => {
  const { id } = req.params;
  const { isDisqualified } = req.body;
  const now = new Date().toISOString();
  db.run(
    `UPDATE Team SET isDisqualified = ?, lastSeen = ? WHERE teamID = ?`,
    [isDisqualified ? 1 : 0, now, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post('/api/admin/team', (req, res) => {
  const { teamName, password } = req.body;
  db.run(`INSERT INTO Team (teamName, password, teamScore) VALUES (?, ?, 0)`, [teamName, password], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, teamID: this.lastID });
  });
});

app.delete('/api/admin/team/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM Team WHERE teamID = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/challenges', (req, res) => {
  db.all(`SELECT * FROM Challenges ORDER BY questionNumber ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/challenge', (req, res) => {
  const { level, title, description, marks, testCases, questionNumber } = req.body;

  db.get(`SELECT MAX(questionNumber) as maxQ FROM Challenges`, (err, row) => {
    const qNum = questionNumber || ((row?.maxQ || 0) + 1);

    db.run(
      `INSERT INTO Challenges (level, title, description, marks, testCases, questionNumber) VALUES (?, ?, ?, ?, ?, ?)`,
      [level, title, description, marks, testCases, qNum],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, challengeID: this.lastID });
      }
    );
  });
});

app.put('/api/admin/challenge/:id', (req, res) => {
  const { id } = req.params;
  const { level, title, description, marks, testCases, questionNumber } = req.body;
  db.run(
    `UPDATE Challenges SET level = ?, title = ?, description = ?, marks = ?, testCases = ?, questionNumber = ? WHERE challengeID = ?`,
    [level, title, description, marks, testCases, questionNumber, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/admin/challenge/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM Challenges WHERE challengeID = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Native process execution engine enabled for Python, Java, C.`);
});
