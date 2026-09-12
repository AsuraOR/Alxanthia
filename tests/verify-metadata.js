/**
 * =============================================================================
 * ALXANTHIA STUDIO — METADATA & STRUCTURED DATA TEST SUITE (ALX-19)
 * =============================================================================
 * Run with: node tests/verify-metadata.js
 *
 * Guards two ALX-19 defects from recurring silently:
 *   - the declared og:image dimensions must match the REAL file bytes,
 *     not a value that was correct once and then drifted;
 *   - the JSON-LD product catalogue must mirror site-content.js's real
 *     prices and real product structure (studio-curated mixed bouquets,
 *     not a flower-variety chooser that doesn't exist on the site).
 * =============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO — METADATA & STRUCTURED DATA SUITE');
console.log('======================================================================\n');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
console.log('--- SUITE M1: og:image dimensions match the real file (ALX-19) ---');
function readWebpDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${filePath} is not a WebP file`);
  }
  const chunkId = buf.toString('ascii', 12, 16);
  if (chunkId !== 'VP8 ') {
    throw new Error(`${filePath}: only simple-lossy (VP8 ) WebP is supported by this check, found "${chunkId}"`);
  }
  const off = 20; // RIFF(4)+size(4)+WEBP(4)+'VP8 '(4)+chunksize(4)
  const width = (buf[off + 6] | (buf[off + 7] << 8)) & 0x3FFF;
  const height = (buf[off + 8] | (buf[off + 9] << 8)) & 0x3FFF;
  return { width, height };
}

const imageMatch = html.match(/property="og:image" content="https:\/\/alxanthia\.com\/(img\/[^"]+)"/);
assert(imageMatch, 'index.html must declare an og:image');
const widthMatch = html.match(/property="og:image:width" content="(\d+)"/);
const heightMatch = html.match(/property="og:image:height" content="(\d+)"/);
assert(widthMatch && heightMatch, 'index.html must declare og:image:width and og:image:height');

const realDimensions = readWebpDimensions(path.join(ROOT, imageMatch[1]));
assert.strictEqual(Number(widthMatch[1]), realDimensions.width, `og:image:width (${widthMatch[1]}) must match the real file width (${realDimensions.width})`);
assert.strictEqual(Number(heightMatch[1]), realDimensions.height, `og:image:height (${heightMatch[1]}) must match the real file height (${realDimensions.height}) — this is the exact ALX-19 regression (1122 was declared for a 1122×1402 file)`);
console.log(`✔ Suite M1 Passed: og:image declares ${widthMatch[1]}×${heightMatch[1]}, matching the real ${imageMatch[1]} file exactly\n`);

// ---------------------------------------------------------------------------
console.log('--- SUITE M2: JSON-LD prices and structure mirror site-content.js (ALX-19) ---');
const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert(ldMatch, 'index.html must have a JSON-LD script block');
const structuredData = JSON.parse(ldMatch[1]);
const itemList = structuredData['@graph'].find((node) => node['@type'] === 'ItemList');
assert(itemList, 'The JSON-LD graph must contain an ItemList');
const products = itemList.itemListElement.map((li) => li.item);

const siteContentSrc = fs.readFileSync(path.join(ROOT, 'site-content.js'), 'utf8');
const clientSandbox = { window: {} };
vm.createContext(clientSandbox);
vm.runInContext(siteContentSrc, clientSandbox);
const clientData = clientSandbox.window.ALXANTHIA_DATA;

// Every single-stem flower price advertised must match the real catalogue.
// Iterates `flowerOrder` (the actually orderable, rendered set), not every
// key under `flowers` — site-content.js carries at least one orphaned
// entry (Lavender, unused and unrendered — see ALX-23) that must not be
// mistaken for a real product this test should expect JSON-LD to cover.
clientData.flowerOrder.forEach((flowerKey) => {
  const flower = clientData.flowers[flowerKey];
  const product = products.find((p) => p.name.includes(flower.id.name));
  assert(product, `JSON-LD must advertise a product named after the real Indonesian flower name "${flower.id.name}"`);
  assert.strictEqual(product.offers.price, flower.stemPrice, `JSON-LD price for ${flowerKey} (${product.offers.price}) must match site-content.js's real stemPrice (${flower.stemPrice})`);
});

// Every package price/stem-count advertised must match the real catalogue,
// and packages must NOT be represented as flower-specific variants — the
// real product has no flower-variety chooser (this is the core ALX-19 defect).
clientData.packages.forEach((pkg) => {
  const matches = products.filter((p) => p.offers.price === pkg.price && /campuran|mixed/i.test(p.name));
  assert.strictEqual(matches.length, 1, `Exactly one mixed-bouquet product must advertise the ${pkg.stems}-stem package at ${pkg.price}, found ${matches.length}`);
});
const flowerNamesInBouquetOffers = products.filter((p) => /buket/i.test(p.name) && clientData.flowerOrder.some((f) => p.name.includes(f)));
assert.strictEqual(flowerNamesInBouquetOffers.length, 0, `No bouquet package product must claim a flower-specific variant — packages are studio-curated mixed bouquets with no flower chooser: ${JSON.stringify(flowerNamesInBouquetOffers.map((p) => p.name))}`);

// Mini pots must be represented too (previously absent entirely).
clientData.miniPots.forEach((pot) => {
  const product = products.find((p) => p.offers.price === pot.price && /mini pot/i.test(p.name));
  assert(product, `JSON-LD must advertise a mini pot product at price ${pot.price}`);
});

console.log(`✔ Suite M2 Passed: all ${products.length} JSON-LD products mirror site-content.js's real prices, and no bouquet package claims a flower-specific variant that doesn't exist\n`);

// ---------------------------------------------------------------------------
console.log('--- SUITE M3: Content-Security-Policy is present and scoped (ALX-26) ---');
const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy"\s+content="([^"]*)"/);
assert(cspMatch, 'index.html must declare a Content-Security-Policy meta tag');
const csp = cspMatch[1];
['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'frame-src', 'base-uri', "form-action 'none'"].forEach((directive) => {
  assert(csp.includes(directive), `CSP must include a "${directive}" directive: "${csp}"`);
});
// The endpoint really configured in site-content.js must be allow-listed —
// a stale connect-src would silently break checkout the day this URL changes.
const endpointMatch = siteContentSrc.match(/orderSubmissionUrl:\s*"([^"]*)"/);
const configuredEndpoint = endpointMatch ? endpointMatch[1] : '';
if (configuredEndpoint) {
  const endpointHost = new URL(configuredEndpoint).origin;
  assert(csp.includes(endpointHost), `CSP connect-src must allow-list the actually configured order endpoint (${endpointHost}): "${csp}"`);
}
console.log('✔ Suite M3 Passed: the CSP is present, covers every relevant directive, and connect-src matches the real configured endpoint\n');

console.log('======================================================================');
console.log('✔ ALL 3 METADATA SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
