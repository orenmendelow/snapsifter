const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const STATE_DIR = path.join(os.homedir(), '.drkrm');
const LICENSE_FILE = path.join(STATE_DIR, 'license.json');
const TRIAL_DAYS = 14;
const GRACE_DAYS = 1;
const KEYCHAIN_SERVICE = 'drkrm-trial';
const KEYCHAIN_ACCOUNT = 'drkrm';
const LS_ACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/activate';
const LS_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';
const LS_DEACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/deactivate';

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function getMachineId() {
  try {
    const raw = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
    const match = raw.match(/"([A-F0-9-]+)"/);
    return match ? match[1] : os.hostname();
  } catch {
    return os.hostname();
  }
}

// --- Keychain (trial start date) ---

function getTrialStart() {
  try {
    const raw = execSync(
      `security find-generic-password -a "${KEYCHAIN_ACCOUNT}" -s "${KEYCHAIN_SERVICE}" -w 2>/dev/null`,
      { encoding: 'utf8' }
    ).trim();
    const ts = parseInt(raw, 10);
    if (!isNaN(ts) && ts > 0) return ts;
  } catch {}
  return null;
}

function setTrialStart(timestamp) {
  try {
    execSync(`security delete-generic-password -a "${KEYCHAIN_ACCOUNT}" -s "${KEYCHAIN_SERVICE}" 2>/dev/null`);
  } catch {}
  execSync(
    `security add-generic-password -a "${KEYCHAIN_ACCOUNT}" -s "${KEYCHAIN_SERVICE}" -w "${timestamp}" -U`
  );
}

function ensureTrialStarted() {
  let start = getTrialStart();
  if (!start) {
    start = Date.now();
    setTrialStart(start);
  }
  return start;
}

// --- License file ---

function readLicense() {
  try {
    return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeLicense(data) {
  ensureStateDir();
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

function clearLicense() {
  try { fs.unlinkSync(LICENSE_FILE); } catch {}
}

// --- License state ---

function getState() {
  const license = readLicense();

  if (license && license.activated && license.instanceId) {
    return {
      status: 'active',
      tier: license.tier || 'pro',
      licenseKey: maskKey(license.licenseKey),
      activatedAt: license.activatedAt,
      customerEmail: license.customerEmail || null,
    };
  }

  const trialStart = ensureTrialStarted();
  const elapsed = Date.now() - trialStart;
  const daysUsed = Math.floor(elapsed / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, TRIAL_DAYS + GRACE_DAYS - daysUsed);

  if (daysRemaining > 0) {
    return {
      status: 'trial',
      daysRemaining,
      daysUsed,
      trialStart,
      showBanner: daysRemaining <= 5,
      showUrgent: daysRemaining <= 2,
    };
  }

  return {
    status: 'expired',
    daysUsed,
    trialStart,
  };
}

function isRecipeLabUnlocked() {
  const state = getState();
  return state.status === 'active' || state.status === 'trial';
}

function maskKey(key) {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 4) + '-****-****-' + key.slice(-4);
}

// --- LemonSqueezy activation ---

async function activate(licenseKey) {
  const machineId = getMachineId();
  const instanceName = `${os.hostname()}-${os.platform()}-${os.arch()}`;

  const resp = await fetch(LS_ACTIVATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      instance_name: instanceName,
    }),
  });

  const data = await resp.json();

  if (!data.activated && !data.valid) {
    const msg = data.error || data.meta?.error || 'Activation failed';
    throw new Error(msg);
  }

  const receipt = {
    licenseKey,
    activated: true,
    instanceId: data.instance?.id || data.meta?.instance_id,
    activatedAt: new Date().toISOString(),
    machineId,
    customerEmail: data.meta?.customer_email || null,
    tier: detectTier(data),
    lsData: {
      licenseId: data.license_key?.id,
      orderId: data.license_key?.order_id,
      productId: data.license_key?.product_id,
      variantId: data.license_key?.variant_id,
      activationLimit: data.license_key?.activation_limit,
      activationUsage: data.license_key?.activation_usage,
    },
  };

  writeLicense(receipt);
  return { ok: true, state: getState() };
}

function detectTier(lsData) {
  const variantName = lsData.meta?.variant_name || '';
  if (/lifetime/i.test(variantName)) return 'lifetime';
  return 'pro';
}

async function validate() {
  const license = readLicense();
  if (!license || !license.licenseKey || !license.instanceId) {
    return { valid: false, reason: 'No license' };
  }

  try {
    const resp = await fetch(LS_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        license_key: license.licenseKey,
        instance_id: license.instanceId,
      }),
    });

    const data = await resp.json();
    if (data.valid) return { valid: true };

    clearLicense();
    return { valid: false, reason: data.error || 'License no longer valid' };
  } catch (err) {
    return { valid: true, offline: true };
  }
}

async function deactivate() {
  const license = readLicense();
  if (!license || !license.licenseKey || !license.instanceId) {
    clearLicense();
    return { ok: true };
  }

  try {
    await fetch(LS_DEACTIVATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        license_key: license.licenseKey,
        instance_id: license.instanceId,
      }),
    });
  } catch {}

  clearLicense();
  return { ok: true };
}

module.exports = {
  getState,
  isRecipeLabUnlocked,
  activate,
  validate,
  deactivate,
  readLicense,
  TRIAL_DAYS,
};
