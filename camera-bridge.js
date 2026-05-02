const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const HELPER_PATH = path.join(__dirname, 'camera-helper', '.build', 'debug', 'camera-helper');

class CameraBridge {
  constructor() {
    this.process = null;
    this.nextId = 1;
    this.pending = new Map();
    this.rl = null;
  }

  start() {
    if (this.process) return;

    this.process = spawn(HELPER_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.rl = readline.createInterface({ input: this.process.stdout });
    this.rl.on('line', (line) => {
      try {
        const resp = JSON.parse(line);
        const cb = this.pending.get(resp.id);
        if (cb) {
          this.pending.delete(resp.id);
          if (resp.error) {
            cb.reject(new Error(resp.error));
          } else {
            cb.resolve(resp.result);
          }
        }
      } catch {}
    });

    this.process.stderr.on('data', (data) => {
      console.log('[camera-helper]', data.toString().trim());
    });

    this.process.on('exit', (code) => {
      console.log(`[camera-helper] exited with code ${code}`);
      this.process = null;
      this.rl = null;
      for (const [, cb] of this.pending) {
        cb.reject(new Error('Camera helper process exited'));
      }
      this.pending.clear();
    });
  }

  stop() {
    if (this.process) {
      this.process.stdin.end();
      this.process = null;
    }
  }

  _send(method, params = {}) {
    if (!this.process) {
      this.start();
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ id, method, params }) + '\n';
      this.process.stdin.write(msg);

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout waiting for ${method}`));
        }
      }, 120000);
    });
  }

  async list() {
    return this._send('list');
  }

  async connect() {
    return this._send('connect');
  }

  async disconnect() {
    return this._send('disconnect');
  }

  async deviceInfo() {
    return this._send('deviceInfo');
  }

  async readProp(propId) {
    return this._send('readProp', { propId });
  }

  async writeProp(propId, dataBase64) {
    return this._send('writeProp', { propId, data: dataBase64 });
  }

  async uploadRaf(filePath) {
    return this._send('uploadRaf', { path: filePath });
  }

  async getProfile() {
    return this._send('getProfile');
  }

  async setProfile(profileBase64) {
    return this._send('setProfile', { data: profileBase64 });
  }

  async triggerConversion() {
    return this._send('triggerConversion');
  }

  async waitForResult(outputPath, timeout = 30) {
    return this._send('waitForResult', { outputPath, timeout });
  }

  async sendCommand(opcode, params = [], dataBase64 = null) {
    const p = { opcode, params };
    if (dataBase64) p.data = dataBase64;
    return this._send('sendCommand', p);
  }
}

module.exports = new CameraBridge();
