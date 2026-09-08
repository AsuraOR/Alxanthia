# Komorebi Creations — Phased UI/UX Implementation Plan

Date: 8 September 2026  
Repository: https://github.com/AsuraOR/komorebi-creations  
Scope: Merge of the conversation audit and the supplied `komorebi-ux-audit.md`. This document is an implementation brief; no website changes have been made.

## Instructions for the implementation agent

Improve the existing website using the phases below. Preserve the cream, antique botanical identity, Cormorant Garamond headings, Karla body text, responsive images, lightweight vanilla implementation, bilingual content, and reduced-motion support. The current business focus is finished stems and bouquets; DIY kits are coming later.

1. Read repository instructions and inspect the current branch before editing. Record the baseline commit and check whether each finding still applies.
2. Implement phases in order, in reviewable changes. Do not rebuild the site or introduce a framework merely to execute this plan.
3. Use the acceptance criteria as the definition of done. Add focused behavioral tests where they protect ordering or state logic; use visual inspection for layout and copy changes.
4. Continue all work that does not depend on missing business information. Record unresolved decisions and hide or qualify unavailable offers instead of inventing facts.
5. Keep production publishing, staging removal, real prices, real contact details, and business promises tied to the owner's explicit instructions. This document alone is not an instruction to deploy.
6. Report changes, evidence, remaining blockers, and the next phase. Do not mark a task complete merely because its code was written.
7. Do not send test WhatsApp messages or submit real orders. Inspect generated drafts/URLs without sending them.
8. Preserve original artwork and unrelated files. Do not delete masters, rewrite Git history, or remove staging access without the applicable authorization.

### Evidence and limitations

- **Audit A:** conversation audit of `index.html`, `styles.css`, `app.js`, and `site-content.js` on `main`. The live site displayed the private-access gate; full visual/device tests were not completed.
- **Audit B:** supplied Markdown reports local visual tests at 1440/820/390 px and overflow checks at 320/390/820/1024/1440 px. Its fonts were blocked, so fine typography judgments were excluded. Treat its measurements as reported findings to reproduce, not tests already performed by the implementation agent.
- Audit B reports good text contrast, accessible names, image alt coverage, no duplicate IDs, and no horizontal overflow. Preserve these strengths and verify that changes do not regress them.
- Asset sizes, deployed files, visual failures, and current production state must be checked against the actual checkout and deployment. Earlier audits may describe different revisions.

## Phase overview

| Phase | Goal | Dependency | Priority |
| --- | --- | --- | --- |
| 0 | Establish baseline and resolve business assumptions | None | Start here |
| 1 | Make selection, pricing display, and order handoff reliable | Baseline; confirmed rules where needed | Launch blocker |
| 2 | Repair mobile navigation and shorten the purchase path | Phase 1 state behavior | High |
| 3 | Refine visual hierarchy, layout, and accessibility | Phase 2 structure | High |
| 4 | Improve product evidence, copy, and customer confidence | Verified assets and business details | High |
| 5 | Align language, metadata, deployment assets, and staging | Confirmed launch/language strategy | Before launch; some optional |
| 6 | Verify complete journeys and prepare release handoff | Applicable phases complete | Release gate |

## Phase 0 — Baseline and business decisions

### Tasks

- [ ] **P0.1** Record branch, commit, deployment setup, relevant repository instructions, and current console errors. Reproduce reported defects before choosing their technical cause.
- [ ] **P0.2** Capture desktop, tablet, and phone baselines, including open navigation, catalogue, builder, selected package, finishing, and FAQ. Use actual fonts where available; record fallback fonts otherwise.
- [ ] **P0.3** Create a short decision register for: actual WhatsApp/Instagram/listing URLs; shipping city/service area; production lead times; damage support; available flower colors; package compositions; package prices; wrapping inclusion; single-stem quantity rules; any order-capacity limits.
- [ ] **P0.4** Confirm whether Lavender is intentionally excluded. It exists in configuration and reportedly appears in bouquet imagery/README, while the active catalogue lists Sunflower, Rose, Tulip, and Gerbera. Do not automatically add a sellable SKU.
- [ ] **P0.5** Confirm which images represent actual products and which are temporary AI concepts. Existing studio/kit images must not be assumed to document the real founders, workshop, or shipping contents.

### Acceptance criteria

- Baseline and decision register distinguish verified facts, proposed defaults, and unresolved owner inputs.
- Independent UI work proceeds without waiting for every business answer.
- No invented contacts, testimonials, stock claims, shipping guarantees, or sales rankings enter the site.

## Phase 1 — Ordering correctness and conversion actions

### P1.1 Establish one consistent selection state

- [ ] Start a custom bouquet empty, or expose a clearly labeled suggested arrangement that users explicitly choose. Remove silent preselection of two sunflowers and one rose.
- [ ] Decide and implement one consistent builder model: edits are a draft until applied, or edits immediately update the active order. Avoid a half-applied mixture of both.
- [ ] Before any product selection, show a neutral mobile action such as `Pilih bunga`, rather than a sunflower presented as the user's order.
- [ ] Make the sticky bar reflect the active selection. While editing a draft, show the draft consistently or hide the purchase bar in that context; do not display conflicting selections/prices.
- [ ] Give immediate feedback for `Tambah ke buket`: an updated count and accessible confirmation near the action. Offer a route to review the builder without forcing a scroll after every addition.
- [ ] Add an obvious next step after selecting a package. Use a consistent progression to finishing, with keyboard focus handled meaningfully.
- [ ] Add a single-stem quantity control. Do not impose bouquet minimum quantities on individual stems. Update totals, summary, and draft together.

### P1.2 Preserve all order details

- [ ] Include mode, flower quantities, total stems, package name/composition where defined, price or estimate, wrapping, and gift note in the WhatsApp draft.
- [ ] Revalidate custom minimum quantities at the final action. Resetting or removing flowers below the minimum must disable purchase continuation and explain why.
- [ ] Label custom prices as estimates wherever final confirmation is required.
- [ ] Show `Belum termasuk ongkir` next to displayed order/estimate totals, with equivalent English copy.
- [ ] Add an edit-selection route from the summary.
- [ ] Replace the fixed five-stem custom preview with selected flower thumbnails/counts, or explicitly label any illustrative photo. Do not imply an exact arrangement preview.
- [ ] Preserve typed gift notes and valid choices across language switches and UI updates. Render user-entered notes as text, not HTML; encode draft URLs correctly.

### P1.3 Clarify package and wrapping economics

- [ ] Define package composition or clearly describe a florist-selected mix. Align package card, summary, and draft wording.
- [ ] Explain fixed-package pricing versus custom pricing. Compare like-for-like arrangements before concluding that a package is overpriced.
- [ ] Do not automatically recalculate all package prices from stem prices: composition, labor, presentation, and commercial pricing require owner confirmation.
- [ ] Clarify that wrapping is included in the displayed bouquet total. If custom totals itemize a Rp35.000 wrapping fee, state that it is already included in that total and never add it twice.
- [ ] Clarify wrapping inclusion for single stems separately.
- [ ] Keep the configured 9+ stem discount rule consistent across builder, descriptions, and summaries unless the owner changes it.

### P1.4 Make the available channel primary

- [ ] Verify actual contact destinations. The audited WhatsApp value matched the example in the configuration; do not treat it as confirmed.
- [ ] While marketplaces are unavailable, make the verified WhatsApp action the filled primary CTA. Replace two large disabled marketplace buttons with a concise availability notice.
- [ ] Remove dead `#` marketplace footer links or present noninteractive coming-soon text.
- [ ] Align trust-bar and FAQ claims with enabled channels; do not promise marketplace payment protection during a WhatsApp-only flow.
- [ ] When listings become available, use product-specific destinations where possible. Explain any information users must copy/reselect; ordinary marketplace links do not automatically transfer wrapping or card text.
- [ ] Rename `checkout` to order confirmation when the next step is a chat.

### Acceptance criteria

- Empty state → add first flower produces exactly the intended quantity, with visible feedback.
- Mixed custom order with at least three stems produces a complete, correctly priced draft.
- Reset/removal below minimum prevents invalid continuation, including from the summary.
- Each package has a clear selected state and next action.
- Two individual sunflowers remain a two-stem individual order, with the correct total and draft.
- Wrapping is counted once; shipping exclusion and estimate status are clear.
- Gift notes containing punctuation, emoji, ampersands, and angle brackets remain safe literal text and survive ID/EN switching.
- No test message is sent; unavailable channels cannot be mistaken for working checkout.

## Phase 2 — Mobile navigation and purchase journey

### Tasks

- [ ] **P2.1** Reproduce the reported translucent mobile menu. Give the panel a dependable opaque background and remove nested backdrop-filter effects if responsible. Add a dismissible scrim if useful and prevent background scrolling while open; restore scrolling on close and desktop resize.
- [ ] **P2.2** Keep Escape, outside click, menu-link selection, focus restoration, and collapsed-menu accessibility working. If the menu becomes a modal interaction, implement the matching focus/background behavior consistently.
- [ ] **P2.3** Move the primary hero action before the large image on phones, with concise supporting copy. Preserve flower visibility and avoid cropping away the product merely to hit a fold target.
- [ ] **P2.4** Make `Lihat bunganya` visible in the initial 390 × 844 viewport at default text size. At smaller screens or enlarged text, prioritize readable content over a rigid fold target.
- [ ] **P2.5** Introduce clear `Tangkai` and `Buket` browsing choices. Retain navigable anchors and discoverable content. Avoid forcing eight full-height cards before customers can reach custom selection.
- [ ] **P2.6** Use compact flower cards, two columns only where readable. Give bouquets a distinct treatment: a size/composition comparison with selected details or a large image plus compact package list. Keep all four sizes discoverable.
- [ ] **P2.7** Expose custom configuration when requested, including from flower-card additions. Preserve draft state if collapsed.
- [ ] **P2.8** Move finishing next to/below product selection, before long craftsmanship/material content. On mobile, show selected product and price first, then wrap/card options, then the final confirmation action.
- [ ] **P2.9** Fix the long `Bunga Matahari` builder row with a stable name/stepper layout. Allow text to wrap without pushing one stepper into an inconsistent position.

### Recommended page sequence

1. Hero with direct action and concise production/delivery facts.
2. Stems/bouquets catalogue.
3. Optional custom builder.
4. Selection summary, finishing, and confirmation.
5. Craftsmanship and material evidence.
6. Shipping, care, and support FAQ.
7. Small DIY interest section.
8. Footer.

### Acceptance criteria

- Open mobile navigation is readable with no distracting text showing through it.
- Every primary journey can reach finishing without passing unrelated storytelling.
- Product identity/price precedes optional customization on mobile.
- Long Indonesian and English names do not break steppers, cards, or buttons.
- Sticky elements do not cover controls, focused content, or final actions.

## Phase 3 — Visual hierarchy and accessibility polish

### Tasks

- [ ] **P3.1** Preserve the botanical palette/type direction. Use one consistent primary CTA treatment; let language controls and secondary actions remain visually subordinate.
- [ ] **P3.2** Reduce stacked introductory labels such as collection/title/category/title. Keep botanical numbering as restrained decoration rather than another reading layer.
- [ ] **P3.3** Prioritize product name, price, unit/quantity, and action. Keep Latin names secondary. Reduce dependence on 10–11px widely tracked uppercase labels for practical information.
- [ ] **P3.4** Resolve the reported desktop order-column imbalance through content regrouping, not filler text or arbitrary empty height. Add a useful packaging photo only if a truthful asset exists.
- [ ] **P3.5** Align craftsmanship step titles/body starts on desktop with content-aware grid layout. Keep natural height on mobile.
- [ ] **P3.6** Constrain desktop FAQ width to a comfortable reading measure, approximately 760px as a starting point. Keep question and disclosure icon visually connected.
- [ ] **P3.7** Align category labels, titles, and notes deliberately; stack where a shared baseline becomes awkward.
- [ ] **P3.8** Increase the reported undersized add-to-bouquet, reset, and mobile-order targets to a project target of at least 44 × 44 CSS px, with suitable spacing.
- [ ] **P3.9** Strengthen necessary interactive boundaries and selected states. Use a checkmark/fill plus programmatic state, not a faint border alone. Evaluate actual component contrast; decorative card borders do not all require the same treatment.
- [ ] **P3.10** Preserve focus when counters, package cards, wrapping, and language update. Avoid destroying the focused control during rerendering. Verify radio keyboard behavior and associated group labels.
- [ ] **P3.11** Let product-image interaction inspect/enlarge the product rather than silently select and jump to ordering. If using a dialog, support accessible naming, close control, Escape, and focus return.
- [ ] **P3.12** Preserve reduced motion, meaningful alt text, skip link, visible focus, and no horizontal overflow. Verify text scaling and meaningful visual/reading order after mobile reordering.

### Acceptance criteria

- Both languages remain legible with the intended fonts and reasonable fallbacks.
- Keyboard users can repeatedly change quantities and finish a selection without losing their place.
- Selection remains identifiable without color alone.
- Text and necessary control contrast are checked on actual rendered states; do not assume a palette-level check covers every state.
- No unnecessary animations or framework dependencies are added.

## Phase 4 — Product evidence, copy, and trust

### Tasks

- [ ] **P4.1** Show a single stem in the primary per-stem photograph, or clearly state that the listed price buys one stem when the image contains several. Audit Gerbera especially.
- [ ] **P4.2** Add verified package compositions/palettes, approximate dimensions, included items, and substitution rules. Use human-held photos for scale when authentic assets are available.
- [ ] **P4.3** Add actual wrapping examples, shipping packaging, and close-up assembly imagery. Replace/support four text-only process steps with meaningful photos or a short accessible video.
- [ ] **P4.4** Inspect reportedly unused `us-*` and `kit-*` assets for relevance and provenance. Do not present a generated couple as the real founders or a kit flat-lay as the contents of a finished-flower order. Use verified assets or leave a clearly documented asset request.
- [ ] **P4.5** Align imagery with active flower availability, including Lavender shown in bouquets. Explain decorative/example substitutions where appropriate.
- [ ] **P4.6** Replace calculation-heavy wording with customer-oriented language: `Rancang buket pilihan Anda`; explain that customers choose flowers and the studio assembles them. Replace `grosir` with a plain quantity-savings explanation where appropriate.
- [ ] **P4.7** Write one coherent WhatsApp handoff note. Keep technical details out of customer copy unless useful to their decision.
- [ ] **P4.8** Specify verified shipping origin, production time versus delivery time, shipping-cost handling, and support for damaged/incorrect orders. Distinguish routine petal reshaping from genuine damage support.
- [ ] **P4.9** Verify or remove unsupported popularity, safety, durability, and construction claims, including `Paling sering dipesan` and `tidak ada yang dilem kaku`. Do not invent reviews or founders' stories.
- [ ] **P4.10** Keep DIY interest capture small and clearly future-facing. Do not promise a launch date or imply a live kit SKU without confirmation.
- [ ] **P4.11** Update README catalogue, availability, prices, and editing instructions to match the current product model.

### Acceptance criteria

- A buyer can tell exactly what the price buys, the approximate size, what arrives, and the next step.
- Photographs support the actual offer and do not imply unverified product/founder facts.
- Order, trust, FAQ, and README content agree in both languages.
- Missing real-world assets/details remain explicitly recorded rather than replaced with invented evidence.

## Phase 5 — Language, metadata, assets, and staging

### Tasks

- [ ] **P5.1** Preserve a user's explicit saved language. Consider browser-language detection only for first visits without a preference, with Indonesian fallback; do not force language from location.
- [ ] **P5.2** Check document language, accessible labels, page title, and descriptive metadata when switching language. Localize visible/assistive text consistently.
- [ ] **P5.3** If English search discovery and English share previews are business goals, implement stable language URLs with crawlable localized content, appropriate canonical/hreflang, and metadata per URL. Treat this as a scoped enhancement, not an automatic rewrite.
- [ ] **P5.4** Do not assume client-side metadata updates change social crawler previews. Verify the served content for each share URL and test actual preview behavior.
- [ ] **P5.5** Keep Product/Offer metadata consistent with real catalogue, prices, availability, URLs, and made-to-order status. Do not promise search rich results. Check current official search-engine eligibility before adding FAQ schema solely for visibility.
- [ ] **P5.6** Inspect actual deployment outputs for original PNGs, duplicates with spaces, and historical revisions. Exclude unnecessary masters/revisions from public deployment where practical while preserving originals in the appropriate source/archive location.
- [ ] **P5.7** Distinguish publicly accessible unused files from files actually downloaded by the page. Do not claim removing unrequested masters improves initial page load. Verify asset sizes instead of repeating historical totals.
- [ ] **P5.8** Treat the client-side passcode gate as a preview curtain, not secure access control. Do not reproduce its passcode in documentation. If real confidentiality is needed, propose hosting-level protection appropriate to the actual deployment.
- [ ] **P5.9** Prepare a release checklist for disabling staging UI and removing the footer lock control, enabling intended indexing, and aligning robots directives, sitemap, canonicals, and production URLs. Execute only when launch is authorized.

### Acceptance criteria

- Language behavior preserves user choice; localized URLs, if implemented, work on direct navigation and sharing.
- No unsupported claim of guaranteed FAQ rich results or automatic English indexing is made.
- Staging remains intentionally staged until release; indexing and access are treated as separate concerns.
- Public deployment cleanup preserves originals and does not break image paths.

## Phase 6 — Integrated verification and release handoff

### Required checks

- [ ] Verify representative layouts at 320, 390, 820, 1024, and 1440 px; include 390 × 844 for the mobile hero. Check ID and EN, open menu, long text, and loaded fonts.
- [ ] Complete the stem, package, and custom flows with keyboard and pointer/touch-sized controls.
- [ ] Check custom counts at 0/2/3 and 8/9 stems, mixed prices, reset, mode switching, wrapping, gift notes, and language switching.
- [ ] Verify package selection, summary, sticky bar, and draft all agree. Confirm invalid drafts cannot continue.
- [ ] Check scrolling/focus, menu close paths, quantity focus retention, reduced motion, zoom/text scaling, selected states, and FAQ operation.
- [ ] Inspect actual generated destination URLs without sending messages. Confirm unavailable marketplace channels and placeholder contacts are handled honestly.
- [ ] Verify console/network errors, responsive images, no broken assets, no overflow, and no regressions in image loading/layout stability. Record measured performance only if actually measured.
- [ ] Review relevant metadata and deployment changes. Do not remove staging or publish solely to run checks.

### Required handoff

Provide:

1. Completed task IDs and a concise explanation of changed behavior.
2. Screenshots of desktop/mobile key states and any remaining font/rendering limitations.
3. Focused test results, with exact scenarios and failures/blockers.
4. Business inputs or real assets still required.
5. Deployment/launch actions still pending authorization.
6. Any intentionally deferred optional work, especially localized SEO URLs.

## Corrections applied while merging the audits

| Original concern | Merged implementation decision |
| --- | --- |
| Package prices must match custom arithmetic | Compare defined equivalent compositions; explain fixed-package/custom differences before changing commercial prices. |
| Wrapping cannot be included and itemized | It can be itemized inside an inclusive total; make this explicit and avoid double charging. |
| Reuse studio and kit images as trust evidence | Verify authenticity and relevance first; generated concepts cannot document real founders or actual shipped contents. |
| Missing FAQ schema is an easy rich-result win | Do not promise eligibility or prioritize it over ordering fixes; verify current official guidance. |
| Client-side English has zero SEO value / metadata switching fixes sharing | Avoid absolute claims; use stable localized URLs and served metadata if search/share localization is required. |
| All light borders need accessibility-level contrast | Assess required component boundaries/states separately from decorative dividers. |
| Nested blur is definitely the menu cause | Reproduce the visual defect; nested blur is a hypothesis, not a confirmed root cause. |
| Unused large files make initial loading slow | Audit deployed exposure separately from actual page requests and transfer size. |

## Copy-paste kickoff prompt

> Work on `AsuraOR/komorebi-creations` using this implementation plan. Read repository instructions, inspect the current branch, and complete Phase 0 first. Then implement the applicable phases in order, keeping changes reviewable and preserving the existing botanical identity and lightweight architecture. Continue work that does not depend on missing business inputs; maintain a clear blocker list instead of inventing prices, contact details, policies, testimonials, or product facts. Validate ordering behavior and rendered layouts using the acceptance criteria. Do not send messages or real orders, delete original assets, change production access/indexing, or deploy unless separately authorized. Report completed task IDs, verification evidence, unresolved decisions, and the next step.
