# Komorebi Creations — Phased Website Implementation Plan

Date: 2026-09-07  
Repository: https://github.com/AsuraOR/komorebi-creations  
Website: https://komorebicreations.com  
Status: Implementation brief only. No website changes have been made as part of preparing this document.

## Objective

Merge the supplied `UIUXAUDIT.md` and the earlier ChatGPT audit into one actionable plan. Preserve the premium botanical identity while improving purchase clarity, mobile usability, accessibility, loading performance, and launch readiness.

The intended experience is simple: understand the product, compare flowers, see what is included, choose a format, and reach the correct buying channel without losing that choice.

## Instructions for the implementing AI agent

1. Read this document and applicable repository instructions before editing. Inspect the current branch and files; the audits describe a snapshot, not necessarily the latest revision.
2. Implement phases in order. Use one reviewable change set per phase and report its acceptance results. Continue independent work when a missing business input blocks one item.
3. Preserve the existing HTML/CSS/JavaScript approach unless a concrete requirement cannot be met with it. Do not introduce a framework, CMS, cart, accounts, payment integration, or large dependency solely for this plan.
4. Preserve the cream/linen palette, earthy accents, botanical plate framing, Cormorant Garamond headings, Karla body copy, and restrained mono decorative labels. Improve hierarchy without redesigning the brand.
5. Keep Indonesian as the default and maintain equivalent English content. Changes must work in both languages.
6. Do not invent contact details, stock, prices, delivery promises, product quantities, reviews, founder stories, tutorial availability, or marketplace destinations. Existing values are provisional until confirmed.
7. Keep commercial settings and product facts in one coherent content source. UI, summaries, messages, and metadata must agree.
8. Follow existing authorization for branches, commits, PRs, and deployment. This brief describes implementation scope; it does not itself authorize public deployment, purchases, messages, or changes to account/access settings.
9. Do not enter discovered passcodes, disable access controls to obtain a preview, or publish private material. Use an authorized preview/access route.
10. Report what changed, why, what was verified, and remaining blockers. Never mark an unverified item complete.

## Evidence and decisions reconciled from both audits

- The earlier ChatGPT audit inspected source, live DOM, and selected images; it did not complete unlocked desktop/mobile interaction tests. The supplied audit reports rendered measurements and interaction testing. Treat those measurements as reported historical observations and reproduce them where relevant.
- Both audits confirm generic marketplace links, a passcode overlay, large image assets, and weak mobile treatment in the reviewed version.
- The supplied audit reports roughly 15 MB of initial transfer and 19 MB for the complete page. Source image sizes independently support a large asset burden, but file size is not the same as transferred bytes or first-paint time. Do not repeat the claimed 30–60 second first paint or sales impact without measurements.
- The passcode is exposed in client-side content. Do not repeat its value. This does not prove Google cannot index the underlying content; verify indexing separately. The confirmed concerns are customer obstruction and lack of genuine access protection.
- Absence of custom focus styling does not prove absence of browser-default focus indicators. Test visibility, then implement a consistent focus treatment.
- Flower and format clicks rebuild the order controls; language changes rebuild multiple dynamic sections. Do not describe every click as rebuilding the entire page.
- A 44 × 44 CSS px target is this project's touch design goal. Do not treat every smaller target as an automatic accessibility conformance failure without checking the applicable criterion and exceptions.
- A static FAQ is not inherently inaccessible. An accordion is a mobile density improvement and must retain accessible interaction.
- Do not wrap a card containing several links/buttons in another link. Link the product image and title to a meaningful action while preserving separate format controls.
- Structured data does not guarantee rich search results. Verify current search-engine eligibility before adding optional schema; do not promise FAQ rich results or fabricate offers/reviews.
- Preserve the core colors that already have reported good contrast. Check interactive states separately, especially flower-colored button hovers.

## Phase overview

| Phase | Outcome | Dependency |
| --- | --- | --- |
| 0 | Establish baseline and identify missing business inputs | None |
| 1 | Make product data and purchase handoff truthful and functional | Phase 0; real destinations needed to activate channels |
| 2 | Reduce image weight and stabilize loading | Phase 0; may proceed while Phase 1 inputs are pending |
| 3 | Repair mobile navigation, layout, and accessible interaction | Phase 1 selection model; Phase 2 image variants |
| 4 | Refine page structure, product presentation, and copy | Phases 1–3; final photography may remain pending |
| 5 | Complete metadata, documentation, and public-launch preparation | Confirmed product facts and launch mode |
| 6 | Verify the integrated experience and prepare release evidence | All implemented phases |

## Phase 0 — Baseline and business inputs

### 0.1 Inspect and record

- [ ] Record the branch and commit being reviewed; read repository instructions and deployment configuration.
- [ ] Inspect `index.html`, `styles.css`, `app.js`, `site-content.js`, image assets, README, and editor files.
- [ ] Capture an authorized baseline at 1440×900, 820×1180, 390×844, and 360×740, plus a 320 px width check. Test ID and EN.
- [ ] Record header height, anchor landing positions, horizontal overflow, hero image position, page height, key asset sizes, and initial/full-scroll transfer.
- [ ] Record current keyboard behavior and console errors without submitting orders or sending messages.

### 0.2 Business inputs register

| Input | Needed for | Behavior while missing |
| --- | --- | --- |
| Launch mode: prelaunch or open for orders | Entry page, CTAs, indexing | Preserve current deployment/access; prepare mode handling in the working branch |
| Verified business WhatsApp number and Instagram URL | Contact and social links | Do not expose example values as active destinations |
| Product URLs per flower × format × channel | Buying handoff | Mark channel unavailable for that selection; no homepage fallback |
| Confirmed price, quantity, dimensions, lead time, availability for each option | Cards, summary, messages, schema | Keep provisional values clearly flagged in implementation notes; do not activate sales on unknown facts |
| Bouquet sizes, exact stem counts, mixed-flower/custom rules | Bouquet selection and pricing | Treat unresolved custom bouquets as inquiries through a verified channel |
| Dispatch city, replacement conditions, care guidance | Trust strip and FAQ | Do not invent specifics or broader guarantees |
| Confirmed included tools, spare parts, instructions, and video | Kit contents and benefits | Remove unsupported promises from release content |
| Genuine product, package, assembly, and founder photographs | Product proof and story | Retain drafts only in authorized preview; track missing launch assets |
| Canonical brand wording and truthful founder story | Header, footer, metadata, About | Retain current approved identity pending confirmation |

Ask for unresolved facts in one concise batch when they are needed. Do not stop all implementation waiting for photography or marketplace setup.

**Acceptance:** A reproducible baseline and an explicit confirmed/provisional/missing input register exist. No repository or website claim is assumed current solely because an audit said so.

## Phase 1 — Product model and purchase handoff

Likely files: `site-content.js`, `app.js`, `index.html`.

### 1.1 Define consistent product options

- [ ] Give flowers a stable identifier that does not collide with the Indonesian `id` translation key; migrate all consumers together.
- [ ] Represent each supported flower/format option with explicit quantity, unit, price/currency, dimensions, availability, included items, relevant lead time, image, and channel destinations.
- [ ] Store numeric prices separately from display formatting; preserve existing presentation unless improving consistency.
- [ ] Distinguish unavailable/coming soon/sold out/available using confirmed data. Do not infer stock.
- [ ] State whether assembled stems are sold singly or in sets, especially lavender.
- [ ] Replace the fixed-price “5–11 stems” ambiguity with confirmed bouquet sizes and prices, or an honest custom-inquiry path.
- [ ] Make the single-flower selector and mixed-bouquet description consistent.
- [ ] Use “±20 minutes per flower” consistently where confirmed; do not imply a three-flower kit takes 20 minutes in total. Do not generalize one flower's timing to every kit without evidence.

### 1.2 Preserve selection at handoff

- [ ] Resolve marketplace destinations from the selected flower and format. Use documented, verified variant links when supported.
- [ ] If a marketplace cannot preselect a variant, open the exact listing and clearly tell the customer which variant to choose. Do not claim the selection transferred automatically.
- [ ] Use “Pilih tempat membeli” / “Choose where to buy” rather than promising checkout when opening a listing.
- [ ] Keep WhatsApp's prepared message synchronized with the selected option, price, and language. Opening a draft must not automatically send it.
- [ ] Hide or explain missing channels; never substitute a marketplace homepage, `#`, or example phone number.
- [ ] Apply availability rules consistently in the summary, footer, cards, and any later sticky bar.
- [ ] Preserve the chosen flower and format when changing language; define an explicit fallback if an option becomes unavailable.

### 1.3 Repair selection rendering as part of the flow

- [ ] Update affected controls and summary without unnecessarily recreating focused elements.
- [ ] Quick actions from collection cards select the correct flower and format once, then navigate to the order area.
- [ ] Avoid duplicate renders from separately applying flower and format changes.

**Acceptance:** Every configured option reaches its matching listing or verified inquiry draft. All missing/unsupported options have honest unavailable behavior. Quantity, price, language, and selected format agree throughout. No test sends a message or places an order.

## Phase 2 — Image delivery and loading stability

Likely files: image assets, `index.html`, `site-content.js`, `app.js`, `styles.css`.

- [ ] Generate appropriately sized WebP/AVIF derivatives with suitable fallback support and responsive source selection. Choose sizes from actual rendered widths and pixel density rather than one arbitrary maximum.
- [ ] Provide approximately 2–3 useful widths for large content images; use correct `sizes` values and verify which source loads on phones.
- [ ] Export a small logo suited to its 32–48 px display sizes, including a high-density version. Do not trace the detailed logo into a different design merely to use SVG.
- [ ] Preserve chenille texture, fine logo lines, and natural color while compressing. Keep source masters available without making visitors download them.
- [ ] Reserve image space through intrinsic dimensions or a stable aspect ratio. Preserve the hero's eager/high-priority loading and appropriate lazy loading below the fold.
- [ ] Avoid fetching multiple formats/sizes of the same image unnecessarily. Check image-source reassignment during initial rendering and language changes.
- [ ] Check font payload and loading behavior; remove genuinely unused weights only after inspection.
- [ ] Measure cold-cache initial transfer and full-scroll transfer under a documented viewport/network profile.

**Targets:** Aim for at most 600 KB initial viewport transfer, including critical assets, and about 1–1.5 MB for the complete image set where quality allows. These are engineering budgets, not measured results or reasons to degrade product detail. Report actual totals and justified exceptions.

**Acceptance:** Mobile loads appropriately sized images; no avoidable image layout shifts or duplicate downloads; original heavy files are no longer referenced by the public page. Before/after measurements use equivalent conditions.

## Phase 3 — Mobile layout and accessible interaction

Likely files: `index.html`, `styles.css`, `app.js`.

### 3.1 Header, navigation, and anchors

- [ ] Replace wrapping phone navigation with logo + Pesan + menu control. Target roughly 64–72 px at default text size; allow growth with enlarged text.
- [ ] Choose the collapse breakpoint from actual content fit, including English and the 820 px tablet layout; do not blindly stop at 768 px.
- [ ] Implement a named menu button with expanded state and controlled region. Support keyboard opening, Escape closing, and sensible focus return.
- [ ] If implemented as a modal sheet, manage focus and background inertness. Prefer a simpler disclosure menu if it meets the design need.
- [ ] Make all anchor targets clear the actual sticky header, including `#howto` and `#faq`. Apply the same offset to quick-order navigation.
- [ ] Make brand navigation return to the top reliably.

### 3.2 Small-screen sizing and product visibility

- [ ] Remove grid minimum widths that exceed available space after padding. Fix overflow at its source instead of hiding it with clipping.
- [ ] On mobile, place the product image before the extended hero description and benefit blocks. Keep enough brand/product context visible to orient the visitor.
- [ ] Use a restrained crop/aspect ratio that retains meaningful product detail. Do not crop away the flower head or make the actual product unclear.
- [ ] Prevent orphan layouts in benefits and controls: use a deliberate one-column mobile benefit arrangement and intentional chip rows/grid.
- [ ] Stack format name above explanatory text; show the price clearly without label/note collisions. Keep WhatsApp action text from awkward wrapping.

### 3.3 Sticky ordering affordance

- [ ] Add a slim mobile order bar after the hero leaves view, showing the active option/price when confirmed and a clear Pesan action.
- [ ] Reuse the same selection state and availability rules as the main order section. Use a launch-oriented label in prelaunch mode.
- [ ] Hide or reduce the bar when the main ordering controls are visible. Reserve bottom space and respect device safe areas so it does not cover content or focused controls.
- [ ] Do not add another floating back-to-top button unless testing identifies a need after the sticky header and order bar are present.

### 3.4 Accessibility requirements

- [ ] Use visible, consistent keyboard focus indicators on all interactive elements.
- [ ] Aim for 44 × 44 CSS px touch targets for nav links, language buttons, quick links, and menu controls, with adequate spacing.
- [ ] Expose selected language with appropriate pressed state; expose exclusive flower/format choices using suitable radio-group semantics or an equivalent accessible pattern.
- [ ] Preserve focus when selections update. Announce concise summary/price changes politely without rereading the whole section.
- [ ] Update document language when switching ID/EN. Translate meaningful alt text and accessible names; use empty alt text for purely decorative images.
- [ ] Respect reduced-motion preferences in both CSS and JavaScript scrolling/animation. Avoid forced smooth motion.
- [ ] Provide a main-content landmark and skip link. Check heading order and duplicate/unhelpful accessible names.
- [ ] Check normal, hover, active, focus, and disabled-state contrast. Replace low-contrast flower-color button fills with a consistent dark/green action treatment while retaining flower accents elsewhere.
- [ ] Make the FAQ an accessible disclosure/accordion where it reduces mobile density; retain readable content and clear expanded state. Plain expanded answers remain acceptable on desktop.
- [ ] If a preview lock remains temporarily, label its input, make errors readable/announced, manage focus, and make background content inert. Do not mistake these accessibility changes for real security.

**Acceptance:** ID and EN work at all baseline widths without clipped content; every anchor heading remains visible; users can complete product selection with keyboard alone. Menu, FAQ, sticky bar, 200% zoom, enlarged text, and reduced-motion behavior are checked. No new overlay blocks the purchase flow.

## Phase 4 — Layout, product proof, and content refinement

Likely files: `index.html`, `styles.css`, `site-content.js`, `app.js`, image assets.

### 4.1 Use a clearer page sequence

1. Hero: product, emotional headline, main action.
2. Compact reassurance strip: confirmed dispatch origin, preparation time, support.
3. Collection: compare flowers, kit yields, and prices.
4. Inside the kit: exact contents, packaging, and compact specifications.
5. Assembly demonstration: four visual steps and an optional real tutorial preview.
6. Order selection: option image, format, exact contents, price, buying channel.
7. Founder story: truthful people and process.
8. FAQ, final purchase action, and footer.

- [ ] Fold repetitive materials/care copy into the kit explanation and FAQ. Retain the macro photo as supporting texture proof rather than requiring a long separate section before ordering.
- [ ] Keep a restrained dark section for visual rhythm; avoid making both instructional and FAQ sections unnecessarily tall on phones.

### 4.2 Balance desktop sections deliberately

- [ ] Move kit specifications below both kit columns to reduce the large empty area under the photo. Avoid stretching/cropping a photo just to match text height.
- [ ] Separate compact specification values from safety/adult-supervision notes; render longer guidance as readable body text below the stats.
- [ ] Align benefit descriptions with a layout that tolerates translated wrapping; avoid fixed heights that clip at zoom.
- [ ] Use an intentional 2×2 flower selector when four chips cannot comfortably fit one row.
- [ ] Reduce order-section imbalance using a compact selection panel with a relevant product image and a proportionate summary. Add desktop stickiness only if scrolling tests show it helps and nothing is obscured.
- [ ] Use whitespace to group related content; do not force all sections into identical heights or create filler to occupy empty space.

### 4.3 Improve cards and selection feedback

- [ ] Make product image and title activate a meaningful product-selection action. Keep Kit/Stem/Bouquet controls separate; no nested links or buttons.
- [ ] Show format prices in a compact, readable comparison, or reveal them through accessible format selection. Avoid implying one “from” price buys a different quantity than the pictured product.
- [ ] Give each option an appropriate image: kit, finished stem, or bouquet. Update image, exact quantity, and price together in the order summary.
- [ ] Add truthful availability labels and prevent unavailable buying actions.
- [ ] Use a subtle border/image treatment for hover/focus; any image zoom is optional, restrained, and reduced-motion aware.
- [ ] Keep decorative labels small, but raise product facts toward 14 px, prices toward 16–18 px, and secondary actions to comfortable reading/tapping sizes.

### 4.4 Required product asset brief

| Asset | What it must prove |
| --- | --- |
| Hero flower | Actual product appearance and chenille texture |
| Complete kit flat lay | Exactly what one purchased kit contains, including quantities |
| Closed/open rectangular box | Real packaging, organization, and gift presentation |
| Flower in hand or beside a scale reference | Honest finished size |
| Assembled stem and bouquet | Format differences, confirmed stem count, wrapping/fullness |
| Four assembly photos | Prepared parts → shaping → attachment → finished display |
| Short assembly clip, if available | A realistic beginner process, with playback controls and useful captions |
| Founder/process photograph | The actual makers or their hands and workspace |

- [ ] Do not present generated people as the founders or generated product details as proof of delivered contents.
- [ ] Keep the warm neutral art direction, but replace temporary sales imagery with faithful product photography before enabling orders.
- [ ] Match the kit image to the confirmed yield; the reviewed image does not clearly establish a complete three-flower kit.
- [ ] Do not claim a QR tutorial, spare components, or completed packaging exists unless it does.

### 4.5 Copy direction

- [ ] Retain the poetic headline, but use concrete shopping language below it.
- [ ] Explain the material once in familiar Indonesian, such as “kawat bulu chenille,” after confirming preferred terminology.
- [ ] Replace “mahkota berbiji rapat” with a description that accurately reflects the handmade center; do not suggest real seeds are included.
- [ ] Replace “bunga paling menuntut kesabaran” with useful assembly difficulty/time information.
- [ ] Replace the materials heading with a direct benefit about softness and shaping.
- [ ] Use an Instagram making-process CTA unless actual workshops are offered.
- [ ] Differentiate flowers with useful comparisons: signature design, difficulty, yield, dimensions, and suitability for a vase or gift.
- [ ] Use consistent brand wording across header, footer, story, and metadata after confirmation.

**Acceptance:** The page communicates product, kit yield, effort, format differences, and buying destination without ambiguity. Major empty quadrants, accidental wrapping, tiny commercial labels, and duplicate explanatory sections are resolved. Missing real assets remain explicit release blockers, not falsely completed tasks.

## Phase 5 — Launch mode, discovery, and maintenance

Likely files: `index.html`, `app.js`, `site-content.js`, README, metadata/static assets, deployment configuration only when authorized.

### 5.1 Prepare the appropriate entry experience

- [x] For a public prelaunch site, prepare an honest coming-soon page with a confirmed launch window and verified contact/social CTA. Do not add a signup form without a working, authorized destination.
- [x] For an open store, remove the customer-facing passcode overlay and “Lock Site” control as part of the authorized release.
- [x] For genuinely private staging, identify a hosting-supported authentication approach. Apply access/deployment changes only under the owner's authorization; do not introduce a new provider solely for this task.
- [x] Remove client-side passcode dependence from the intended public architecture. Never treat robots directives or a hidden overlay as authentication.

### 5.2 Search and social presentation

- [x] Add an accurate page title and meta description reflecting the brand and relevant Indonesian product terms without keyword stuffing.
- [x] Add canonical URL, favicon, Open Graph, and Twitter/social-card metadata with a suitable optimized preview image and absolute public URLs.
- [x] Verify preview image accessibility and cropping. Metadata enables previews but does not guarantee every platform immediately refreshes its cached card.
- [x] Add appropriate sitemap and robots handling for the actual public deployment; keep staging and public indexing policies distinct.
- [x] Ensure meaningful product and descriptive content remains available without waiting for client-side JavaScript where practical in the existing stack.
- [x] Consider Organization/WebSite and Product/Offer structured data only where the visible page and confirmed catalog support it. Prices, currency, availability, and URLs must match the page.
- [x] Verify current search-engine guidance before implementing schema. FAQ markup is optional and must not be sold as a guaranteed rich-result improvement. Do not add fabricated ratings or reviews.

### 5.3 Remove misleading maintenance behavior

- [x] Inspect editor dependencies before cleanup. Remove/update README and content-file instructions for the nonexistent “Mode Edit” button.
- [x] Default to documenting the actual content-file workflow, not reintroducing a public editor. Remove unused editor files only after confirming they have no supported use; preserve history through normal version control.
- [x] Remove unexplained deletion of `komorebi_custom_data` after determining whether any supported saved edits need migration. Do not silently discard user-authored data.
- [x] Document the new product-option fields, unavailable-channel behavior, image export workflow, launch mode, and accurate maintenance process.
- [x] Confirm the Phase 1 identifier migration and rendering changes have no stale consumers or misleading comments.

**Acceptance:** Metadata matches visible facts; the chosen entry experience is honest; no public secret-based overlay is presented as secure protection. Documentation describes features that actually exist. Deployment/access changes are prepared or completed only within authorization.

## Phase 6 — Integrated verification and release handoff

Use focused checks that address the risks in this plan. Avoid a large test suite that merely repeats markup or implementation details.

### Verification matrix

| Area | Required checks |
| --- | --- |
| Responsive layout | 1440×900, 820×1180, 390×844, 360×740, and 320 px width; both languages |
| Navigation | Every header/quick-order anchor lands below sticky header; menu opens/closes and restores focus |
| Product options | All 4 flowers × 3 formats where supported; correct quantity, price, image, availability, and destination |
| Missing data | Missing channel, unknown price, unavailable option, and custom bouquet behave honestly |
| State | Language change retains selection; cards and sticky bar agree with summary; keyboard focus survives updates |
| External handoff | Exact listing or accurate variant guidance; WhatsApp draft contains correct data; no send/purchase |
| Accessibility | Keyboard-only path, focus, selected states, reduced motion, zoom/text enlargement, alt language, contrast |
| Content | Real packaging/photography, supported kit claims, per-flower timing, confirmed dispatch/support details |
| Performance | Comparable cold-cache initial/full-scroll transfer, responsive image choices, layout stability, console errors |
| Search/social | Canonical, metadata, reachable preview image, public/staging indexing, valid truthful schema if included |
| Resilience | Missing image handling, JavaScript unavailable/error behavior, unavailable external channel |

- [ ] Repeat only checks affected by subsequent fixes, unless a broader regression remains plausible.
- [ ] Record browser, viewport, throttling, cache state, and commit for performance evidence. Distinguish lab measurements from real-user results.
- [ ] If an accessibility or schema checker is used, review its findings manually; do not equate a clean automated report with complete conformance.
- [ ] Compare before/after screenshots for representative desktop and phone views in both languages.
- [ ] List remaining owner inputs and release blockers explicitly. Never launch a seemingly active shop with sample commercial data.

### Release readiness

**Prelaunch release:** truthful coming-soon state, verified contact destinations, accessible mobile layout, appropriate indexing, optimized assets; unavailable sales actions remain unavailable.

**Sales release:** exact confirmed products and quantities, genuine imagery, working per-option buying routes, verified support/contact details, no customer passcode wall, and completed critical verification above.

### Required agent handoff format

```markdown
## Phase [number] — [name]

Status: Complete / Partially complete / Blocked

### Implemented
- [Task ID] What changed and why.

### Verification
- Check, conditions, and result.

### Remaining inputs or blockers
- Exact missing input and affected behavior, or None.

### Review artifacts
- Branch/commit or PR, changed files, and representative screenshots where available.

### Next phase
- Next concrete work item.
```

## Coverage map for the supplied audit

| Supplied audit item | Merged location |
| --- | --- |
| 1–2: Placeholder links and lost selection | Phase 0 inputs; Phase 1 handoff |
| 3: Asset weight | Phase 2 |
| 4: Passcode gate | Phase 3 temporary accessibility; Phase 5 entry/access; evidence corrections |
| 5–6: Header and anchors | Phase 3.1 |
| 7–8: Hidden hero image and long mobile journey | Phase 3.2–3.3; Phase 4.1 |
| 9: Tap targets | Phase 3.4 |
| 10–15: Kit/benefit/order spacing, chips, specs, format layout | Phase 3.2; Phase 4.2 |
| 16: Product card interactions, prices, availability | Phase 1 data; Phase 4.3 |
| 17–24: Focus, language, alt text, motion, FAQ, lock accessibility | Phase 3.4 |
| SEO section: title, metadata, canonical, robots, sitemap, schema | Phase 5.2 |
| 25: Dead editor and misleading documentation | Phase 5.3 |
| 26: Duplicate identifier key | Phase 1.1 |
| 27: Rebuilding controls | Phase 1.3; Phase 3.4 |
| 28: Deleting saved custom data | Phase 5.3 |

Additional earlier-audit recommendations are incorporated in product truth/quantities (Phase 1), overflow (Phase 3), typography and real imagery (Phase 4), visual assembly demonstration and page order (Phase 4), founder authenticity and clearer copy (Phase 4), and support/brand consistency (Phases 0, 4, 5).

## Starter prompt for your AI agent

> Read `Komorebi-Implementation-Plan.md` and the repository instructions. Implement the plan in dependency order, starting with Phase 0 and continuing through every unblocked phase. Preserve the botanical identity and existing stack. Recheck current code before relying on audit findings. Do not invent business facts or activate placeholder purchase links. Keep changes reviewable by phase, satisfy the listed acceptance criteria, and report evidence using the handoff format. When owner input is missing, record the affected task and continue independent work. Follow the authorization in our session for commits, PRs, access changes, and deployment; this document alone does not authorize public release.
