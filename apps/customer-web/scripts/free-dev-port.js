/**
 * Stops a stale Node listener on the dev port (common after closing a terminal
 * without Ctrl+C). Only targets processes that look like node.
 */
const { execSync } = require('child_process');

const port = process.argv[2] || process.env.PORT || '3001';

function getListeningPidsWin() {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function isNodePidWin(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
    });
    return /node\.exe/i.test(out);
  } catch {
    return false;
  }
}

function getListeningPidsUnix() {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return [...new Set(out.trim().split(/\s+/).filter(Boolean))];
  } catch {
    return [];
  }
}

function isNodePidUnix(pid) {
  try {
    const out = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' });
    return /node/i.test(out);
  } catch {
    return false;
  }
}

if (process.platform === 'win32') {
  for (const pid of getListeningPidsWin()) {
    if (!isNodePidWin(pid)) continue;
    console.warn(`[free-dev-port] Port ${port} in use by node (PID ${pid}); stopping it.`);
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    } catch {
      // ignore
    }
  }
} else {
  for (const pid of getListeningPidsUnix()) {
    if (!isNodePidUnix(pid)) continue;
    console.warn(`[free-dev-port] Port ${port} in use by node (PID ${pid}); stopping it.`);
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      // ignore
    }
  }
}
