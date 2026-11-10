# Spese — v1.1 plan

v1.0 (all P0 features) is live at https://spese-lake.vercel.app. This plan covers v1.1: the
PRD's P1 features plus the requests from 11 Nov 2026 (name, welcome screen, refunds,
category management, bonus income). Each phase ends with something usable and deployable.

**Not planned: email sign-in.** With no server there is nothing to sign in *to* — an account
would need a backend, hosting cost and a privacy policy, and would break the "data never
leaves the phone" promise. It only becomes useful with cloud sync (P2). For keeping the app
private on the phone, Phase 7's app lock is the right tool.

## Phase 0 — Rename to Spese, welcome screen — ✅ done 11 Nov 2026

- **Name:** "Spese" in the app title, home-screen name, manifest, onboarding and sidebar.
- **Welcome screen** shown only on a device with no data (never again after setup, so opening
  the installed app still lands straight on the dashboard):
  - App name, one line on what it does, three short points (salary-first balance, fixed costs
    deduct themselves, data stays on your phone).
  - **Get started** → the existing salary step.
  - **Restore from backup** → pick a backup file and skip onboarding. Today a reinstall has to
    onboard with fake numbers before it can restore; this fixes that.
- Not a marketing website: the app *is* the site. (A separate public page can come later if you
  want to share Spese with others.)

## Phase 1 — Extra income and monthly bonus (PRD #20, extended) — ✅ done 11 Nov 2026

- **One-off income:** the add sheet gets an **Expense / Income** switch. Income has an amount,
  type (Bonus, Freelance, Gift, Other), date and note, and adds to that cycle's balance
  (Remaining = Salary + Other income − Fixed − Variable, already in the formula).
- **Recurring income** ("bonus each month"): set up like a fixed expense, but it adds money —
  name, amount, day of month, pause/end. Created automatically on its day, tagged "Auto".
- Dashboard: the balance card shows "of ₹X income" (salary + extras); income appears in
  recent transactions in green with a +.

## Phase 2 — Refunds on a transaction (new) — ✅ done 11 Nov 2026

Example: you paid ₹1,800 for dinner, a friend sends back ₹600.

- Open the expense → **Add refund**: amount, date, optional note ("Rahul's share"). Several
  refunds per expense are allowed; together they can't exceed the original amount.
- The expense then counts as its **net** amount (₹1,200) everywhere: remaining balance,
  category totals, daily trend.
- **Not shown on the dashboard** as its own item. It is visible on the transaction itself:
  the list row reads `₹1,200` with a small "₹600 back" note, and the edit sheet lists each
  refund (editable, deletable with undo).
- Refunds are included in backups.
- **Refund in a later cycle (decided 11 Nov 2026):**
  - Refund dated in the **same cycle** as the expense → it reduces the expense to its net
    amount (as above).
  - Refund dated **after that cycle has closed** → the expense keeps its full amount in the old
    cycle (that cycle's savings don't change), and the refund is added to the cycle it arrives
    in, as income labelled "Refund for <expense>". It is still linked to, and listed on, the
    original expense.
  - The rule follows the refund's date, so editing a refund's date can move it between the two
    cases.

## Phase 3 — Manage categories (PRD #21, extended) — ✅ done 11 Nov 2026

- **Add** a category: name, icon (from a small set), colour (from the validated palette).
- **Rename** any category, **including "Other"**.
- **Remove** a category: if it has transactions or fixed expenses, you choose which category
  they move to first. "Other" can be renamed but not removed — it is the fallback.
- **Reorder** (drag or up/down) — the order also drives chart colours.
- **Colours:** the chart palette has 8 colour-blind-safe slots (7 used). Categories beyond 8
  share colours; charts then rely on labels (already always present), and the donut folds the
  smallest into "Other".

## Phase 4 — Dashboard additions (PRD #15, #16, #17 + P1 widgets) — ✅ done 11 Nov 2026

- **Safe to spend today:** free to spend ÷ days left.
- **Upcoming deductions:** fixed costs (and recurring income) in the next 7 days.
- **Fixed vs variable:** share of income committed to fixed costs.
- **Savings rate:** what was left at each cycle end ÷ income (leftover counts as savings).
- **Month-over-month:** this cycle vs the last 3, total and by category.

## Phase 5 — Budgets and goals (PRD #18, #19) — ✅ done 11 Nov 2026

- Monthly limit per category; progress bars; warning at 80%, over at 100% (in-app banners).
- Alert when remaining drops below 10% of salary.
- Savings goal per cycle, with progress on the dashboard.

## Phase 6 — Find and export (PRD #22, #25, #26)

- **Payment method** on expenses: UPI, card, cash (optional, remembered like category).
- **Search and filter** transactions: text, category, payment method, date range.
- **Export** to CSV (all data, for spreadsheets) and a one-cycle PDF summary.

## Phase 7 — Lock and reminders (PRD #23, #24, #27) — needs decisions

- **App lock:** PIN, plus Face ID / fingerprint where the browser supports it. Note: in a web
  app this is a privacy screen, not encryption of the stored data.
- **Notifications:** a web app can't wake itself on a schedule. Reliable daily reminders and
  "rent deducted" notices need a small push server, which conflicts with "no server".
  Options: (1) reminders only appear when you open the app, (2) add a minimal push service.
  Decide before this phase.

## Open decisions

1. ~~Refund received in a later cycle~~ — decided: same cycle reduces the expense; later cycle
   adds to that cycle's balance (see Phase 2).
2. ~~Recurring income: confirm each month, or add itself?~~ — built as "adds itself" (like fixed
   costs); it can be skipped for one cycle, paused or ended. Easy to change if you'd rather confirm.
3. Notifications approach. *(Phase 7)*
