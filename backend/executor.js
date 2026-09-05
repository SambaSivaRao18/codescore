const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const SUPPORTED_LANGUAGES = ['python', 'java', 'c'];
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
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

      // Try python3 first, fallback to python if python3 fails with ENOENT
      let result = await runProcess('python3', ['student.py'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });
      if (result.error && result.error.code === 'ENOENT') {
        result = await runProcess('python', ['student.py'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });
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
      const srcPath = path.join(tempDir, 'Main.java');
      await fs.writeFile(srcPath, code, 'utf8');

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

      // Execute with java
      const execRes = await runProcess('java', ['-cp', '.', 'Main'], { cwd: tempDir, stdin, env: cleanEnv, timeout: timeoutMs });

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
  } finally {
    // Guaranteed cleanup of isolated directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = {
  executeCode,
  SUPPORTED_LANGUAGES,
  DEFAULT_TIMEOUT_MS,
};
