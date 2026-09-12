/**
 * =============================================================================
 * ALXANTHIA STUDIO — FAIL-CLOSED BOOT REGRESSION TEST (ALX-22)
 * =============================================================================
 * Run with: node tests/verify-fail-closed-boot.js
 *
 * Simulates a broken site-content.js (window.ALXANTHIA_DATA missing, as it
 * would be after a syntax error) and asserts the real app.js:
 *   - throws a named, diagnosable error from loadData() instead of letting
 *     a later call site fail with "Cannot read properties of null"
 *   - keeps the passcode curtain up (never marks it .unlocked)
 *   - reveals the hardcoded contact fallback
 *   - never throws an uncaught exception out of init()
 * =============================================================================
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('ALXANTHIA STUDIO — FAIL-CLOSED BOOT REGRESSION SUITE');
console.log('======================================================================\n');

function createMockElement(id) {
  return {
    id,
    style: {},
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach((c) => this._classes.add(c)); },
      remove(...cls) { cls.forEach((c) => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); }
    }
  };
}

const lockScreen = createMockElement('lock-screen');
const siteUnavailable = createMockElement('site-unavailable');
const elementsById = { 'lock-screen': lockScreen, 'site-unavailable': siteUnavailable };

const consoleErrors = [];
const mockConsole = Object.assign({}, console, {
  error: (...args) => { consoleErrors.push(args.join(' ')); }
});

const mockDocument = {
  readyState: 'complete', // init() runs synchronously below, as if DOMContentLoaded already fired
  getElementById: (id) => elementsById[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: {}
};

const sandbox = {
  window: {}, // deliberately no ALXANTHIA_DATA — the broken-config case
  document: mockDocument,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: {},
  console: mockConsole,
  URLSearchParams: URLSearchParams,
  setTimeout: () => {}
};
vm.createContext(sandbox);

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// app.js must not throw an uncaught exception out of its own IIFE even when
// site-content.js is completely missing.
assert.doesNotThrow(() => {
  vm.runInContext(appSrc, sandbox);
}, 'app.js must catch its own initialization failure, not throw out of the IIFE');

console.log('--- SUITE 1: Loud, named diagnostic ---');
assert.ok(consoleErrors.length > 0, 'A config failure must log a diagnostic');
assert.ok(
  consoleErrors.some((msg) => msg.includes('site-content.js failed to load or has a syntax error')),
  'The diagnostic must name the real cause, not a generic null-property message'
);
console.log('✔ Suite 1 Passed: the console names the real cause\n');

console.log('--- SUITE 2: Curtain stays up ---');
assert.strictEqual(lockScreen.classList.contains('unlocked'), false, 'The passcode curtain must never be marked unlocked on a config failure');
assert.strictEqual(lockScreen.style.display, 'flex', 'The passcode curtain must be forced visible on a config failure');
console.log('✔ Suite 2 Passed: the preview curtain stays up when config cannot be read\n');

console.log('--- SUITE 3: Hardcoded fallback is revealed ---');
assert.strictEqual(siteUnavailable.classList.contains('is-visible'), true, 'The static contact fallback must be revealed on a config failure');
console.log('✔ Suite 3 Passed: the contact fallback is shown\n');

console.log('======================================================================');
console.log('✔ ALL 3 FAIL-CLOSED BOOT SUITES PASSED SUCCESSFULLY');
console.log('======================================================================');
