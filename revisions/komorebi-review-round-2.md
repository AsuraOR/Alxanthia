# Komorebi Creations — Review, round 2

Date: 8 September 2026  
Reviewed main commit: `89c5505df9f9f6eb78957a6f56ca17965571b8da`  
Compared with: `5beb03538d51a13377953edcd592ebbb13f80519`

## Verdict

**The core ordering logic is substantially better. The work is still only partially complete, especially the mobile journey, keyboard accessibility, and verification.**

The agent fixed the most important defects from the previous review: unsafe gift-note rendering, inconsistent custom-order activation, the initial default sunflower order, and incorrect invalid-state counts. Those fixes should be preserved.

All numbers and links remain intentional placeholders. Their specific values are not defects, and this review does not ask the agent to invent replacements. Findings about configuration concern behavior when those values change, not whether the sample values are commercially correct.

This review covers source changes and executable controller tests. It does **not** certify rendered layouts, actual browser focus, loaded fonts, contrast, viewport overflow, image loading, or deployment behavior. No website files, access settings, or deployments were changed.

## What I checked

- Compared the two commits, including all seven changed files.
- Read the updated controller, configuration, HTML, stylesheet, README, and test suite.
- Ran `node tests/verify-ordering.js`: all 10 reported suites passed.
- Ran two additional probes against the actual controller inside the supplied mock environment: disabled-channel consistency and changing the custom minimum.
- Checked repository branches and open PRs; this report targets main, not the separate audit branch. No open PR was returned.

Evidence: [commit comparison](https://github.com/AsuraOR/komorebi-creations/compare/5beb03538d51a13377953edcd592ebbb13f80519...89c5505df9f9f6eb78957a6f56ca17965571b8da).

## Previous findings: what is actually resolved?

| ID | Status | Assessment |
| --- | --- | --- |
| R01 — Channel states | Partially fixed | Order/footer Shopee states and main WhatsApp visibility improved. DIY and availability messaging still ignore WhatsApp readiness. |
| R02 — Gift-note HTML | Fixed in source and controller test | Notes now use a separate text span with textContent. Real textarea event coverage remains missing. |
| R03 — Selection state | Core issue fixed | Custom steppers/reset activate custom consistently; initial summary and WhatsApp are neutral. Continue wording now matches immediate updates. |
| R04 — Invalid counts/language | Mostly fixed | Actual counts and ID/EN sticky prompts work. Other minimum-related copy remains hardcoded. |
| R05 — Keyboard focus | Mostly unresolved | Modal close handling changed, but package focus, finishing destination, and radio interaction remain. |
| R06 — Mobile journey | Unresolved | Structural ordering and optional builder changes were not made. |
| R07 — Small text/targets | Partially fixed | Several mobile labels are larger and four card actions now have 44px minimum heights. Layout/clipping and complete target coverage are unverified. |
| R08 — Package definition | Deferred/incomplete | Placeholder values are acceptable. Card/summary composition wording and the reusable package model still need alignment. |
| R09 — Evidence/copy | Deferred/incomplete | Actual assets and owner content can wait; process, timing consistency, and calculation-heavy copy remain. |
| R10 — Metadata | Unresolved | Structured offer model and saved-language metadata behavior were not repaired. |
| R11 — Tests | Meaningfully improved, still inadequate for UI claims | Tests now execute app.js. The custom DOM omits key real controls; modal test is not a focus-return test. |
| R12 — Documentation | Mixed | Better product positioning and owner list, but new unsupported completion claims and passcode reproduction were added. |

## A. Remaining functional issues

### A1 — Disabling WhatsApp does not disable the DIY contact route

**Priority: Medium. Reproduced in a controller probe. Related: R01.**

With both channel flags false:

| Observed field | Result |
| --- | --- |
| Main WhatsApp action | Hidden |
| DIY interest action | Still has a WhatsApp URL |
| Marketplace status copy | Still says orders are handled through WhatsApp |

The main action now respects the flag, but `renderKitTeaser()` still builds a WhatsApp link independently. Marketplace notices likewise assume WhatsApp is available. If the number is empty, the code still constructs a WhatsApp URL rather than showing an unavailable state.

**Fix:** Derive channel readiness once and use it for ordering, DIY, footer, and status copy. For both channels disabled, give a neutral availability message. Retain intentional sample numbers during development.

**Acceptance:** Test enabled, disabled, and empty-destination cases, including both channels disabled. Inspect URLs without sending messages.

### A2 — Changing the custom minimum produces contradictory instructions

**Priority: Medium. Reproduced in a controller probe. Related: R04.**

I changed the minimum to 5 in an in-memory test configuration and selected three stems:

| Output | Result |
| --- | --- |
| Valid order? | false |
| Sticky prompt | Min. 5 tangkai |
| Builder hint | Tambahkan minimal 3 tangkai untuk memesan buket custom. |

The newly dynamic sticky/WhatsApp prompts are correct, but builder hints, warning copy, and introductions still embed the original minimum. Discount descriptions similarly embed sample thresholds/rates.

**Fix:** Interpolate rule values into all applicable UI strings. The original numeric values can stay as placeholders; the point is that editing the configuration must not leave contradictory instructions.

**Acceptance:** Test an alternate minimum and discount threshold/rate. Every displayed rule must match the controller in ID and EN.

### A3 — Keyboard ordering still loses its place

**Priority: High for keyboard usability. Confirmed source paths; browser reproduction pending. Related: R05.**

- Package selection still empties and rebuilds `packages-grid`, removing the focused selection button.
- Finishing still calls focus on `#finish-label`, which remains a paragraph without tabindex.
- Stem selection and edit-selection navigation scroll without establishing a meaningful focus destination.
- Wrapping buttons still declare radio roles without arrow-key interaction or managed tab stops.

The modal change does not fix these separate issues.

**Fix:** Preserve or deliberately restore package focus; focus a suitable finishing heading/control; use native wrapping radios or complete the custom radio pattern.

**Acceptance:** Complete all three order modes using keyboard only. After selection/continuation, Tab should continue from the expected part of the form.

### A4 — Saved English still does not initialize matching title/description

**Priority: Low–medium. Confirmed source flow. Related: R10.**

Metadata changes remain inside `setLanguage()`. Initial loading restores the saved language through `initLang()` and renders the body without running that metadata update.

**Fix:** Share one language/metadata update routine between initialization and switching.

**Acceptance:** Save English, reload, then inspect document language, title, description, and visible content. Stable English share/search URLs remain optional separate work.

Evidence for A1–A4: [app.js](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/app.js), [configuration](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/site-content.js), [HTML](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/index.html).

## B. UI/UX work that was missed

### B1 — The requested mobile journey was not implemented

**Priority: Medium. Related: R06.**

The HTML change only adds initial hash scrolling. It does not restructure the buying flow:

- Flowers and bouquets remain consecutive grids without the proposed category browsing control.
- All four packages retain the same card-grid treatment.
- The custom builder remains always expanded.
- The DIY teaser remains before finishing.
- Mobile finishing controls remain before selected product identity and price.

**Recommended next layout:** catalogue → optional custom builder → selected identity/price → quantity and finishing → confirmation → craftsmanship/materials → FAQ → small DIY teaser.

Split the summary content from its final actions when arranging mobile order; moving the whole summary box above finishing would put confirmation too early.

### B2 — Typography improved, but the layout still needs visual review

**Priority: Medium. Related: R07.**

Credit the actual changes: mobile product prices and specifications are larger, the illustration caption is larger, and stem/add/package/continue buttons now have 44px minimum heights.

However:

- The two-column layout still applies on narrow phones.
- Descriptions remain clamped to three lines without a package detail expansion.
- Larger labels can wrap more and alter card heights; the source-only test cannot establish that this looks good.
- Other 10px labels remain in the stylesheet, so the README's claim that the smallest typography is now at least 11–12.5px is inaccurate.
- Minimum height alone does not establish that every interactive target is 44 × 44px in every rendered state.

**Acceptance:** Render ID/EN at 320 and 390px, plus 820/1024/1440px, including enlarged text. Check price prominence, full descriptions, button dimensions, and card alignment. Use a one-column fallback if necessary.

### B3 — Copy and package semantics remain inconsistent

**Priority: Medium; owner-specific facts can remain deferred. Related: R08/R09.**

The three-stem card still allows one type or a studio mix, while inclusions always describe mixed flowers. The builder still says “Atau hitung sendiri isinya”; only the continuation label changed.

The README now marks studio-mix composition “verified.” Placeholder copy does not establish owner approval. Keep this as a draft policy until confirmed.

Keep placeholder amounts, dimensions, and dates, but avoid contradictory relationships:

- One-type versus mixed package.
- Small-bouquet lead time versus all-custom lead time.
- Fixed package savings versus the separate custom discount formula.

Actual wrapping examples, process imagery, and shipping/support policy may be documented as pending assets/content. Their absence should not cause fabricated evidence or stop unrelated UI work.

### B4 — Structured data remains unchanged

**Priority: Medium before indexing. Related: R10.**

The sunflower AggregateOffer still lists two child prices while its highPrice exceeds both, and flower-specific bouquet offers still do not accurately represent the studio-mix package model. These are structural consistency issues even when the amounts are placeholders.

**Fix:** Represent actual stem and package types, keeping aggregate ranges consistent with their underlying offers. Do not add localized URL infrastructure or change staging simply to address this.

Evidence for B1–B4: [HTML](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/index.html), [CSS](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/styles.css), [configuration](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/site-content.js).

## C. Verification and documentation

### C1 — The test suite now tests production logic, but overstates UI coverage

**Priority: High before accepting completion. Related: R11.**

Loading app.js is a substantial improvement over copied pricing functions. The passing tests provide useful evidence for state, arithmetic, safe text rendering through the API, and generated draft strings.

They still do not constitute full integration with the real page:

1. The suite hand-builds its DOM instead of loading index.html.
2. It registers `order-note-input` and `wrap-options`, while the real controller uses `card-note-input` and `wrap-chips`. Consequently the real textarea binding and wrapping controls are absent from these tests.
3. The gift-note test calls the exported `setOrderNote()` helper rather than typing into the actual textarea.
4. The mock permits focus on arbitrary elements, unlike the browser's handling of an ordinary paragraph.
5. Suite 10 assigns a separate global modal function, never exercises the actual photo-opening path, focuses a mock trigger, and calls close. It makes no assertion that focus returned after closing. It could pass with focus restoration broken.
6. The mock has no layout engine or real image loading, so it cannot verify viewports, overflow, visual target dimensions, or rendering.

**Fix:** Keep the useful controller checks, then add a small real-browser suite loading actual HTML/CSS/JS. Exercise the real photo trigger, close button, Escape, textarea, wrapping controls, package selection, and continuation. Assert document.activeElement where focus matters.

Do not replace this with more hand-written DOM emulation. Report controller tests and browser checks separately.

### C2 — README completion claims remain too strong

**Priority: Medium. Related: R12.**

The corrected finished-flower opening, package names, and owner-input table are useful. But the README now says the entire system is ready and passed integration, broadly claims all targets and text sizes are fixed, and describes channel flags as strictly honored. The findings above contradict those claims.

It also reproduces the staging passcode in multiple places and describes the client-side curtain as private protection. The previous plan explicitly requested not reproducing that passcode. Remove the literal from documentation and describe the curtain as preview UI, not secure access control. No access/indexing changes are needed for this review.

The launch instructions should include rendered checks and robots/sitemap/canonical consistency, not only the mock suite followed by deployment.

**Acceptance:** Document exactly what passed, what was not tested, and which review IDs remain open. Mark sample commercial data as placeholders, not “official” or “verified.”

Evidence: [test suite](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/tests/verify-ordering.js), [README](https://github.com/AsuraOR/komorebi-creations/blob/89c5505df9f9f6eb78957a6f56ca17965571b8da/README.md).

## Next implementation pass

- [ ] Complete A3 keyboard ordering and C1 real-browser checks.
- [ ] Fix A1 channel-state consistency and A2 configuration-driven instructions.
- [ ] Implement B1 mobile flow and visually verify B2.
- [ ] Fix A4 saved-language metadata and B4 structured offer consistency.
- [ ] Align B3 draft copy without inventing owner facts.
- [ ] Correct C2 documentation and provide screenshots/results with remaining blockers.

Do not redo the fixed gift-note rendering, neutral initial state, unified custom activation, or corrected sticky counts.

## Prompt for the implementation agent

> Use this round-2 review against main commit 89c5505df9f9f6eb78957a6f56ca17965571b8da. Preserve fixes already confirmed. All numbers and links are intentional placeholders: do not invent replacements or call them defects. Complete the remaining interaction, mobile-flow, configuration-consistency, and metadata work. Verify the actual HTML in a browser; the existing controller/mock tests are useful but insufficient for focus and layout. Return resolved finding IDs, exact test results, ID/EN viewport screenshots, and remaining owner-content needs. Keep staging, do not send messages/orders, and do not deploy without authorization. Do not claim completion for work you have only documented.
