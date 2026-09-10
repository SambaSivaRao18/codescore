/**
 * Java Executor Microservice
 * 
 * Accepts Java code via HTTP POST, compiles with javac, runs with java,
 * and returns stdout/stderr/exitCode back to the Node.js backend.
 * 
 * Does NOT touch database, teams, questions, or any business logic.
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = process.env.PORT || 4000;
const DEFAULT_TIMEOUT_MS = 10000;   // 10s compile timeout
const RUN_TIMEOUT_MS = 5000;        // 5s run timeout
const MAX_BUFFER_BYTES = 256 * 1024;
const MAX_CODE_SIZE_BYTES = 64 * 1024;

// -- Internal runner -----------------------------------------------------------
function runProcess(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const { cwd, stdin = '', timeout = DEFAULT_TIMEOUT_MS } = options;

    let stdout = '';
    let stderr = '';
    let isTimeout = false;
    let isExceededBuffer = false;
    let isFinished = false;

    const child = spawn(cmd, args, { cwd, shell: false });

    const timer = setTimeout(() => {
      if (!isFinished) {
        isTimeout = true;
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (Buffer.byteLength(stdout, 'utf8') > MAX_BUFFER_BYTES) {
        isExceededBuffer = true;
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (Buffer.byteLength(stderr, 'utf8') > MAX_BUFFER_BYTES) {
        isExceededBuffer = true;
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      resolve({ error: err.message, code: -1, stdout, stderr, isTimeout: false, isExceededBuffer: false });
    });

    child.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      resolve({ code: code !== null ? code : -1, stdout, stderr, isTimeout, isExceededBuffer });
    });

    if (child.stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

// -- Health check --------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'java-executor' });
});

// -- POST /execute -------------------------------------------------------------
// Body: { code: string, stdin?: string, timeoutMs?: number }
// Response: { stdout, stderr, exitCode } or { compileError } or { error }
app.post('/execute', async (req, res) => {
  const { code, stdin = '', timeoutMs = RUN_TIMEOUT_MS } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "code" field' });
  }

  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE_BYTES) {
    return res.status(400).json({ error: `Code exceeds max size (${MAX_CODE_SIZE_BYTES / 1024} KB)` });
  }

  // Create isolated temp directory
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'java-exec-'));
  } catch (err) {
    return res.status(500).json({ error: `Failed to create temp directory: ${err.message}` });
  }

  try {
    const srcPath = path.join(tempDir, 'Main.java');
    await fs.writeFile(srcPath, code, 'utf8');

    // Step 1: Compile
    const compileRes = await runProcess('javac', ['Main.java'], {
      cwd: tempDir,
      timeout: DEFAULT_TIMEOUT_MS,
    });

    if (compileRes.error) {
      return res.json({ compileError: `Compiler error: ${compileRes.error}` });
    }
    if (compileRes.code !== 0) {
      return res.json({ compileError: compileRes.stderr || compileRes.stdout || 'Compilation failed' });
    }

    // Step 2: Run
    const execRes = await runProcess('java', ['-cp', '.', 'Main'], {
      cwd: tempDir,
      stdin,
      timeout: timeoutMs,
    });

    if (execRes.error) {
      return res.json({ error: `Runtime error: ${execRes.error}` });
    }
    if (execRes.isTimeout) {
      return res.json({ error: `Time Limit Exceeded (${timeoutMs / 1000}s)` });
    }
    if (execRes.isExceededBuffer) {
      return res.json({ error: `Output Limit Exceeded (max ${MAX_BUFFER_BYTES / 1024} KB)` });
    }

    return res.json({
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      exitCode: execRes.code,
    });

  } finally {
    // Always clean up temp files
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`Java executor service running on port ${PORT}`);
});
