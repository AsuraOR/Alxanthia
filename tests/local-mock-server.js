/**
 * A local, zero-dependency stand-in for the real Cloudflare Worker + Google
 * Apps Script pair, so you can click all the way through checkout in your
 * own browser and see a real success screen — without touching your live
 * Cloudflare account, your live Google Sheet, or deploying anything.
 *
 * It runs the EXACT Apps Script code block from CONFIGURE-SUBMISSION-ENDPOINT.md
 * (same technique as tests/verify-server-pricing.js) against an in-memory
 * "sheet" that lives only in this process and disappears when you stop it.
 * Nothing is ever written anywhere real.
 *
 * Usage:
 *   1. node tests/local-mock-server.js
 *      (leave this running in its own terminal)
 *   2. In site-content.js, TEMPORARILY change:
 *        orderSubmissionUrl: "http://localhost:8081",
 *      (comment out or save the real URL somewhere so you can put it back)
 *   3. In another terminal: npm start
 *   4. Open the site, place a test order, and watch this terminal — it logs
 *      every request and shows you the in-memory "sheet" rows.
 *   5. When you're done, put the real orderSubmissionUrl back in
 *      site-content.js. This mock server does not affect your real endpoint
 *      at all, but leaving the URL pointed here would break checkout for
 *      anyone else since only your machine can reach localhost.
 *
 * Open http://localhost:8081/rows in a browser at any time to see every
 * "order" this mock has stored so far, as plain JSON.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PORT = process.env.MOCK_PORT || 8081;
const WEBHOOK_SECRET = 'local-test-secret';

// ---------------------------------------------------------------------------
// 1. Load the real Apps Script code straight from the setup guide — this is
//    the same code you would paste into Google Apps Script, unmodified.
// ---------------------------------------------------------------------------
const guidePath = path.join(__dirname, '..', 'CONFIGURE-SUBMISSION-ENDPOINT.md');
const guideSrc = fs.readFileSync(guidePath, 'utf8');
const jsBlocks = [...guideSrc.matchAll(/```javascript\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const appsScriptSrc = jsBlocks.find((block) => block.includes('function doPost'));
if (!appsScriptSrc) throw new Error('Could not find the Apps Script code block in CONFIGURE-SUBMISSION-ENDPOINT.md');

// ---------------------------------------------------------------------------
// 2. An in-memory "Sheet" — header list must match Part 1 of the guide.
// ---------------------------------------------------------------------------
const HEADERS = ['Order Reference', 'Idempotency Key', 'Payload Hash', 'Catalog Version', 'Submitted At', 'Language', 'Currency', 'Source', 'Acknowledged', 'Buyer Name', 'Buyer WhatsApp', 'Location Type', 'Regency', 'Delivery Method', 'Address', 'City', 'Postal Code', 'Preferred Date', 'Order Mode', 'Order Summary', 'Item Data', 'Total Stems', 'Wrap', 'Message Card', 'Gift Message', 'Recipient Name', 'Card Sender Name', 'Submitted Product Subtotal', 'Submitted Message Card Fee', 'Submitted Total', 'Verified Product Subtotal', 'Verified Message Card Fee', 'Verified Total', 'Price Mismatch', 'Shipping Fee', 'Final Total', 'Midtrans Payment Link', 'Payment Status', 'Work Phase', 'Delivery Service', 'Tracking Link/Number', 'Internal Notes'];
let rows = [HEADERS.slice()];

function makeFakeSheet() {
  return {
    getLastColumn: () => rows[0].length,
    getLastRow: () => rows.length,
    getRange: (r1, c1, numRows, numCols) => {
      const nr = numRows || 1;
      const nc = numCols || 1;
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nr; i += 1) {
            const row = rows[r1 - 1 + i] || [];
            const slice = [];
            for (let j = 0; j < nc; j += 1) slice.push(row[c1 - 1 + j] !== undefined ? row[c1 - 1 + j] : '');
            out.push(slice);
          }
          return out;
        },
        setFormula: (formula) => {
          const row = rows[r1 - 1] || (rows[r1 - 1] = []);
          row[c1 - 1] = `[formula] ${formula}`;
        }
      };
    },
    appendRow: (values) => { rows.push(values.slice()); },
    getParent: () => ({ getUrl: () => `http://localhost:${PORT}/rows` }),
    getSheetId: () => 0
  };
}

// A deterministic (not cryptographic — this is a local dev tool only) hash,
// just so the payload-hash/duplicate-vs-conflict logic has something real to
// compare against.
function devHashBytes(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  return bytes;
}

// ---------------------------------------------------------------------------
// 3. Sandbox the real Apps Script code with minimal, mocked Apps Script APIs.
// ---------------------------------------------------------------------------
const sandbox = {
  console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (name) => (name === 'WEBHOOK_SECRET' ? WEBHOOK_SECRET : null) }) },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => s }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  MailApp: { sendEmail: (to, subject, body) => console.log(`\n[mock email would have been sent to ${to}]\nSubject: ${subject}\n${body}\n`) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => makeFakeSheet() }) },
  Utilities: {
    formatDate: (date, tz, fmt) => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    computeDigest: (algo, text) => devHashBytes(String(text)),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  }
};
vm.createContext(sandbox);
vm.runInContext(appsScriptSrc, sandbox);
console.log(`Loaded Apps Script code from CONFIGURE-SUBMISSION-ENDPOINT.md (${appsScriptSrc.length} chars). MINIMUM_LEAD_DAYS=${sandbox.MINIMUM_LEAD_DAYS}, CATALOG_VERSION=${sandbox.CATALOG_VERSION}`);

// ---------------------------------------------------------------------------
// 4. The Worker's own status-code mapping, copied from Part 3 of the guide,
//    so error responses look exactly like production.
// ---------------------------------------------------------------------------
const STATUS_BY_CODE = { VALIDATION: 400, BAD_JSON: 400, PAYLOAD_TOO_LARGE: 413, UNAUTHORIZED: 502, CONFLICT: 409, STORAGE_ERROR: 502 };
const PUBLIC_MESSAGE_BY_CODE = {
  VALIDATION: 'Some details could not be saved. Please check the form and try again.',
  BAD_JSON: 'Some details could not be saved. Please check the form and try again.',
  PAYLOAD_TOO_LARGE: 'The order is too large to submit.',
  CONFLICT: 'This order reference was already used with different details.',
  STORAGE_ERROR: 'Order could not be stored.'
};

// ---------------------------------------------------------------------------
// 5. The HTTP server standing in for the Worker's public URL.
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (req.url === '/rows' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ headers: rows[0], rows: rows.slice(1) }, null, 2));
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let order;
    try {
      order = JSON.parse(body || '{}');
    } catch (e) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ ok: false, error: 'Malformed request.' }));
      return;
    }
    delete order.cf_turnstile_token; // Turnstile is a real-deployment-only check

    const raw = JSON.stringify({ webhook_secret: WEBHOOK_SECRET, order });
    let result;
    try {
      result = JSON.parse(sandbox.doPost({ postData: { contents: raw } }));
    } catch (e) {
      console.error('doPost threw:', e);
      res.writeHead(502, headers);
      res.end(JSON.stringify({ ok: false, error: 'Mock server error — see its terminal.' }));
      return;
    }

    if (result.ok === true) {
      console.log(`✔ ${result.duplicate ? 'DUPLICATE' : 'STORED'} ${result.order_reference} (row count: ${rows.length - 1})`);
      res.writeHead(200, headers);
      res.end(JSON.stringify({ ok: true, order_reference: result.order_reference, duplicate: result.duplicate === true }));
      return;
    }

    console.log(`✖ ${result.code || 'UNKNOWN_ERROR'}: ${result.error}`);
    const status = STATUS_BY_CODE[result.code] || 502;
    const message = PUBLIC_MESSAGE_BY_CODE[result.code] || 'Order could not be stored.';
    res.writeHead(status, headers);
    res.end(JSON.stringify({ ok: false, error: message, order_reference: result.order_reference }));
  });
});

server.listen(PORT, () => {
  console.log(`\nLocal mock order endpoint running at http://localhost:${PORT}`);
  console.log(`Set orderSubmissionUrl to this URL in site-content.js (temporarily!) to test.`);
  console.log(`See stored rows any time at http://localhost:${PORT}/rows\n`);
});
