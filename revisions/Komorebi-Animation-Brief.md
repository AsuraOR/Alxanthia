# Komorebi Creations — Animation Implementation Brief

Date: 2026-09-07  
Repository: https://github.com/AsuraOR/komorebi-creations  
Companion document: `Komorebi-Implementation-Plan.md`  
Scope: Instructions for a future implementing AI agent. Preparing this brief does not change website code.

## Goal

Add gentle, purposeful motion that suits a botanical book: soft reveals, small shifts, and clear product-selection feedback. Preserve the cream palette, botanical imagery, typography, and calm premium character. The product and purchase flow should remain the focus.

## Instructions for the AI agent

- Read repository instructions and inspect the current implementation before editing. Existing selectors and components may have changed since the audits.
- Treat this as a motion supplement to the main implementation plan. Fix selection behavior, mobile navigation, image delivery, and accessibility before decorating those components.
- Use the existing HTML/CSS/JavaScript stack. Prefer CSS transitions and minimal JavaScript; do not add an animation framework for these effects.
- Preserve content, pricing, links, selection state, layouts, and brand assets. Do not create business facts or new shopping features.
- Animate components that exist. If the mobile menu, FAQ disclosure, sticky order bar, or product preview is not implemented yet, record the dependency and continue with other tasks. Do not build a new component solely to animate it.
- Implement in the phases below. Keep changes small and reviewable; verify each phase before adding the next.
- Follow the owner's current authorization for commits, PRs, and deployment. This document alone does not authorize publishing or access-control changes.

## Motion system

Centralize duration, distance, and easing values so the site feels consistent.

| Category | Default | Allowed tuning | Easing |
| --- | --- | --- | --- |
| Button/selection feedback | 180 ms | 150–200 ms | ease-out |
| Product preview crossfade | 200 ms | 150–250 ms | ease-in-out |
| FAQ/menu/order-bar transition | 220 ms | 180–250 ms | ease-out |
| Section reveal | 450 ms | 400–500 ms | ease-out |
| Hero copy reveal | 500 ms | 450–600 ms | ease-out |
| Product image hover | 300 ms | 250–350 ms | ease-out |

Use explicit transition properties rather than `transition: all`. Favor opacity and transform for decorative movement. A short content-expansion animation is acceptable for the FAQ, but do not animate page-wide layout or impose arbitrary maximum heights that clip answers.

### Rules that apply everywhere

- Content is visible and usable by default. JavaScript, observer, or animation failures must not leave text/images invisible.
- Never delay navigation, state updates, price changes, or purchase actions until an animation finishes.
- Do not hide the hero image behind a reveal, loading overlay, or artificial delay. Preserve eager/high-priority hero loading and its reserved dimensions.
- Do not animate every paragraph, letter, icon, or list item. Animate a small number of meaningful groups.
- Entrance animations run at most once per element per page load. Scrolling back, changing language, or selecting a product must not replay them. No storage or cookie is needed for this behavior.
- Reveal content immediately when it receives focus or is reached through an anchor. Never leave a focused interactive control invisible.
- Keep final styles independent of animation completion events.
- Handle rapid repeated interactions by replacing or reversing the in-progress transition. Do not queue effects.
- Avoid permanent `will-change` on many elements, continuous animation loops, scroll polling, or new large media downloads.

## Phase A — Button and selection feedback

### A1. Buttons and purchase links

- [ ] Transition background, border, and text color over 180 ms.
- [ ] Keep a consistent dark/green action treatment and preserve readable contrast in every state.
- [ ] On enabled button press, optionally scale the surface to 0.98×; return on release/cancel. Do not move surrounding content or shrink the actual hit target.
- [ ] Preserve a strong keyboard focus outline. Focus must not depend on movement or hover.
- [ ] Keep disabled/unavailable controls visually distinct and non-actionable without a misleading press effect.

### A2. Flower and format selection

- [ ] Update selected background/border over 180 ms.
- [ ] Display a small checkmark in reserved space, optionally fading it in over 150 ms. Do not shift labels when it appears.
- [ ] Update selected semantics and product state immediately, using the accessible selection pattern already established in the main plan.
- [ ] Keep focus on the activated control. Avoid recreating the control to trigger an effect.
- [ ] Do not animate price digits, count prices upward, or delay quantity/availability updates.

**Acceptance:** Mouse, touch, and keyboard users get immediate feedback. Rapid selection changes leave exactly one correct active option. Prices, availability, accessible states, and purchase destinations stay synchronized.

## Phase B — Product preview crossfade

Dependency: A real product-preview image exists and correct images are mapped to flower/format options.

- [ ] Crossfade between product preview images over 200 ms within a fixed-size image frame.
- [ ] Keep a stable aspect ratio to prevent layout shifts; never briefly collapse the image container.
- [ ] Wait for the incoming image to be ready before showing it. During loading, use a neutral loading state or clearly indicate that the previous preview is being replaced; do not present an old photo as the new option.
- [ ] Update product title, price, quantity, contents, and buying destination immediately. The fade must not control commercial state.
- [ ] On rapid changes, only the latest selected option may become the final visible image; ignore obsolete image-load completions.
- [ ] If an image fails, show a neutral fallback and keep selection/ordering usable. Do not substitute a photo of the wrong product without explanation.
- [ ] Keep only the current meaningful image exposed to assistive technology; any duplicate layer used for blending is decorative.
- [ ] Do not download every full-size catalog image eagerly solely to enable crossfades.

### Optional botanical detail

- [ ] Fade the selected flower's botanical name into the preview caption over 150–200 ms, using its existing typography.
- [ ] Keep it static when the botanical name has not changed, such as switching the same flower from kit to stem.
- [ ] No letter-by-letter effect, ink-drawing simulation, or new botanical claims.

**Acceptance:** The preview ends on the current option even under slow loading and rapid clicks. No blank flash, wrong final image, duplicate screen-reader description, or frame-size jump occurs.

## Phase C — Existing mobile menu, FAQ, and order bar

### C1. Mobile menu

- [ ] Fade in the panel with a downward settling movement of about 8 px over 220 ms. Reverse gently on close.
- [ ] Synchronize visible/open state, expanded semantics, and keyboard behavior. A visually hidden menu must not remain focusable or intercept taps.
- [ ] Preserve Escape handling and focus return. If it is a modal sheet, preserve its focus management and background inertness.
- [ ] Keep scrolling/background behavior consistent throughout transitions. Repeated open/close actions must not leave scroll locked.

### C2. FAQ

- [ ] Expand/collapse an existing accessible disclosure over 180–250 ms; let actual answer content determine its height.
- [ ] Animate a decorative indicator from plus to minus: for example, rotate/fade the vertical stroke away. Rotating the entire plus alone does not produce a minus.
- [ ] Keep expanded state, keyboard activation, and hidden-content behavior correct throughout.
- [ ] Handle long English/Indonesian answers, resized windows, and enlarged text without clipping.
- [ ] Prefer an instant, robust native disclosure over a fragile animation if the existing browser support cannot provide smooth expansion safely.

### C3. Sticky mobile order bar

- [ ] When the hero leaves view, fade/slide the existing bar up by approximately 12 px over 220 ms.
- [ ] Let it remain still while visible. Avoid toggling repeatedly around the trigger boundary.
- [ ] Preserve the main plan's behavior for reducing/hiding the bar when the full order controls are visible.
- [ ] Reflect current selection and availability immediately. Do not animate the price on every update.
- [ ] Reserve bottom clearance and device safe-area space. Hidden controls must not intercept interaction or remain in the tab order.
- [ ] Do not hide the bar while keyboard focus is inside it; prevent focus from being stranded in a disappearing control.

**Acceptance:** Menu, FAQ, and order bar remain accessible under repeated use. Their motion does not cover content, trap focus incorrectly, break scrolling, or delay navigation.

## Phase D — Hero and section entrances

Implement after core interaction effects are stable. These effects are decorative and lower priority.

### D1. Hero

- [ ] Keep the sunflower/product image immediately visible with no entrance opacity or movement.
- [ ] Apply a gentle fade and 8–12 px upward settling movement to the headline/copy group over 500 ms.
- [ ] Buttons may join the same group; if separated, use at most 60 ms additional delay and keep them usable immediately.
- [ ] Do not split the headline into animated letters or words, wait for all images/fonts, or replay on language changes.
- [ ] Skip the effect if reliable progressive enhancement would require a visible flash or hide an already-rendered hero.

### D2. Section entrances

- [ ] Reveal selected section headings, images, or cohesive content groups using opacity and an upward settling movement of 12–16 px over 450 ms.
- [ ] Trigger as an element enters the viewport; avoid thresholds requiring most of a tall mobile section to fit on screen.
- [ ] Use one observer where practical and stop observing an element after its first reveal.
- [ ] Avoid animating both a parent group and its children, which compounds movement and delays.
- [ ] For collection cards, optionally stagger desktop cards by 40–60 ms with at most 180 ms total extra delay. Remove the stagger on mobile.
- [ ] Do not replay existing elements after language changes or dynamic rerenders; newly updated commercial content should simply appear.
- [ ] Restore visibility immediately for direct anchor navigation, keyboard focus, reduced-motion mode, and printing.

**Acceptance:** Scrolling feels responsive, not gated. No user waits for content to become actionable. Deep links, fast scrolling, tall mobile sections, and JavaScript failure cannot leave content hidden.

## Phase E — Desktop product-image hover

- [ ] On devices with hover and a fine pointer, enlarge a product image from 1× to approximately 1.025× over 300 ms.
- [ ] Clip the transformed image inside its existing frame. Keep the frame, card, and nearby content stationary.
- [ ] Preserve the flower head and other important product details within the crop.
- [ ] Avoid translating/lifting the whole card or adding heavy shadows.
- [ ] Provide a visible focus border for linked product images/titles. The zoom is optional decoration, not the only sign of interactivity.
- [ ] Disable hover transforms on touch-first devices to avoid sticky hover effects.

**Acceptance:** Images stay sharp and inside their frames. Touch and keyboard interaction remains clear without needing hover. No horizontal overflow or layout movement appears.

## Reduced-motion behavior

Implement reduced-motion handling before enabling decorative effects. Respect `prefers-reduced-motion` in CSS and any JavaScript controlling scrolling or effects; respond if the preference changes during the session.

| Component | Reduced-motion behavior |
| --- | --- |
| Hero/section entrances | Immediately visible; no fade, translation, or stagger |
| Product image hover | No scale transform; retain focus/border feedback |
| Button press | No scaling; retain immediate color/border feedback |
| Selection/checkmark | Immediate final selected state |
| Preview/caption | Immediate replacement when the image is ready; retain loading/error handling |
| FAQ/menu | Immediate open/close with identical accessible behavior |
| Sticky order bar | Appears/disappears instantly; identical visibility rules |
| Anchor scrolling | Instant scroll with correct sticky-header offset |

Cancel active motion and reveal final content if reduced motion becomes enabled. Do not use a global near-zero animation duration hack that breaks completion-dependent logic.

## Effects excluded from this brief

- Parallax or scroll-jacking.
- Floating flowers, falling petals, confetti, or particles.
- Custom cursors or magnetic buttons.
- Typewriter headlines and letter-by-letter text reveals.
- Loading screens or artificial delays before showing products.
- Automatic image carousels or continuously moving banners.
- Bouncy/springy motion, dramatic card tilts, or spinning flower images.
- Animated price counters.

## Verification checklist

- [ ] Test at 1440×900, 820×1180, 390×844, and 360×740 in ID and EN.
- [ ] Test normal motion and reduced motion, including a preference change during an active effect.
- [ ] Test keyboard-only navigation, visible focus, menu Escape/return, and all selection controls.
- [ ] Test rapid flower/format switching, delayed image loads, and an image-load failure.
- [ ] Test fast scrolling, repeated scrolling back, direct section anchors, and focus entering an unrevealed group.
- [ ] Test mobile touch behavior, safe-area clearance, and the order bar while its action is focused.
- [ ] Test long FAQ answers, 200% zoom, and language changes while a disclosure is open.
- [ ] Verify content is visible with JavaScript disabled and if enhancement initialization fails; ensure the print view contains no hidden reveal content.
- [ ] Verify no animation-induced layout shifts, unnecessary full-size image preloading, or continuing animation work while idle.
- [ ] Inspect supported browsers for disclosure/transition compatibility; use immediate fallbacks where needed.
- [ ] Capture short before/after recordings for key interactions where tooling permits. Screenshots alone do not demonstrate timing.

Use focused manual and automated checks for these actual risks; avoid adding a broad test framework solely for decorative transitions. Report measured issues rather than claiming universal smoothness from one desktop test.

## Required implementation handoff

For each phase, report:

1. Components changed and the motion settings used.
2. Checks completed and their results.
3. Missing component/data dependencies and any justified skipped effects.
4. Relevant commit/PR and preview recordings, if available.
5. Confirmation that commercial state, accessibility, and reduced-motion behavior remain correct.

## Copy-ready prompt for the implementing agent

> Implement `Komorebi-Animation-Brief.md` in the Komorebi Creations repository. Read applicable repository instructions and the main implementation plan first. Inspect current components, then implement Phases A–E in order, completing the reduced-motion rules from the start. Preserve the existing design, stack, business content, and purchase behavior. Add effects only to existing, functional components; record missing dependencies and continue unblocked work. Keep motion restrained and content visible without JavaScript. Validate the stated interaction, accessibility, loading, and responsive cases, then report each phase's changes and evidence. Follow the current session's authorization for commits, PRs, and deployment; this brief does not itself authorize public release.
