# Komorebi Creations — Post-implementation review

Reviewed: 8 September 2026  
Repository: AsuraOR/komorebi-creations  
Branch: main  
Commit: `5beb03538d51a13377953edcd592ebbb13f80519`  
Baseline: the merged `komorebi-implementation-plan.md` dated 8 September 2026.

## Placeholder context confirmed by the owner

All numbers and links are intentional placeholders. Do not treat current prices, dimensions, production times, contact numbers, social links, or marketplace URLs as implementation mistakes, and do not invent replacements. They can remain during development. Evaluate the consistency of the data model, calculations, interactions, and enabled/disabled states independently of the sample values. Replacing and approving commercial values/destinations is a later pre-launch task.

## Overall assessment

**The agent made useful progress, but the implementation is incomplete and should not be treated as launch-ready.** Keep the botanical identity and the improvements already made. The next pass should repair ordering integrity, finish the mobile journey, and replace overstated verification with evidence.

The biggest problems are:

1. Channel availability handling is incomplete: disabling Shopee leaves active-store messaging, and the WhatsApp visibility setting is ignored.
2. Gift-card text is interpreted as HTML in the summary.
3. The custom builder mixes draft edits with active-order edits.
4. Package selection still destroys keyboard focus; the intended finishing focus destination is not focusable.
5. The compact mobile design shrinks important text and controls instead of fully solving the browsing journey.
6. The passing tests do not execute the actual application controller.

**Scope and evidence:** This is a current-source and test-suite review, not a rendered visual/device certification. I read the current HTML, CSS, configuration, application controller, README, repository tree, and ordering tests. I ran `node tests/verify-ordering.js` against the retrieved files: it passed all 10 reported suites. The live URL could not be opened by the web lookup in this session, so I have not verified the deployed commit, screenshots, loaded fonts, actual touch behavior, contrast, overflow, or performance. Source-deduced reproduction paths below still need browser execution. No website code, access settings, messages, or deployments were changed.

## 1. What the agent got right

| Area | Improvement visible in source | Qualification |
| --- | --- | --- |
| Custom initialization | All four flower counts start at zero. | The rest of the selection state still needs work. |
| WhatsApp contents | Custom drafts now include each selected flower and quantity, total stems, estimate, wrapping, note, and shipping exclusion. | Recipient is intentionally a placeholder; note display is unsafe. |
| Invalid custom orders | The custom CTA is disabled below the minimum; active invalid custom orders lose the WhatsApp href. | Does not solve the separate draft/active-order mismatch. |
| Individual stems | A quantity stepper updates individual stem totals and draft quantity. | First-visit order summary still silently defaults to a sunflower. |
| Wrapping economics | Custom wrapping is explicitly itemized inside the total. | Keep this; do not add it again. |
| Product inspection | Flower images open a dialog instead of selecting a product and jumping away. | Browser keyboard/dialog checks remain necessary. |
| Package progression | A selected package gains a finishing action. | Focus is lost when the package cards are rebuilt. |
| Page order | Ordering now precedes craftsmanship and material sections. | DIY still sits between selection and ordering. |
| Mobile hero | CSS puts introductory text and actions before the large image. | Initial viewport visibility is unmeasured. |
| Mobile menu | Opaque panel treatment, scrim, scroll lock, Escape, and resize close behavior exist. | Full keyboard/background behavior is not verified. |
| Custom stepper focus | The renderer records and restores the focused custom increment/decrement control. | This is not implemented consistently for other controls. |
| Gerbera pricing | The card explicitly says the price is for one stem despite the multi-stem image. | The mobile disclaimer is very small. |
| Staging | The source retains the preview gate and noindex directive. | Appropriate until an authorized release; not a bug to remove now. |

## 2. Fix first: ordering and correctness

### R01 — Channel-state handling is inconsistent; destinations are intentional placeholders

**Priority: Medium for implementation. Placeholder replacement is a separate pre-launch task.**

The store configuration enables Shopee and points it to `https://shopee.co.id`. The UI calls this an official store, says it is ready for orders, and announces that it is opening Komorebi's store. The owner confirms this is an intentional placeholder, so the destination itself is not an implementation defect. The active-store presentation can serve as a preview of the intended future state.

The WhatsApp number still matches the example supplied beside the configuration field. Instagram also remains a generic-looking account URL whose ownership is not established by this review. These are acknowledged placeholders, not defects to fix during this implementation pass.

The marketplace notice is set to the active-store wording regardless of whether Shopee is enabled. Disabling the button alone will therefore leave a contradictory readiness claim. Additionally, `showWhatsapp` is configured but is not consulted by the controller; the DIY WhatsApp link is generated independently of channel readiness.

**Required correction**

- Retain sample destinations during development; replace them with owner-approved destinations before launch.
- Ensure unavailable states are represented consistently when a channel is disabled or unconfigured, including the order section, footer, status notice, and DIY interest action.
- Make all channel toggles effective. A disabled/unconfigured contact must not remain actionable elsewhere.
- Keep verified WhatsApp primary when it is the actual available ordering channel.
- Explain that ordinary marketplace links do not transfer the website's custom composition, wrapping, or card message.

**Acceptance:** Inspect every generated destination without sending anything. Test each channel enabled, disabled, and unconfigured. A disabled channel must not show active-store copy. The current homepage is an allowed development fixture; a real destination is a release requirement.

Evidence: [store configuration](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/site-content.js), `renderOrderSection`, `renderFooter`, and `renderKitTeaser` in [app.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/app.js).

### R02 — Gift-card content is inserted as HTML

**Priority: High. Confirmed source defect.**

`renderSummaryIncludes()` appends the customer's gift note to a string and interpolates it into `li.innerHTML`. URL encoding protects the WhatsApp URL representation; it does not make this HTML rendering safe.

A harmless verification example is to type `<b>Happy birthday</b> & love`. The summary should show those exact characters, but the current code interprets the markup. More dangerous event-bearing markup is also possible through this sink. This review did not establish a remote or stored attack path; the confirmed problem is user input being interpreted as page markup.

**Required correction:** Create the decorative bullet separately and put the note/content in a text node or `textContent`. Preserve punctuation, emoji, and the exact note across rerenders and language changes.

**Acceptance:** Angle brackets display literally; no elements are created from the note; the decoded WhatsApp draft preserves the same text. Verify using the actual textarea and summary, not a separate message helper.

Evidence: `renderSummaryIncludes` in [app.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/app.js).

### R03 — The builder still has two conflicting state models

**Priority: High. Confirmed source behavior.**

Adding a flower from a catalogue card immediately sets `orderMode = 'custom'`. Editing the builder's own steppers does not. It only sets `hasUserSelected = true`, and updates the order summary if the order was already custom.

Consequently:

- From a fresh page, increasing a builder count can mark the session as selected while the active order remains the default sunflower.
- After choosing a package, editing custom counts leaves that package active until “Use this bouquet.”
- Once custom is active, the same stepper edits change the active order immediately.

The meaning of the same edit therefore depends on the preceding journey.

**Required correction:** Choose one model throughout. I recommend making custom edits the active custom selection immediately, with the minimum gate applied consistently; rename the apply action to a clear finishing/continue action. Alternatively, implement an explicitly labeled separate draft with an apply action, and keep the sticky bar from suggesting that the old active order represents the draft.

Also implement a genuine unselected order state. The neutral sticky prompt alone does not prevent a fresh visitor who scrolls to ordering from seeing a sunflower summary and usable draft.

**Acceptance:** Test fresh page → builder, package → builder, stem → add-to-bouquet, custom → reset, and custom → package → custom. Builder, summary, sticky bar, and destination must agree on which order is active.

Evidence: `bumpCustomCount`, `addFlowerToBouquet`, `useCustomBouquet`, and `renderOrderSection` in [app.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/app.js).

### R04 — Invalid sticky states report the wrong quantity and language

**Priority: Medium. Confirmed source defect.**

Every invalid active custom selection is rendered as “Buket custom (0),” even with one or two stems. Its price/action strings are hardcoded Indonesian; the disabled WhatsApp action also falls back to Indonesian. The neutral English sticky prompt falls back to “Pilih bunga.”

**Correction:** Use actual totals and localized strings for zero, one, two, and valid quantities. Derive the minimum from configuration rather than embedding 3 in fallback strings.

**Acceptance:** Check ID and EN at 0/1/2/3 stems and with a temporarily changed minimum in a test fixture.

## 3. Finish the customer journey and accessibility

### R05 — Package focus and finishing focus remain broken

**Priority: High for keyboard ordering. Confirmed source defects.**

Selecting a package clears and recreates `packages-grid`, removing the focused selection button. Custom stepper focus restoration does not cover package cards.

The finishing action calls `finishLabel.focus()`, but `#finish-label` is an ordinary paragraph without `tabindex`. The intended focus movement is therefore not established. Stem selection and edit-selection routes only scroll.

Wrapping chips declare radio roles but have no arrow-key handling or roving tab behavior. The click path restores focus to the selected chip, which is useful but does not complete the radio interaction.

**Correction:** Preserve the selected package control or restore focus deliberately; give continuation a meaningful focusable destination; use native radios or implement the complete radio interaction. Localize the group and control labels.

**Acceptance:** Complete package, stem, and custom ordering using only the keyboard. Repeated edits must retain a meaningful focus position; pressing Tab after continuation should proceed through finishing.

Evidence: `renderBouquetsUI`, `scrollToSection`, and wrapping rendering in [app.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/app.js); `finish-label` in [index.html](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/index.html).

### R06 — Mobile flow changes are only partly implemented

**Priority: Medium. Confirmed structure; visual impact needs rendering.**

- Flowers and bouquets are still consecutive grids, with no dedicated category switch or compact bouquet-size comparison.
- The custom builder is always expanded.
- The DIY teaser still comes before ordering.
- On mobile, `.order-grid` becomes one column, retaining finishing controls before the selected identity and price.

**Correction:** Add clear stem/bouquet navigation, keep all sizes discoverable, expose the custom builder when requested, and move the DIY teaser below FAQ. Arrange mobile ordering as identity/price → quantity where applicable → wrap/card → final action. Do not simply move the entire summary box above finishing, since it also contains the final actions.

**Acceptance:** At 390 × 844, a buyer can identify their selection before editing finishing options and reach confirmation without passing the DIY promotion. Opening/collapsing custom preserves counts.

### R07 — Mobile compactness was purchased with tiny text

**Priority: Medium. Confirmed CSS choices; rendered dimensions unverified.**

Mobile CSS sets flower specifications and bouquet stem labels to 9px, flower prices to 11px, ordering labels to 10px, and package continuation to 9.5px. Several buttons have 38–40px minimum heights, below the plan's 44px project target. Actual height can be larger if text wraps; the source does not prove every rendered target is undersized.

The Gerbera one-stem disclaimer and custom illustration caption also use 10px text. These are purchase-critical explanations.

Both flower and bouquet descriptions are clamped to three lines, but bouquet cards do not provide a detail expansion. Important qualifications may be hidden depending on width and language.

**Correction:** Increase practical text sizes and guarantee the project's target sizes. Use a one-column fallback or compact comparison layout where two columns require unreadably small copy. Provide access to full package descriptions.

**Acceptance:** Check 320/390px, ID/EN, and enlarged text. Measure controls and inspect actual clipping. Keep the botanical headings and palette; this does not require a redesign.

Evidence for R06–R07: [index.html](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/index.html), [mobile CSS](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/styles.css).

## 4. Product definition, copy, and metadata

### R08 — Package contents and price explanations remain incomplete

**Priority: High before launch. Part implementation gap, part owner input.**

The three-stem card still permits one type or a studio-selected mix, while the summary always says mixed flowers. Larger packages lack a complete composition/palette description, approximate finished dimensions, and substitution rules. WhatsApp package drafts include package name and stem count but no composition policy.

The 9- and 15-stem descriptions claim an included 10% saving, but no defined equivalent undiscounted composition establishes that claim. The amounts are intentional placeholders; the issue to settle is how package savings will be defined and explained when real values are entered. Fixed package prices can legitimately differ from custom arithmetic; do not “fix” this by automatically changing commercial prices.

**Correction:** Obtain an approved definition for each package, then reuse it in the card, details, summary, and draft. Explain fixed studio arrangement pricing versus custom pricing. Confirm or remove package discount claims.

### R09 — Evidence and trust work remains unfinished

**Priority: Medium; business details required before launch.**

The process section remains four text steps. Wrapping remains color swatches without actual examples. Shipping origin remains “Indonesia”; a real origin can be supplied in the later owner-content pass. Damage support now asks for photos, which is an improvement, but does not explain support for an incorrect order or an approved resolution process.

Production timing remains inconsistent: custom inclusions always say 3–4 working days, while the trust/FAQ copy distinguishes small bouquets at 2–3 days and large ones at 3–4. This may be an intentional custom lead time, but it must be stated explicitly.

Material copy still makes broad safety claims. Confirm these with the owner rather than treating copy as product evidence. Keep generated imagery recognizable as illustrative; do not invent workshop photos, founder evidence, or measurements.

Copy tasks also remain: “Atau hitung sendiri isinya” and “campuran custom yang Anda hitung sendiri” survive. Prefer “Rancang buket pilihan Anda” and a plain explanation that customers choose and the studio assembles.

**Acceptance:** Maintain a concrete owner-input/asset list. Do not mark these tasks complete merely because plausible copy has been written.

### R10 — Structured data does not accurately describe the offer model

**Priority: Medium before indexing. Confirmed source mismatch.**

The sunflower Product uses an AggregateOffer with a high price of Rp745.000, but its two listed offers are Rp55.000 and Rp195.000. It also describes a sunflower bouquet where the customer-facing packages allow studio-selected mixed arrangements. The static offers declare InStock, while the visible offer is made to order; the owner should confirm availability semantics.

**Correction:** Model the actual stem and package products and their real prices consistently. Keep static metadata synchronized with the editable catalogue. Verify the final served HTML during release; do not assume changing JavaScript translations also changes social previews.

Localized title/description changes run in `setLanguage()`, but saved-language initialization does not call that metadata update. A returning English visitor can therefore get English body content with the original Indonesian title/description.

**Acceptance:** Compare each structured offer to the visible catalogue. Test a saved English preference on reload. English search/share URLs remain an optional scoped enhancement, not a prerequisite to this repair.

Evidence for R08–R10: [site-content.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/site-content.js), [index.html](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/index.html), [app.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/app.js).

## 5. Verification and handoff need correction

### R11 — The green tests provide much less coverage than claimed

**Priority: High. Confirmed by running and reading the suite.**

The suite loads configuration but never loads `app.js`. It defines its own calculation and WhatsApp-message functions, then tests those copies. Its DOM/CSS checks mostly search source strings. Its “security” check asserts that a sample without a script tag does not contain one; it does not exercise note rendering.

The suite explicitly requires the Shopee homepage URL and enabled status. The homepage is an intentional development placeholder, so its presence is not a bug. However, hardcoding it as required behavior makes the suite fail when the owner enters a real shop URL and does not test disabled/unconfigured channel behavior.

**Correction**

- Exercise the actual controller through the rendered page or shared production functions.
- Test real clicks, textarea updates, resulting summary text, focus, and decoded links.
- Test that configured destinations are respected and disabled/unconfigured states work, rather than requiring one placeholder URL. Keep production destination verification on the release checklist.
- Include 0/2/3 and 8/9 custom counts, mode transitions, reset, two individual stems, disabled channels, and ID/EN.
- Keep arithmetic checks, but do not present them as browser/accessibility verification.

**Acceptance:** The revised tests must fail against the specific defects in this review and pass after correction. Report precisely what ran.

Evidence: [tests/verify-ordering.js](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/tests/verify-ordering.js).

### R12 — Documentation overstates completion and still contradicts the site

**Priority: Medium. Confirmed documentation mismatch.**

The README claims zero overflow at five widths without providing corresponding measurements in the reviewed test suite. It should identify current destinations and numbers as development placeholders. It also claims order reference numbers; the generated draft has no reference number. Its opening still emphasizes assembling flowers yourself, and its package names differ from the Indonesian UI.

Historical revisions and large original assets remain in the repository. This is not proof they are requested by the landing page or included in a deployed artifact. Inspect the actual deployment before making cleanup/performance claims; preserve originals.

**Correction:** Update the README to describe implemented behavior, add completed/deferred/blocked task IDs, and attach viewport/test evidence. Document the preview curtain accurately without copying its passcode. Keep launch/indexing changes pending authorization.

Evidence: [README.md](https://github.com/AsuraOR/komorebi-creations/blob/5beb03538d51a13377953edcd592ebbb13f80519/README.md).

## 6. Status against the original phases

| Original phase | Assessment | Main remaining work |
| --- | --- | --- |
| 0 — Baseline and decisions | Not evidenced as complete | Owner decisions, authoritative contacts, baseline and blocker handoff. |
| 1 — Ordering | Partly implemented | R01–R04, package definition, safe note rendering. |
| 2 — Mobile journey | Partly implemented | R06, optional builder, identity-before-finishing order. |
| 3 — Hierarchy/accessibility | Partly implemented | R05/R07, real keyboard and rendered-state checks. |
| 4 — Evidence/copy/trust | Partly implemented or awaiting owner assets | R08/R09, actual wrapping/process evidence, consistent copy. |
| 5 — Metadata/assets/staging | Partly implemented; some work legitimately deferred | R10, deployment artifact audit, documented release checklist. |
| 6 — Integrated verification | Inadequate evidence | R11/R12; actual application tests and viewport evidence. |

## 7. Recommended next implementation passes

### Pass A — Repair order integrity

- [ ] R02: Render the gift note literally.
- [ ] R03: Unify selection state and implement a neutral order summary.
- [ ] R04: Correct count, minimum, and language in invalid states.
- [ ] R01: Make destination readiness and channel flags honest and consistent.
- [ ] R11: Add real application regression checks for these defects.

### Pass B — Complete the buying journey

- [ ] R05: Preserve focus and finish radio/continuation behavior.
- [ ] R06: Finish category/custom navigation and mobile ordering sequence.
- [ ] R07: Improve practical text and target sizes; expose full package details.
- [ ] Verify the actual layouts at 320, 390, 820, 1024, and 1440px, including 390 × 844 and enlarged text.

### Pass C — Resolve launch content and handoff

- [ ] R08/R09: Integrate owner-approved package definitions, lead times, support policy, and truthful assets.
- [ ] R10: Align metadata and saved-language behavior.
- [ ] R12: Correct documentation and attach evidence with remaining blockers.
- [ ] Prepare the release checklist; retain staging until launch is authorized.

## Copy-paste prompt for the implementation agent

> Review commit 5beb03538d51a13377953edcd592ebbb13f80519 and this post-implementation review. Preserve the botanical identity and existing successful changes. Complete Pass A, then Pass B, then the unblocked work in Pass C. Exercise the actual app rather than testing reimplemented helpers. Do not invent store URLs, contact details, package compositions, dimensions, policies, or photographs. Keep an explicit owner-input list. Do not send messages/orders, remove staging, delete original assets, or deploy without authorization. Return resolved review IDs, exact tests and outcomes, viewport screenshots, and a concise list of deferred or blocked items. Do not claim visual/accessibility/performance checks that were not actually run.
