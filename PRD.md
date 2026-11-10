# Personal Expense Tracker — PRD

Nov 9, 2026 · @off\_loop

## Overview

A salary-first personal expense tracker: the user enters their salary and pay date, logs daily expenses, and fixed monthly costs (gym, WiFi, rent) deduct themselves automatically. The dashboard always answers one question: **how much can I still spend this pay cycle?**

**Problem.** Salaried users know their income but lose track of where it goes. Bank apps show transactions, not a budget; spreadsheets need discipline; most tracker apps start from expenses, not from the money available.

**Target users**

- Salaried professionals and freshers (22–35) paid once a month, managing their own money for the first time
- Students and interns with a fixed monthly stipend
- Anyone who wants a "remaining balance" view rather than a raw spending log

**Product principle.** Logging an expense must take under 5 seconds; everything else (deductions, analytics) happens automatically.

## Goals, non-goals and success metrics

**Goals**

1. Show an accurate remaining balance for the current pay cycle at all times.
2. Make expense entry fast enough to do at the point of spend.
3. Remove manual work for recurring costs through auto-deduction.
4. Turn raw entries into insight: where money goes, trends, and savings.

**Non-goals (v1)**

- App Store or Play Store distribution
- Bank account or UPI/SMS sync
- Investments, loans or net-worth tracking
- Shared/household budgets
- Tax filing or financial advice

**Success metrics**

| Metric | Target (90 days post-launch) |
| --- | --- |
| Onboarding completion (salary + first expense) | ≥ 70% of sign-ups |
| Median time to add an expense | < 5 seconds |
| Weekly active users / monthly active users | ≥ 50% |
| Users who set up at least one fixed expense | ≥ 60% |
| Month-2 retention | ≥ 40% |
| Users completing a full pay cycle of logging | ≥ 35% |

## Core user flow

&#91;embedded content: core user flow · 3 inputs, 1 balance, monthly loop\]

Salary, fixed costs and daily spends all feed one live balance for the pay cycle; on the next pay date a new cycle opens and the loop repeats.

1. **Onboard:** enter net salary and pay date (under 60 seconds).
2. **Set fixed costs:** add gym, WiFi, rent, subscriptions with their due days.
3. **Log daily:** tap +, type amount, pick category, done.
4. **Check dashboard:** see remaining balance and where money went.
5. **New cycle:** on pay date, salary re-applies and fixed costs reschedule.

## Feature list

P0 = must ship in MVP · P1 = fast follow (v1.1) · P2 = later.

| # | Feature | Module | Priority |
| --- | --- | --- | --- |
| 1 | Add salary with amount and pay date | Income | P0 |
| 2 | Pay cycle auto-set from pay date (e.g. 1st–31st, or 25th–24th) | Income | P0 |
| 3 | Add expense: amount, category, date, note | Expenses | P0 |
| 4 | Quick-add with last-used category and today's date pre-filled | Expenses | P0 |
| 5 | Edit / delete any expense | Expenses | P0 |
| 6 | Default categories (Food, Transport, Shopping, Bills, Health, Entertainment, Other) | Expenses | P0 |
| 7 | Add fixed expense: name, amount, deduction day, frequency | Fixed expenses | P0 |
| 8 | Auto-deduct fixed expenses on their due day each cycle | Fixed expenses | P0 |
| 9 | Pause, edit or end a fixed expense | Fixed expenses | P0 |
| 10 | Remaining balance card (salary − fixed − variable) | Dashboard | P0 |
| 11 | Spend by category chart | Dashboard | P0 |
| 12 | Daily spending trend for the cycle | Dashboard | P0 |
| 13 | Recent transactions list | Dashboard | P0 |
| 14 | Local data persistence and backup | Platform | P0 |
| 15 | Safe-to-spend per day (remaining ÷ days left) | Dashboard | P1 |
| 16 | Upcoming fixed deductions (next 7 days) | Dashboard | P1 |
| 17 | Month-over-month comparison | Dashboard | P1 |
| 18 | Category budgets with 80% / 100% alerts | Budgets | P1 |
| 19 | Savings goal per cycle | Budgets | P1 |
| 20 | Additional income (bonus, freelance, refund) | Income | P1 |
| 21 | Custom categories with icon and colour | Expenses | P1 |
| 22 | Search and filter transactions | Expenses | P1 |
| 23 | Daily log reminder notification | Notifications | P1 |
| 24 | Fixed-expense deduction notification | Notifications | P1 |
| 25 | Payment method tag (UPI, card, cash) | Expenses | P1 |
| 26 | Export to CSV / PDF | Platform | P1 |
| 27 | App lock (PIN / biometric) | Platform | P1 |
| 28 | Cloud sync across devices | Platform | P2 |
| 29 | Receipt photo attachment | Expenses | P2 |
| 30 | Import bank statement CSV (SMS capture isn't possible in a PWA) | Expenses | P2 |
| 31 | Spending insights in plain language ("Food is up 22% vs last month") | Dashboard | P2 |
| 32 | Yearly summary and annual view | Dashboard | P2 |
| 33 | Home-screen shortcut for quick add (widgets need a native app) | Platform | P2 |
| 34 | Split expenses with friends | Expenses | P2 |

## Functional requirements

### 1. Salary and income

- FR-1.1 User enters net salary (₹) and pay date during onboarding; both are required.
- FR-1.2 The pay date defines the pay cycle: cycle runs from pay date to the day before the next pay date.
- FR-1.3 Salary auto-repeats each cycle; the user confirms or edits the amount when a new cycle starts.
- FR-1.4 If the pay date falls on a day missing in a month (e.g. 31st), the cycle uses that month's last day.
- FR-1.5 (P1) User can add one-off income; it adds to the current cycle's available balance.

### 2. Expenses

- FR-2.1 Add expense with amount (required), category (required), date (defaults to today), note and payment method (optional).
- FR-2.2 The add button is reachable from every screen in one tap.
- FR-2.3 Expenses can be back-dated within the current or previous cycle.
- FR-2.4 Edit or delete updates the balance and all analytics immediately.
- FR-2.5 Deleting asks for confirmation and offers a 5-second undo.

### 3. Fixed expenses (auto-deduction)

- FR-3.1 User adds a fixed expense with name, amount, category, deduction day and frequency (monthly; P1: weekly, quarterly, yearly).
- FR-3.2 On the deduction day, the app creates a transaction tagged "Auto" and deducts it from the balance.
- FR-3.3 At cycle start, the dashboard shows total committed fixed costs, so "free to spend" excludes them up front.
- FR-3.4 Deductions missed while the app was closed are back-filled on next open, with their original dates.
- FR-3.5 User can pause, edit (applies from next deduction) or end a fixed expense; past deductions stay.
- FR-3.6 Auto-created transactions can be edited or skipped for a single cycle (e.g. gym closed this month).

### 4. Dashboard

- FR-4.1 Default view is the current pay cycle; user can switch to past cycles.
- FR-4.2 All figures recalculate in real time after any entry.
- FR-4.3 Detailed spec in the next section.

### 5. Budgets and alerts (P1)

- FR-5.1 User sets a monthly limit per category.
- FR-5.2 Notify at 80% and 100% of a category limit, and when remaining balance drops below 10% of salary.
- FR-5.3 User sets a savings goal; dashboard shows progress against it.

### 6. Settings

- FR-6.1 Currency (default ₹), pay date, categories, notification times, app lock.
- FR-6.2 Export all data as CSV; delete all data.

## Dashboard analytics

The top of the dashboard is the remaining balance; every widget below explains how it got there.

```latex
\text{Remaining} = \text{Salary} + \text{Other income} - \text{Fixed deducted} - \text{Variable spent}
```

| Widget | What it shows | Chart type | Priority |
| --- | --- | --- | --- |
| Balance card | Remaining ₹, % of salary left, days left in cycle | Big number + progress bar | P0 |
| Income vs outflow | Salary split into fixed, variable spent, remaining | Stacked bar / donut | P0 |
| Spend by category | ₹ and % per category this cycle | Donut + ranked list | P0 |
| Daily trend | Spend per day, cumulative line vs ideal pace | Bar + line | P0 |
| Recent transactions | Last 10 entries, auto-deductions tagged | List | P0 |
| Safe-to-spend today | Remaining ÷ days left | Number | P1 |
| Upcoming deductions | Fixed expenses due in next 7 days | List | P1 |
| Fixed vs variable | Share of salary committed to fixed costs | Split bar | P1 |
| Month-over-month | This cycle vs last 3 cycles, total and by category | Grouped bar | P1 |
| Budget progress | Spent vs limit per category | Progress bars | P1 |
| Savings rate | Saved ÷ salary per cycle | Line | P1 |
| Top merchants / notes | Most frequent spend notes | Ranked list | P2 |
| Weekday pattern | Average spend by day of week | Bar | P2 |
| Insights feed | Auto text: spikes, overspend, streaks | Cards | P2 |

**Filters:** cycle selector, category, payment method, date range (P1).

## Design system

The look follows the design language of [linear.app](https://linear.app): dark, quiet, dense and precise, with one accent colour and no decoration. It borrows the style only, not Linear's logo, name or assets. No scroll-reveal or entrance animations.

**Principles**

- Monochrome first: greys do the work; the accent marks only the primary action and the current selection.
- Thin 1px borders separate surfaces instead of shadows or heavy cards.
- Numbers are the hero: large, tabular figures for amounts; labels small and muted.
- Dense but calm: list rows \~40px tall, generous outer margins.
- Keyboard-friendly on desktop (N = new expense, / = search, Esc = close).

**Tokens (dark theme default; light theme mirrors them)**

| Token | Value | Use |
| --- | --- | --- |
| bg | #08090A | App background |
| surface | #0F1011 | Cards, sheets, sidebar |
| surface-hover | #16171A | Row hover, pressed states |
| border | rgba(255,255,255,0.08) | Card and row dividers |
| text-primary | #F7F8F8 | Amounts, headings |
| text-secondary | #8A8F98 | Labels, dates, notes |
| text-tertiary | #62666D | Placeholders, disabled |
| accent | #5E6AD2 | Primary button, active tab, focus ring |
| positive | #4CB782 | Income, under budget |
| warning | #F2C94C | 80% of budget |
| negative | #EB5757 | Over budget, negative balance |

**Type and shape**

- Font: Inter (self-hosted), with `font-feature-settings: "tnum"` for all amounts.
- Sizes: balance 40/600, page title 20/600, body 14/400, labels 12/500; headings use slightly negative letter-spacing (-0.01em to -0.02em).
- Radius: 6px for buttons and inputs, 8px for cards, 12px for bottom sheets.
- Spacing on a 4px grid; 16px side gutter on mobile.
- Icons: thin 1.5px stroke line icons (e.g. Lucide), 16px, in text-secondary.
- Charts: no gridline clutter, muted axes, category colours desaturated; accent reserved for the current cycle.
- Motion: only 120–150ms ease-out on hover, press and sheet open; respect reduced-motion.

**Key screens**

1. **Dashboard:** balance card on top, then income-vs-outflow bar, category donut, daily trend, recent transactions.
2. **Add expense:** bottom sheet with a large amount field, category chips and a date row; saves on Enter.
3. **Transactions:** dense list grouped by day, auto-deductions marked with a small "Auto" tag.
4. **Fixed expenses:** list with amount, next deduction date and a pause toggle.
5. **Settings:** salary, pay date, categories, backup/restore.

## Data model

Five core entities; every expense and auto-deduction is one Transaction row tied to a PayCycle.

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | id, name, currency, pay\_day, created\_at | pay\_day = 1–31 |
| PayCycle | id, user\_id, start\_date, end\_date, salary\_amount, status | One open cycle at a time |
| Transaction | id, cycle\_id, type (expense / income / auto), amount, category\_id, date, note, payment\_method, fixed\_expense\_id | fixed\_expense\_id set only for auto-deductions |
| FixedExpense | id, user\_id, name, amount, category\_id, deduction\_day, frequency, start\_date, end\_date, is\_paused | Generates Transactions |
| Category | id, user\_id, name, icon, colour, monthly\_limit, is\_default | monthly\_limit is P1 |

A background job (or on-app-open check) creates auto Transactions for every active FixedExpense whose deduction\_day has passed in the open cycle and has no Transaction yet, which keeps deductions idempotent.

## Non-functional requirements

- **Platform:** a progressive web app (PWA) for personal use, installed from Safari or Chrome via Add to Home Screen. No App Store or Play Store release; one codebase runs on iPhone, Android and desktop.
- **iOS support:** iOS 16.4 or later, so home-screen web push notifications work.
- **Speed:** app opens to dashboard in < 2 s; adding an expense saves in < 300 ms.
- **Offline-first:** a service worker caches the app; all P0 features work without internet.
- **Storage:** data lives on the device in IndexedDB. Deleting the home-screen app deletes its data, so a one-tap backup export is required.
- **Privacy:** no account, no server and no tracking in v1; data never leaves the phone unless exported.
- **Accuracy:** money stored as integer paise to avoid rounding errors.
- **Accessibility:** WCAG AA contrast, screen-reader labels, large-text support.

## Edge cases

- Salary credited late or early → user can shift the cycle start date for that month.
- Fixed expenses exceed salary → warn at setup; balance may go negative and shows in red.
- Expense entered for a closed cycle → allowed, recalculates that cycle's analytics.
- Pay date changed mid-cycle → current cycle ends early; new cycle starts on the new date.
- Fixed expense added mid-cycle with a deduction day already passed → ask whether to deduct this cycle.
- No expenses yet → dashboard shows an empty state with a prompt to add the first one.
- App removed from home screen or phone changed → restore from the last backup file; remind to back up if none in 14 days.

## Release plan

1. **MVP (P0):** salary + cycle, expenses, fixed auto-deductions, core dashboard — deployed as a PWA on a free static host.
2. **v1.1 (P1):** budgets, alerts, safe-to-spend, MoM comparison, export, app lock.
3. **v2 (P2):** cloud sync, bank statement import, insights feed, widgets, split expenses.

## Open questions

- Should salary be entered as net (in-hand) only, or gross with deductions?
- Should unspent balance roll over into the next cycle or count as savings?
- Hosting: a free static host (GitHub Pages, Netlify or Vercel) is enough; which one?
- Is cloud sync (P2) needed, or are manual backups enough for one user?
