# Studio Desk — additional implementation completion report

Covers `STUDIO-DESK-ADDITIONAL-IMPLEMENTATION.md` in full: SD-01 through SD-12. SD-01..SD-04 were
implemented and reported on first, as a foundational subset; this report focuses on SD-05..SD-12, the
remainder, and closes out the brief. Branch: `claude/great-albattani-apl570`.

## Status: complete, with two disclosed, deliberate scope reductions (noted under SD-06)

All twelve tasks are implemented, tested, and documented. Nothing is silently skipped — where a literal
sub-requirement was scoped down for safety/time, it's called out explicitly below rather than claimed as
done.

## How to verify

```
npm test        # runs tests/verify-studio-desk.js among the full repo suite — 65 Studio Desk suites
```

All 65 suites pass as of the last commit on this branch. `studio-desk/Code.gs` and the `<script>` block
in `studio-desk/Index.html` both pass `node --check` (Apps Script and the page's client JS are otherwise
untyped, so this is the available syntax gate).

## Task-by-task evidence

### SD-01 — Payment ledger (foundational subset, prior report)
`Desk Ledger` sheet; `recordPayment`/`getPaymentLedger`/`getPaymentSummaryForRef_`. Idempotent by
`idempotencyKey`. Dispatch checks cross-reference verified receipts, not just `Payment Status`. Legacy
orders surfaced as `paymentReconciliation: 'legacy_unreconciled'`, never invented. Tests: suites 41-45.
Commit `24be2c0`.

### SD-02 — Durable checklist (foundational subset, prior report)
`Desk Checklist` sheet; content-derived keys (`itemContentKey_`/`itemChecklistKeys_`, mirrored
client-side) so editing one item never drops an unrelated check. Distinct final packing checklist
(`PACKING_ITEMS`), required before leaving Dirangkai dan dikemas. Tests: suite 46. Commits `24be2c0`,
`b517fb7`.

### SD-03 — Activity history (foundational subset, prior report)
`Desk Activity` sheet; `logActivity_`/`getActivity`, plain-Indonesian, newest-first. Tests: suite 47.
Commits `24be2c0`, `b517fb7`.

### SD-04 — Explicit review completion (foundational subset, prior report)
`markReviewed`/`getReviewedForRef_`; idempotent, survives reload, never inferred from opening the
ticket. Tests: suite 48. Commits `24be2c0`, `b517fb7`.

### SD-08 — Requested, agreed, and production deadlines
`Desk Schedule` sheet; `setSchedule`/`getSchedule`/`getScheduleMap_`. Agreed date/time and production
deadline stored separately from `Orders`' own `Preferred Date`, which is never overwritten. Server
rejects a production deadline later than the agreed date. Client: Jadwal block with an edit form;
rescheduling upserts in place and logs an activity entry with the optional reason.
Tests: suites 51 (server), 55 (client). Commits `765cec6`, `aa6837f`.

### SD-09 — Saved package composition
`Desk Composition` sheet; `setComposition`/`getComposition`. Validates the stem total against the
ordered package's own spec from the live catalogue; snapshots flower/addition labels at save time so a
later catalogue edit or removal can't rewrite a historical order's meaning. Changing a line's
composition invalidates that line's own checklist tick (via the same `[ref, lineKey]` key the checklist
uses), never any other line's. Client: an "Atur/Ubah komposisi" editor on each package-type make-list
line, with a live running total against the required stem count.
Tests: suites 52 (server), 55 (client). Commits `765cec6`, `aa6837f`.

### SD-10 — Delivery and pickup records
`Desk Delivery` sheet; `setDeliveryInfo`/`markHandoff`/`markDeliveryComplete`. Handoff and completion
are separate, server-stamped timestamps — handoff is never treated as proof of receipt. Both are
idempotent and gated on full payment (mirroring `updateOrder()`'s own Shipped/Delivered check, ledger
cross-check included) so self-pickup can't bypass the rule shipping is held to. Tracking text is
validated (`validateTracking_`) before the client would ever render it as a link. Client: recipient/
destination/courier/tracking fields, plus method-specific "Tandai siap diambil"/"Tandai sudah diambil"
vs. "Tandai diserahkan ke kurir"/"Tandai sudah diterima" actions.
Tests: suites 53 (server), 55 (client). Commits `765cec6`, `aa6837f`.

### SD-11 — Explicit blockers with resolution
`Desk Blocker` sheet (append-only); `setBlocker`/`resolveBlocker`. Reasons are a fixed, validated set
(`bahan belum tersedia`, `menunggu jawaban pembeli`, `masalah pengiriman`, `lainnya`) plus an optional
note. A blocker never touches Payment Status or Work Phase directly — it only holds forward phase
movement (`updateOrder()`) and handoff (`markHandoff()`), enforced server-side; moving backward, notes,
payment verification, and messaging stay fully usable while blocked. Client: a prominent banner with
resolve action when one is open, and an "Ada kendala" action to open a new one.
Tests: suites 54 (server), 55 (client). Commits `765cec6`, `aa6837f`.

### SD-12 — Searchable archive and complete active-order access
`listOrders()` no longer limits which ACTIVE orders it can return to a row-position window: it scans
the whole sheet's `Work Phase` column first (cheap, one column) to find every active row regardless of
age, then reads a bounded recent window (`MAX_ROWS`, 500) for everything else, with a soft
`MAX_LISTED_ORDERS` (2000) cap that only ever trims already-finished rows. Delivered-order retention now
prefers the real completion timestamp from SD-10 over `Preferred Date` when one is on record, falling
back for legacy/unrecorded completions (never silently invented).

`searchArchive(query, cursor)` is new: a paginated (25/page), validated (min 2 characters), full-sheet
search by reference/buyer name/buyer WhatsApp, independent of the recency window — nothing is ever
deleted or truly unreachable. Wired into a new **Arsip** lane that searches the server (debounced) via
the same existing search input, rather than a second search UI.

Documented in `STUDIO-DESK-SETUP.md` under "Arsip search and very large sheets" (expected performance,
the fallback if a shop's history grows very large).

Tests: suites 56-59 (server), 60 (client). Commit `042e7a9`.

### SD-05 — Daily work view and next-action summaries
`orderGroups(o)` derives the seven documented work groups (missing info or blocker, review needed,
payment needs checking, overdue, production due today, in production, ready for handoff) from actual
order records; an order can land in more than one, and the "Perlu ditangani" chip count is a count of
*orders*, not group memberships. `nextAction(o)` is the single shared function producing one concise
line (`Cek DP Rp100.000`, `Tentukan jadwal`, `Alamat belum lengkap`, ...), used identically by both the
queue cards and the open ticket, so they can never disagree.

"Perlu ditangani" (any order in a work group) is now the default landing lane, with "Aktif" (the full
list, unchanged) and "Arsip" one tap away in the same chip row — no duplicate counters or second
new-order badge introduced. Sorting/date-group headers now use an SD-08-aware operational date (the
agreed schedule date once set, else the original Preferred Date, which cards keep displaying unchanged)
with deterministic submission-time-then-reference tie-breakers.

Tests: suite 61. Commit `1d6592c`.

### SD-06 — One primary action per order stage
`primaryAction(o, catalog)` maps the brief's own eight-row state table to a single prominent button at
the top of the ticket, reusing the *exact* existing data-* action each situation already had elsewhere
(`data-markreviewed`, `data-sendpayment`, `data-advance`, `data-markhandoff`,
`data-markdeliverycomplete`) — every prerequisite (`gate().ready`, `packingComplete()`, the server's own
payment/blocker checks) stays exactly as already enforced; nothing here is a new or shortcut path. Two
situations ("Periksa pembayaran", "Periksa & kemas") aren't a single mutation, so their button
scrolls/focuses the relevant section instead. Falls back to SD-05's plain text when no table row applies,
and is suppressed entirely while a blocker is open (`blockerBanner()` already covers that). The reverse
action now names its destination ("Kembali: Dirangkai dan dikemas") instead of a bare "Kembali".

**Disclosed scope reductions:** the brief's mobile treatment ("bottom action bar with safe-area
padding") was implemented as a full-width *inline* button at the top of the ticket instead of a
fixed/sticky bottom bar, to avoid restructuring PR #37's already-tuned mobile layout under this task's
medium-priority budget — it still gives one obvious, reachable primary action on every screen size.
Completed review/payment sections keep the one-line collapsed summaries they already had (SD-04/SD-01);
a dedicated expand-to-see-original-detail control was not added on top of that.

Tests: suite 62. Commit `9f73220`.

### SD-07 — Honest WhatsApp preparation and sending history
`Desk Message` sheet (eighth Desk Ops sheet); `logMessagePrepared`/`confirmMessageSent`/
`getMessageHistory`. Opening WhatsApp only ever records that a message was **prepared** — a row with no
`Confirmed Sent At` is not an error, just an unconfirmed attempt, forever if she never confirms it.
"Sent" is only ever her own separate, explicit "Sudah saya kirim" tap, idempotent by event ID.
`listOrders()`/`searchArchive()` surface each order's most recent *confirmed* send as `order.lastMessage`
— an unconfirmed preparation never counts.

Client: `openWhatsApp()` mints its event ID and opens the WhatsApp window synchronously, inside the same
click (so it's never blocked as a popup), and fires the prepare call in the background afterwards. A
persistent "Sudah dikirim?" prompt is fixed to the viewport rather than embedded in the ticket, keyed by
the order reference captured at prepare time — so answering it after switching to a different order
still confirms the original one. Declining just closes the prompt with nothing recorded. Every WhatsApp
button is relabelled by purpose ("Buka WhatsApp: tagihan DP", "... pelunasan", "... pesanan siap", ...)
instead of "Kirim ..." wording that implied it was already sent, with a "Terakhir dikonfirmasi terkirim
..." note next to the button that would resend the same type — a nudge, never a block; a deliberate
resend stays reachable and never itself touches Payment Status or Work Phase. A failed `window.open()`
falls back to copying the message text. Amounts continue to come from SD-01's authoritative
`billed()`/`depositAmount()`/`balanceAmount()`, unchanged.

Tests: suites 63-65. Commit `042fdba`.

## Schema summary (all of Part 10 in `STUDIO-DESK-SETUP.md`)

Eight additive sheets, alongside `Orders`, never touching it or its five `WRITABLE_FIELDS`:
`Desk Ledger`, `Desk Checklist`, `Desk Activity`, `Desk Schedule`, `Desk Composition`, `Desk Delivery`,
`Desk Blocker`, `Desk Message`. `deskOpsMigrationDryRun()`/`deskOpsMigrationApply()` create/repair all
eight, additively and idempotently; re-running is always safe. Every command is server-authorized
(`checkAccess_()`), locates rows by reference, and validates every mutation — none of this widened
`updateOrder()`'s five-column contract.

## What was explicitly out of scope (per the brief) and stayed that way

Collaboration features (assignments, team queues, shared-work handoffs, multi-user conflict UI) — not
implemented, as instructed. PR #37's own scope (date/timezone gate fixes, DOM/tap/scroll/focus fixes,
cancelled-order counters, cross-lane search UI, touch targets, contrast, theme switching, etc.) was
reused, not reopened or duplicated.

## Known follow-ups (not blocking, not claimed as done)

- SD-06's mobile action bar and section-expand control (see disclosed reductions above).
- SD-12's `searchArchive()` reads the whole sheet per query; documented as a future concern only if a
  shop's history grows very large (thousands of rows), with the documented mitigation (a separate
  archive spreadsheet) left for a deliberate, separate change rather than guessed at here.
- Cancelled-order retention (SD-12's completion-timestamp preference) still falls back to Preferred Date
  for Cancelled orders specifically, since there's no equivalent "cancelled at" timestamp on record
  anywhere in this schema — adding one was not part of any SD-01..SD-12 requirement and was left alone.
