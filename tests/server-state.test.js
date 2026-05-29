import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const SERVER_PORT = 4111;
const SERVER_PATH = path.join(import.meta.dirname, '..', 'server.js');
const RECIPE_SESSION_FILE = path.join(os.homedir(), '.drkrm', 'recipe-session.json');

let serverProcess;
let originalRecipeSession;

async function fetchJSON(urlPath) {
  const res = await fetch(`http://localhost:${SERVER_PORT}${urlPath}`);
  return res.json();
}

describe('Server state on startup', () => {
  beforeAll(async () => {
    if (fs.existsSync(RECIPE_SESSION_FILE)) {
      originalRecipeSession = fs.readFileSync(RECIPE_SESSION_FILE, 'utf8');
    }

    fs.writeFileSync(RECIPE_SESSION_FILE, JSON.stringify({
      dir: '/tmp/fake-recipe-dir-that-should-not-autoload',
      lastOpened: new Date().toISOString(),
    }));

    fs.mkdirSync('/tmp/fake-recipe-dir-that-should-not-autoload', { recursive: true });

    serverProcess = spawn('node', [SERVER_PATH], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'pipe',
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      const check = async () => {
        try {
          await fetch(`http://localhost:${SERVER_PORT}/api/recipe-status`);
          clearTimeout(timeout);
          resolve();
        } catch {
          setTimeout(check, 200);
        }
      };
      check();
    });
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
    if (originalRecipeSession) {
      fs.writeFileSync(RECIPE_SESSION_FILE, originalRecipeSession);
    }
    try { fs.rmdirSync('/tmp/fake-recipe-dir-that-should-not-autoload'); } catch {}
  });

  it('does NOT auto-load recipeDir from recipe-session.json', async () => {
    const status = await fetchJSON('/api/recipe-status');
    expect(status.loaded).toBe(false);
    expect(status.dir).toBeNull();
  });

  it('returns last-used dir via /api/recipe-last-dir without loading it', async () => {
    const lastDir = await fetchJSON('/api/recipe-last-dir');
    expect(lastDir.dir).toBe('/tmp/fake-recipe-dir-that-should-not-autoload');
  });

  it('grid-select returns error when no directory loaded', async () => {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/grid-select?dir=`);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});
