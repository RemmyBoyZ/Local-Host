import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELAY_HOST = '127.0.0.1';
const RELAY_PORT = 3001;
const RELAY_HEALTH_PATH = '/manual/session/__health__';

type RelayStatus = {
  ready: boolean;
  started: boolean;
  pid?: number | null;
  error?: string;
};

type RelayGlobal = typeof globalThis & {
  __qaRelayProcess?: ChildProcess;
  __qaRelayStarting?: Promise<RelayStatus>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRelayListening(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: RELAY_HOST,
        port: RELAY_PORT,
        path: RELAY_HEALTH_PATH,
        method: 'GET',
        timeout: 500,
      },
      (res) => {
        res.resume();
        resolve(true);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function waitForRelay(timeoutMs = 3500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRelayListening()) return true;
    await sleep(150);
  }
  return false;
}

async function ensureRelay(): Promise<RelayStatus> {
  if (await isRelayListening()) {
    return { ready: true, started: false };
  }

  const relayGlobal = globalThis as RelayGlobal;
  if (relayGlobal.__qaRelayStarting) {
    return relayGlobal.__qaRelayStarting;
  }

  relayGlobal.__qaRelayStarting = (async () => {
    const serverPath = path.join(process.cwd(), 'mini-services', 'ws-server.js');
    let spawnErrorMessage: string | null = null;

    const child = spawn(process.execPath, [serverPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });

    relayGlobal.__qaRelayProcess = child;
    child.once('error', (error) => {
      spawnErrorMessage = error.message;
    });
    child.unref();

    const ready = await waitForRelay();
    if (!ready) {
      return {
        ready: false,
        started: true,
        pid: child.pid,
        error: spawnErrorMessage || 'Automation relay gagal start di port 3001.',
      };
    }

    return { ready: true, started: true, pid: child.pid };
  })();

  try {
    return await relayGlobal.__qaRelayStarting;
  } finally {
    relayGlobal.__qaRelayStarting = undefined;
  }
}

export async function GET() {
  const status = await ensureRelay();
  return NextResponse.json(status, { status: status.ready ? 200 : 503 });
}
