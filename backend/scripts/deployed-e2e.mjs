/**
 * Throwaway: end-to-end test against the DEPLOYED Railway backend, proving REAL
 * email delivery via Resend — reads the OTP from the real Gmail inbox over IMAP.
 * Resend test mode only delivers to the account email, so we register flowos123@gmail.com
 * exactly (no alias). The Railway host is pinned to its IP (local DNS refuses it).
 *
 * Run: $env:IMAP_USER=...; $env:IMAP_PASS=...; node scripts/deployed-e2e.mjs
 */
import https from 'node:https';
import dns from 'node:dns';
import { ImapFlow } from 'imapflow';

const RAILWAY_HOST = 'flowos-backend-production-61d2.up.railway.app';
const RAILWAY_IP = process.env.RAILWAY_IP || '69.46.46.47';
const IMAP_USER = process.env.IMAP_USER;
const IMAP_PASS = process.env.IMAP_PASS;
const email = process.env.TEST_EMAIL || 'flowos123@gmail.com'; // Resend test mode: this inbox only
const password = 'FlowOsTest123!';

function pinnedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (hostname === RAILWAY_HOST) {
    if (options && options.all) return callback(null, [{ address: RAILWAY_IP, family: 4 }]);
    return callback(null, RAILWAY_IP, 4);
  }
  return dns.lookup(hostname, options, callback);
}

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        host: RAILWAY_HOST, port: 443, path: '/api/v1' + path, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
        lookup: pinnedLookup, servername: RAILWAY_HOST,
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json }); });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** Poll the inbox for the most recent FlowOS verification email and extract the code. */
async function readOtpFromInbox(target) {
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: IMAP_USER, pass: IMAP_PASS }, logger: false });
  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    for (let attempt = 1; attempt <= 18; attempt++) {
      const uids = await client.search({ to: target });
      if (uids && uids.length) {
        for (const uid of uids.slice(-6).reverse()) { // newest first
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          const m = msg.source.toString('utf8').match(/verification code is\s*(\d{6})/i);
          if (m) return m[1];
        }
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  } finally { await client.logout().catch(() => {}); }
  return null;
}

console.log('DEPLOYED TARGET =', RAILWAY_HOST, '(pinned ' + RAILWAY_IP + ')');
console.log('TEST EMAIL      =', email);

console.log('=== REGISTER (deployed Railway) ===');
const reg = await postJson('/auth/register', { name: 'Resend E2E', email, password });
console.log('  status=' + reg.status + '  body=' + JSON.stringify(reg.json));
if (reg.status === 409) {
  console.log('  account exists — requesting a fresh OTP via /auth/resend-otp');
  const r = await postJson('/auth/resend-otp', { email });
  console.log('  resend-otp status=' + r.status);
}

console.log('=== READ OTP FROM REAL GMAIL INBOX (IMAP, independent of devCode) ===');
const otp = await readOtpFromInbox(email);
console.log('  OTP read from inbox =', otp);

let ver = null;
if (otp) {
  console.log('=== VERIFY (deployed, using the EMAILED OTP) ===');
  ver = await postJson('/auth/verify-email', { email, otp });
  console.log('  status=' + ver.status + '  emailVerified=' + (ver.json?.user?.emailVerified) +
    '  gotAccess=' + !!ver.json?.accessToken);
}

console.log('=== LOGIN (deployed) ===');
const login = await postJson('/auth/login', { email, password });
console.log('  status=' + login.status + '  user=' + (login.json?.user?.email) + '  gotAccess=' + !!login.json?.accessToken);

const ok = !!ver?.json?.accessToken || !!login.json?.accessToken;
console.log('RESULT: ' + (ok ? 'PASS — deployed real-email flow works end to end (Resend)' : 'FAIL'));
process.exit(ok ? 0 : 1);
