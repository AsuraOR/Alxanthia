/**
 * Runs tests/browser-runner.html in a real, installed Chromium via Playwright
 * (DEV-24). No hard-coded OS-specific browser path — works on Windows, macOS,
 * Linux, and CI as long as `npm install` (or `npx playwright install`) has
 * fetched a Chromium build for Playwright to find.
 *
 * Usage: start a static server for the repo root first (e.g. `npm start`),
 * then run `node tests/run-browser-runner.js`.
 */
const { chromium } = require('@playwright/test');

const PORT = process.env.PORT || 8080;
const URL = `http://localhost:${PORT}/tests/browser-runner.html`;

// Some CI/sandbox environments pin an older pre-installed Chromium build than
// the @playwright/test version in package.json expects — fall back to that
// pinned executable instead of trying to download a new one.
const PINNED_CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH || '';

/**
 * Phase 2 (DEV-25): drives the real checkout dialog end to end in a real
 * browser, with the order-submission endpoint intercepted and mocked at the
 * network layer so this suite NEVER reaches the real Cloudflare Worker or
 * writes a row to the production Google Sheet, regardless of what
 * `site-content.js` has configured.
 */
async function runCheckoutDialogChecks(browser) {
  const results = [];
  const assert = (name, condition, details = '') => {
    results.push(condition ? `✔ PASS: ${name}` : `✖ FAIL: ${name} (${details})`);
  };

  // Read the configured endpoint directly from the source file (synchronously,
  // no page.evaluate) so the route filter below can match on it exactly
  // without touching any other request the page makes (styles, images, etc.).
  const siteContentSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'site-content.js'), 'utf8');
  const endpointMatch = siteContentSrc.match(/orderSubmissionUrl:\s*"([^"]*)"/);
  const endpoint = endpointMatch ? endpointMatch[1] : '';

  const page = await browser.newPage();
  // Unlock via the same localStorage flag app.js checks, seeded before any
  // page script runs — never the real passcode, and never the removed
  // `?unlock=` query parameter (ALX-22 instruction 12).
  await page.addInitScript(() => {
    try { localStorage.setItem('alxanthia_unlocked', 'true'); } catch (e) {}
  });
  let mockMode = 'success'; // 'success' | 'duplicate' | 'conflict' | 'timeout' | 'serverError'
  let capturedRequests = 0;

  if (endpoint) {
    await page.route(endpoint, async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      capturedRequests += 1;
      const body = JSON.parse(req.postData() || '{}');
      if (mockMode === 'timeout') {
        // Never resolve within the test's window — simulates an unreachable
        // upstream; the app's own 20s AbortController would eventually fire
        // in production, but the test aborts the route itself so it doesn't
        // have to wait 20 real seconds.
        await new Promise((resolve) => setTimeout(resolve, 500));
        return route.abort('timedout');
      }
      if (mockMode === 'conflict') {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, order_reference: body.order_reference, error: 'conflict' }) });
      }
      if (mockMode === 'serverError') {
        return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'upstream' }) });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, order_reference: body.order_reference, duplicate: mockMode === 'duplicate' })
      });
    });
  }

  page.on('pageerror', (err) => assert('No uncaught page error during checkout flow', false, String(err)));

  try {
    await page.goto(URL.replace('/tests/browser-runner.html', '/index.html'), { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => !!window.AlxanthiaApp, { timeout: 10000 });

    // A `hidden`-attribute element must actually render hidden — regression
    // guard for a real bug found in manual testing, where a custom CSS class's
    // own `display:` declaration silently overrode the browser's default
    // `[hidden] { display: none }`, so the element stayed visible (e.g. an
    // empty recent-order banner on a page that had never recorded an order,
    // and two dialog footers showing at once instead of one per step).
    const recentOrderBannerHiddenOnFreshVisit = await page.evaluate(() => {
      const el = document.getElementById('recent-order-banner');
      return !!el && el.hidden && getComputedStyle(el).display === 'none';
    });
    assert('The recent-order banner is truly hidden (not just empty) on a fresh visit with no stored order', recentOrderBannerHiddenOnFreshVisit === true);

    async function openCheckoutOnFreshStem() {
      await page.evaluate(() => { window.AlxanthiaApp.resetToInitial(); window.AlxanthiaApp.selectStem('Rose', false); });
      await page.click('#btn-checkout');
      await page.waitForSelector('#checkout-modal[open]', { timeout: 5000 });
    }

    // --- Focus & dialog naming (DEV-14) ---------------------------------
    await openCheckoutOnFreshStem();
    let labelledBy = await page.getAttribute('#checkout-modal', 'aria-labelledby');
    let activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assert('Review step: dialog aria-labelledby points at the visible heading', labelledBy === 'checkout-title', `got ${labelledBy}`);
    assert('Review step: focus lands on the step heading', activeId === 'checkout-title', `active was ${activeId}`);
    let visibleFooters = await page.evaluate(() => [...document.querySelectorAll('.checkout-dialog-footer')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id));
    assert('Review step: exactly the review footer is visible (not both dialog footers)', visibleFooters.length === 1 && visibleFooters[0] === 'checkout-review-footer', `visible: ${visibleFooters.join(',')}`);

    await page.click('#checkout-continue');
    await page.waitForSelector('#checkout-form-step:not([hidden])');
    labelledBy = await page.getAttribute('#checkout-modal', 'aria-labelledby');
    activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assert('Form step: dialog aria-labelledby updates to the form heading', labelledBy === 'checkout-form-title', `got ${labelledBy}`);
    assert('Form step: focus moves to the form heading', activeId === 'checkout-form-title', `active was ${activeId}`);
    visibleFooters = await page.evaluate(() => [...document.querySelectorAll('.checkout-dialog-footer')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id));
    assert('Form step: exactly the form footer is visible (not both dialog footers)', visibleFooters.length === 1 && visibleFooters[0] === 'checkout-form-footer', `visible: ${visibleFooters.join(',')}`);

    // --- Fill the minimum valid form ------------------------------------
    async function fillValidForm() {
      await page.fill('[name="buyer_name"]', 'Sagita');
      await page.fill('[name="buyer_whatsapp"]', '081234567890');
      await page.selectOption('[name="location_type"]', 'bali');
      await page.selectOption('[name="regency"]', 'Denpasar');
      await page.selectOption('[name="delivery_method"]', 'grab_gojek');
      const minDate = await page.getAttribute('[name="preferred_date"]', 'min');
      await page.fill('[name="preferred_date"]', minDate);
      await page.check('[name="acknowledgement"]');
    }
    await fillValidForm();

    // --- DEV-12: switching to "outside Bali" disables and clears the Bali branch
    await page.selectOption('[name="location_type"]', 'luar_bali');
    const regencyDisabled = await page.evaluate(() => document.querySelector('[name="regency"]').disabled);
    const addressEnabled = await page.evaluate(() => !document.querySelector('[name="address"]').disabled);
    assert('DEV-12: switching to outside-Bali disables the Bali regency field', regencyDisabled === true);
    assert('DEV-12: switching to outside-Bali enables the address field', addressEnabled === true);
    await page.selectOption('[name="location_type"]', 'bali');
    // DEV-12 also clears the branch that was just hidden — the Bali fields
    // above were cleared for real while outside-Bali was active, so they
    // must be re-picked (not a bug: that's the documented behaviour).
    await page.selectOption('[name="regency"]', 'Denpasar');
    await page.selectOption('[name="delivery_method"]', 'grab_gojek');

    // --- DEV-09: dialog cannot be escaped mid-submission -----------------
    mockMode = 'timeout';
    await page.click('#save-order');
    await page.waitForTimeout(150); // let isSubmitting guard engage
    const closeDisabledDuringSubmit = await page.evaluate(() => document.getElementById('checkout-close').disabled);
    assert('DEV-09: close button is disabled while a submission is in flight', closeDisabledDuringSubmit === true);
    await page.keyboard.press('Escape');
    const stillOpenAfterEscape = await page.evaluate(() => document.getElementById('checkout-modal').hasAttribute('open'));
    assert('DEV-09: Escape does not close the dialog while submitting', stillOpenAfterEscape === true);

    await page.waitForFunction(() => document.getElementById('save-order') && !document.getElementById('save-order').disabled, { timeout: 5000 });
    const timeoutError = await page.locator('#form-error').textContent();
    assert('DEV-08: a network abort/timeout shows the ambiguous-failure message, not a silent stall', !!(timeoutError && timeoutError.trim().length > 0), `error text: "${timeoutError}"`);
    const closeReenabled = await page.evaluate(() => !document.getElementById('checkout-close').disabled);
    assert('DEV-09: close button re-enables once submission finishes', closeReenabled === true);

    // --- DEV-04/DEV-06: a 409 conflict blocks further silent retries -----
    mockMode = 'conflict';
    await page.click('#save-order');
    await page.waitForTimeout(400);
    const conflictError = await page.locator('#form-error').textContent();
    assert('DEV-04: a 409 conflict response shows the conflict message', !!(conflictError && conflictError.trim().length > 0), `error text: "${conflictError}"`);
    const requestsAfterConflict = capturedRequests;
    await page.click('#save-order'); // a second click on an already-conflicted attempt must not hit the network again
    await page.waitForTimeout(300);
    assert('DEV-04: retrying after a conflict does not send a second network request for the same attempt', capturedRequests === requestsAfterConflict, `before=${requestsAfterConflict} after=${capturedRequests}`);

    // The conflicted attempt leaves the dialog open on the form step (by
    // design — DEV-04 stops rather than closes). Force it shut before
    // starting a fresh attempt, since #btn-checkout is unreachable while a
    // modal dialog covers it.
    await page.evaluate(() => { const m = document.getElementById('checkout-modal'); if (m.hasAttribute('open')) m.close(); });
    await page.waitForSelector('#checkout-modal:not([open])', { state: 'attached', timeout: 5000 });

    // --- Full success path -------------------------------------------
    await openCheckoutOnFreshStem();
    await page.click('#checkout-continue');
    await page.waitForSelector('#checkout-form-step:not([hidden])');
    await fillValidForm();
    mockMode = 'success';
    await page.click('#save-order');
    await page.waitForSelector('#checkout-success:not([hidden])', { timeout: 5000 });
    const successHeadingFocused = await page.evaluate(() => document.activeElement && document.activeElement.id === 'checkout-success-title');
    assert('DEV-14: success step moves focus to the success heading', successHeadingFocused === true);
    const waHref = await page.getAttribute('#checkout-whatsapp', 'href');
    assert('Success screen builds a WhatsApp link with the order reference', !!(waHref && waHref.includes('wa.me')));
    const successItemsText = await page.locator('#success-items').textContent();
    assert('Success screen shows what was ordered', !!(successItemsText && successItemsText.trim().length > 0), `items text: "${successItemsText}"`);
    const successTotalText = await page.locator('#success-total').textContent();
    assert('Success screen shows the order total', !!(successTotalText && successTotalText.trim().length > 0), `total text: "${successTotalText}"`);

    // The recent-order banner must appear as soon as the dialog is closed —
    // no page reload required (regression: checkoutAttempt.submitted used to
    // stay true in memory and permanently suppress it until a real reload).
    await page.click('#checkout-close');
    await page.waitForTimeout(150);
    const bannerVisibleNoReload = await page.evaluate(() => {
      const el = document.getElementById('recent-order-banner');
      return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    });
    assert('DEV-10: the recent-order banner appears immediately after closing, without a page reload', bannerVisibleNoReload === true);
    await page.click('#btn-checkout'); // reopen for the DEV-10 checks below
    await page.waitForSelector('#checkout-modal[open]', { timeout: 5000 });

    // --- DEV-10: reopening after success shows the success screen again,
    //     not a fresh review with a new reference -------------------------
    const referenceBefore = await page.locator('#success-reference').textContent();
    await page.click('#checkout-close');
    await page.waitForTimeout(100);
    await page.click('#btn-checkout');
    await page.waitForSelector('#checkout-modal[open]');
    const reviewHiddenOnReopen = await page.evaluate(() => document.getElementById('checkout-review').hidden);
    const successVisibleOnReopen = await page.evaluate(() => !document.getElementById('checkout-success').hidden);
    const referenceAfter = await page.locator('#success-reference').textContent();
    assert('DEV-10: reopening checkout after success shows the success step again', reviewHiddenOnReopen && successVisibleOnReopen);
    assert('DEV-10: the reference is unchanged on reopen', referenceBefore === referenceAfter, `before=${referenceBefore} after=${referenceAfter}`);

    // --- DEV-10: recent-order banner survives a reload --------------------
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.AlxanthiaApp, { timeout: 10000 });
    const bannerVisible = await page.evaluate(() => {
      const el = document.getElementById('recent-order-banner');
      return !!el && !el.hidden;
    });
    assert('DEV-10: the recent-order banner appears after a reload following a successful order', bannerVisible === true);

    // Reopen the success screen via the recovery link (the dialog itself
    // closed on reload; the button under test lives inside it).
    await page.click('#recent-order-view');
    await page.waitForSelector('#checkout-success:not([hidden])', { timeout: 5000 });

    // --- DEV-18: clipboard-denied fallback ---------------------------------
    await page.evaluate(() => {
      // Force the clipboard write to reject, as it would with denied permission.
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    });
    await page.click('#copy-reference');
    await page.waitForTimeout(150);
    const fallbackVisible = await page.evaluate(() => {
      const el = document.getElementById('copy-fallback-text');
      return !!el && !el.hidden && el.textContent.length > 0;
    });
    assert('DEV-18: a denied clipboard write shows a selectable manual-copy fallback', fallbackVisible === true);
  } catch (err) {
    assert('Checkout dialog flow completed without throwing', false, err && err.stack ? err.stack : String(err));
  } finally {
    await page.close();
  }

  return results;
}

async function main() {
  const launchOptions = {};
  const fs = require('fs');
  if (PINNED_CHROMIUM && fs.existsSync(PINNED_CHROMIUM)) {
    launchOptions.executablePath = PINNED_CHROMIUM;
  }
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(URL, { waitUntil: 'load', timeout: 15000 });
    await page.waitForSelector('body[data-done="true"]', { timeout: 15000 });

    const resultsText = await page.locator('#results').textContent();
    const statusClass = await page.locator('#status').getAttribute('class');
    await page.close();

    console.log('======================================================================');
    console.log('REAL-BROWSER TEST EXECUTION (PLAYWRIGHT CHROMIUM) — PHASE 1: browser-runner.html');
    console.log('======================================================================');
    console.log((resultsText || '').trim());
    console.log('======================================================================');

    if (consoleErrors.length) {
      console.log('Uncaught page errors:');
      consoleErrors.forEach((e) => console.log(' - ' + e));
    }

    console.log('\n======================================================================');
    console.log('REAL-BROWSER TEST EXECUTION (PLAYWRIGHT CHROMIUM) — PHASE 2: checkout dialog (network mocked)');
    console.log('======================================================================');
    const phase2Results = await runCheckoutDialogChecks(browser);
    console.log(phase2Results.join('\n'));
    console.log('======================================================================');

    const phase2Text = phase2Results.join('\n');
    const failed = (resultsText || '').includes('FAIL') || (resultsText || '').includes('EXCEPTION') || statusClass === 'fail'
      || consoleErrors.length > 0 || phase2Text.includes('FAIL');
    if (failed) process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error running browser runner:', err.message);
  process.exit(1);
});
