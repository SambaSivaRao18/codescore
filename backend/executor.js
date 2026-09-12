const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

const SUPPORTED_LANGUAGES = ['python', 'java', 'c'];
const DEFAULT_TIMEOUT_MS = 2000; // 2 seconds
const MAX_BUFFER_BYTES = 256 * 1024; // 256 KB
const MAX_CODE_SIZE_BYTES = 64 * 1024; // 64 KB

/**
 * Execute command as a child process with timeout, stdin, and buffer limits
 */
function runProcess(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const { cwd, stdin = '', env = {}, timeout = DEFAULT_TIMEOUT_MS } = options;

    let stdout = '';
    let stderr = '';
    let isTimeout = false;
    let isExceededBuffer = false;
    let isFinished = false;

    // Spawn process without shell to prevent command injection
    const child = spawn(cmd, args, {
      cwd,
      env,
      shell: false,
    });

    const timer = setTimeout(() => {
      if (!isFinished) {
        isTimeout = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {
          // Ignore kill errors
        }
      }
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (Buffer.byteLength(stdout, 'utf8') > MAX_BUFFER_BYTES) {
        isExceededBuffer = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {}
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (Buffer.byteLength(stderr, 'utf8') > MAX_BUFFER_BYTES) {
        isExceededBuffer = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {}
      }
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      resolve({
        error: err,
        code: -1,
        stdout,
        stderr: stderr || err.message,
        isTimeout: false,
        isExceededBuffer: false,
      });
    });

    child.on('close', (code, signal) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);

      resolve({
        code: code !== null ? code : -1,
        signal,
        stdout,
        stderr,
        isTimeout,
        isExceededBuffer,
      });
    });

    // Write input to stdin if process started successfully
    if (child.stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/**
 * Call the remote Java executor Docker service via HTTP
 * JAVA_EXECUTOR_URL env var must point to the Render Docker service URL
 * e.g. https://java-executor.onrender.com
 */
function callJavaExecutor(code, stdin, timeoutMs) {
  return new Promise((resolve, reject) => {
    const executorUrl = process.env.JAVA_EXECUTOR_URL;
    if (!executorUrl) {
      return resolve({ error: 'JAVA_EXECUTOR_URL is not set. Java execution is unavailable.' });
    }

    const body = JSON.stringify({ code, stdin, timeoutMs });
    const url = new URL('/execute', executorUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs + 8000, // extra buffer for network + compile time
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: `Invalid response from Java executor service (Status ${res.statusCode}): ${data.substring(0, 200)}` });
        }
      });
    });

    req.on('error', (err) => resolve({ error: `Java executor unreachable: ${err.message}` }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Java executor service timed out' });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Execute Python, Java, or C code on the server
 */
async function executeCode({ language, code, stdin = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return { error: `Unsupported language: ${language}. Allowed: ${SUPPORTED_LANGUAGES.join(', ')}` };
  }

  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE_BYTES) {
    return { error: `Source code exceeds maximum allowed size (${MAX_CODE_SIZE_BYTES / 1024} KB)` };
  }

  // Create isolated temp directory
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codescore-exec-'));
  } catch (err) {
    return { error: `Failed to initialize isolated execution directory: ${err.message}` };
  }

  // Sanitized environment variables to prevent environment key leakage (DB credentials, secret tokens, etc.)
  const cleanEnv = {
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT || '', // Required for Windows process spawning
    TMP: tempDir,
    TEMP: tempDir,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
  };

  try {
    const isWindows = process.platform === 'win32';

    if (language === 'python') {
      const filePath = path.join(tempDir, 'student.py');
      await fs.writeFile(filePath, code, 'utf8');

      // Make file read-only
      try { await fs.chmod(filePath, 0o444); } catch (e) {}
      // Lock down directory to read/execute only (effective on Linux)
      try { await fs.chmod(tempDir, 0o555); } catch (e) {}

      // Use -I (Isolated mode) and -B (Don't write .pyc) for basic Python hardening
      let result = await runProcess('python3', ['-I', '-B', 'student.py'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });
      if (result.error && result.error.code === 'ENOENT') {
        result = await runProcess('python', ['-I', '-B', 'student.py'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });
      }

      if (result.error) {
        return { error: `Python interpreter error: ${result.error.message}` };
      }
      if (result.isTimeout) {
        return { error: `Time Limit Exceeded (${timeoutMs / 1000}s)` };
      }
      if (result.isExceededBuffer) {
        return { error: `Output Limit Exceeded (max ${MAX_BUFFER_BYTES / 1024} KB)` };
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code,
      };
    }

    if (language === 'c') {
      const srcPath = path.join(tempDir, 'student.c');
      const exeName = isWindows ? 'student.exe' : './student';
      const binaryName = isWindows ? 'student.exe' : 'student';
      const binaryPath = path.join(tempDir, binaryName);

      await fs.writeFile(srcPath, code, 'utf8');

      // Compile with gcc
      const compileRes = await runProcess('gcc', ['student.c', '-o', binaryName], { cwd: tempDir, env: cleanEnv, timeout: 10000 });
      if (compileRes.error) {
        if (compileRes.error.code === 'ENOENT') {
          return { error: 'C compiler (gcc) is not installed on the server.' };
        }
        return { compileError: `Compilation error: ${compileRes.error.message}` };
      }
      if (compileRes.code !== 0) {
        return { compileError: compileRes.stderr || compileRes.stdout || 'Compilation failed' };
      }

      // Lock down directory to read/execute only (effective on Linux) after compilation
      try { await fs.chmod(tempDir, 0o555); } catch (e) {}

      // Execute binary
      const execRes = await runProcess(binaryPath, [], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });

      if (execRes.error) {
        return { error: `Runtime execution error: ${execRes.error.message}` };
      }
      if (execRes.isTimeout) {
        return { error: `Time Limit Exceeded (${timeoutMs / 1000}s)` };
      }
      if (execRes.isExceededBuffer) {
        return { error: `Output Limit Exceeded (max ${MAX_BUFFER_BYTES / 1024} KB)` };
      }

      return {
        stdout: execRes.stdout,
        stderr: execRes.stderr,
        exitCode: execRes.code,
      };
    }

    if (language === 'java') {
      // Ensure the public class is named Main to match Main.java
      const normalizedCode = code.replace(/public\s+class\s+[a-zA-Z_]\w*/, 'public class Main');

      if (process.env.JAVA_EXECUTOR_URL) {
        return await callJavaExecutor(normalizedCode, stdin, timeoutMs);
      } else {
        const srcPath = path.join(tempDir, 'Main.java');
        await fs.writeFile(srcPath, normalizedCode, 'utf8');

        // Compile with javac
        const compileRes = await runProcess('javac', ['Main.java'], { cwd: tempDir, env: cleanEnv, timeout: 10000 });
        if (compileRes.error) {
          if (compileRes.error.code === 'ENOENT') {
            return { error: 'Java compiler (javac) is not installed on the server.' };
          }
          return { compileError: `Compilation error: ${compileRes.error.message}` };
        }
        if (compileRes.code !== 0) {
          return { compileError: compileRes.stderr || compileRes.stdout || 'Compilation failed' };
        }

        // Lock down directory to read/execute only (effective on Linux) after compilation
        try { await fs.chmod(tempDir, 0o555); } catch (e) {}

        // Execute class
        const execRes = await runProcess('java', ['Main'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });

        if (execRes.error) {
          return { error: `Runtime execution error: ${execRes.error.message}` };
        }
        if (execRes.isTimeout) {
          return { error: `Time Limit Exceeded (${timeoutMs / 1000}s)` };
        }
        if (execRes.isExceededBuffer) {
          return { error: `Output Limit Exceeded (max ${MAX_BUFFER_BYTES / 1024} KB)` };
        }

        return {
          stdout: execRes.stdout,
          stderr: execRes.stderr,
          exitCode: execRes.code,
        };
      }
    }
  } finally {
    // Guaranteed cleanup of isolated directory
    if (tempDir) {
      try {
        // Restore write permissions so the directory can be successfully deleted
        await fs.chmod(tempDir, 0o777);
      } catch (e) {}
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = {
  executeCode,
  SUPPORTED_LANGUAGES,
  DEFAULT_TIMEOUT_MS,
};
