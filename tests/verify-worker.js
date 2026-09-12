/**
 * =============================================================================
 * ALXANTHIA STUDIO — CLOUDFLARE WORKER TEST SUITE (ALX-10 regression)
 * =============================================================================
 * Run with: node tests/verify-worker.js
 *
 * verify-server-pricing.js already extracts and executes the Apps Script code
 * block from CONFIGURE-SUBMISSION-ENDPOINT.md, but never touched the Worker's
 * own `export default { fetch }` block — so a plain ReferenceError inside the
 * Worker (a constant used but never defined) shipped straight to production
 * undetected, and every real order failed with "check your internet
 * connection" until it was caught manually from the Worker's live logs.
 *
 * This extracts that exact documented Worker code (same text an owner
 * copy-pastes into Cloudflare) and runs it against mock Request/Response/
 * fetch objects, covering every early-return branch so a stray undefined
 * reference in any of them fails a test instead of a real order.
 * =============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO — CLOUDFLARE WORKER SUITE');
console.log('======================================================================\n');

const guidePath = path.join(__dirname, '..', 'CONFIGURE-SUBMISSION-ENDPOINT.md');
const guideSrc = fs.readFileSync(guidePath, 'utf8');
const jsBlocks = [...guideSrc.matchAll(/```javascript\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const workerSrcRaw = jsBlocks.find((block) => block.includes('export default {'));
assert(workerSrcRaw, 'Could not locate the Cloudflare Worker code block in CONFIGURE-SUBMISSION-ENDPOINT.md');
// `export default` is ES module syntax; vm.runInContext evaluates as a plain
// script, so bind the same object to a variable instead of transpiling.
const workerSrc = workerSrcRaw.replace('export default {', 'var __worker = {');

class MockResponse {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.headers = init.headers || {};
  }
  async json() { return JSON.parse(this._body); }
  async text() { return this._body == null ? '' : String(this._body); }
}

class MockFormData {
  constructor() { this.fields = {}; }
  append(key, value) { this.fields[key] = value; }
}

function makeRequest({ method = 'POST', origin = 'https://alxanthia.com', contentType = 'application/json', body = '{}', contentLength, ip = '203.0.113.1' } = {}) {
  const declaredLength = contentLength !== undefined ? contentLength : Buffer.byteLength(body || '');
  const headerMap = {
    origin, 'content-type': contentType, 'content-length': String(declaredLength), 'cf-connecting-ip': ip
  };
  return {
    method,
    headers: { get: (name) => (name ? headerMap[name.toLowerCase()] : undefined) ?? null },
    text: async () => body
  };
}

// A per-test-controllable fetch: routes by URL so both the Turnstile
// siteverify call and the Google Apps Script proxy call can be scripted.
function makeSandbox({ fetchImpl }) {
  const sandbox = {
    console: { log: () => {} }, // the Worker's log() prints per-request; silence it here
    Response: MockResponse,
    FormData: MockFormData,
    URL,
    fetch: fetchImpl
  };
  vm.createContext(sandbox);
  vm.runInContext(workerSrc, sandbox);
  assert(sandbox.__worker && typeof sandbox.__worker.fetch === 'function', 'The Worker code must expose a fetch(request, env) handler');
  return sandbox;
}

const BASE_ENV = { ALLOWED_ORIGIN: 'https://alxanthia.com', GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/FAKE/exec', WEBHOOK_SECRET: 'test-secret', ALLOW_INSECURE_TESTING: 'true' };

async function googleSuccessFetch() {
  return new MockResponse(JSON.stringify({ ok: true, order_reference: 'ALX-260912-0001' }));
}

(async () => {

// ---------------------------------------------------------------------------
console.log('--- SUITE W1: happy path reaches Google and returns 200 (the exact ALX-10 regression) ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'ALX-260912-0001' }) }), BASE_ENV);
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
  const parsed = await res.json();
  assert.strictEqual(parsed.ok, true, 'expected ok:true from a successful order');
}
console.log('✔ Suite W1 Passed: a normal order reaches Google and returns 200 without throwing\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W2: OPTIONS preflight returns 204 ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const res = await sandbox.__worker.fetch(makeRequest({ method: 'OPTIONS' }), BASE_ENV);
  assert.strictEqual(res.status, 204, `expected 204, got ${res.status}`);
}
console.log('✔ Suite W2 Passed: OPTIONS preflight returns 204\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W3: wrong origin is rejected (403) ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const res = await sandbox.__worker.fetch(makeRequest({ origin: 'https://evil.example' }), BASE_ENV);
  assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`);
}
console.log('✔ Suite W3 Passed: a mismatched Origin is rejected\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W4: unsupported content type is rejected (415) ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const res = await sandbox.__worker.fetch(makeRequest({ contentType: 'text/plain' }), BASE_ENV);
  assert.strictEqual(res.status, 415, `expected 415, got ${res.status}`);
}
console.log('✔ Suite W4 Passed: a non-JSON content type is rejected\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W5: an oversized declared Content-Length is rejected (413) — exercises MAX_BODY_BYTES directly ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const res = await sandbox.__worker.fetch(makeRequest({ contentLength: 999999 }), BASE_ENV);
  assert.strictEqual(res.status, 413, `expected 413, got ${res.status}`);
}
console.log('✔ Suite W5 Passed: an oversized request is rejected without a ReferenceError\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W6: missing TURNSTILE_SECRET fails closed (503), not silently skipped ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const env = { ...BASE_ENV, ALLOW_INSECURE_TESTING: undefined };
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'X' }) }), env);
  assert.strictEqual(res.status, 503, `expected 503, got ${res.status}`);
}
console.log('✔ Suite W6 Passed: ordering fails closed without a configured Turnstile secret\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W7: a valid Turnstile token is accepted (TURNSTILE_SECRET configured) ---');
{
  const fetchImpl = async (url) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return new MockResponse(JSON.stringify({ success: true, action: 'order_submission', hostname: 'alxanthia.com' }));
    }
    return googleSuccessFetch();
  };
  const sandbox = makeSandbox({ fetchImpl });
  const env = { ...BASE_ENV, ALLOW_INSECURE_TESTING: undefined, TURNSTILE_SECRET: 'fake-secret' };
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'ALX-1', cf_turnstile_token: 'good-token' }) }), env);
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
}
console.log('✔ Suite W7 Passed: a valid Turnstile token lets the order through\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W8: a rejected Turnstile token is refused (403) ---');
{
  const fetchImpl = async (url) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return new MockResponse(JSON.stringify({ success: false }));
    }
    return googleSuccessFetch();
  };
  const sandbox = makeSandbox({ fetchImpl });
  const env = { ...BASE_ENV, ALLOW_INSECURE_TESTING: undefined, TURNSTILE_SECRET: 'fake-secret' };
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'ALX-1', cf_turnstile_token: 'bad-token' }) }), env);
  assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`);
}
console.log('✔ Suite W8 Passed: a failed Turnstile check is refused\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W9: an unreachable Apps Script maps to 502, not a thrown exception ---');
{
  const fetchImpl = async () => { throw new Error('simulated network failure'); };
  const sandbox = makeSandbox({ fetchImpl });
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'ALX-1' }) }), BASE_ENV);
  assert.strictEqual(res.status, 502, `expected 502, got ${res.status}`);
}
console.log('✔ Suite W9 Passed: an unreachable upstream is reported as 502, never an unhandled throw\n');

// ---------------------------------------------------------------------------
console.log('--- SUITE W10: the RATE_LIMITER binding, when present and exhausted, returns 429 ---');
{
  const sandbox = makeSandbox({ fetchImpl: googleSuccessFetch });
  const env = { ...BASE_ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await sandbox.__worker.fetch(makeRequest({ body: JSON.stringify({ order_reference: 'ALX-1' }) }), env);
  assert.strictEqual(res.status, 429, `expected 429, got ${res.status}`);
}
console.log('✔ Suite W10 Passed: an exhausted rate limit returns 429\n');

console.log('======================================================================');
console.log('✔ ALL 10 CLOUDFLARE WORKER SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');

})().catch((err) => {
  console.error(err);
  process.exit(1);
});
