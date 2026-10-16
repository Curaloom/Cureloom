# Cureloom V1 — workflow validation prototype

A clickable prototype for one simulated month (October 2026) at one simulated practice, Westfield Family Medicine. A nurse and a practice manager can walk through the month and tell us whether the workflow makes sense. All data is hand-made and fictional (phones are +1 555 01XX). Nothing is ever dialled, texted or sent to an EHR.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

`npm start` runs one Node process: the API and SQLite database (`data/cureloom.db`), plus the React app through Vite. On first start the database is seeded. **Reset to seed** in the demo bar reloads it at any time.

For a preview link on a private server:

```bash
npm run build
HOST=0.0.0.0 PORT=3000 npm run serve
```

Other commands: `npm test` runs the basic checks in `tests/`, and `npm run typecheck`.

## The demo bar

The bar is at the top of every screen and holds:

- **Role switcher**: Nurse (Rachel Okafor, RN), Physician (Dr. Anita Patel), Practice manager (Dana Brooks). There is no login.
- **Demo clock**: starts Mon 5 Oct 2026 09:00. It has **+1 day**, **Go to date…** (forward only) and **Jump to month end** (Fri 30 Oct 14:00). While the app is open, time ticks in real time and stops at 18:00 each day.
- **1 s = 1 min** (on by default): while a timer runs, each real second records one minute. Turn it off for real-time timers.
- **Run October AI calls**: applies every APCM patient's scripted outcome from section 5, in date order (6–13 Oct). The clock moves to the last call.
- **Save / Restore checkpoint**: snapshots the whole demo state. Use it for walkthrough 11, which needs a reset in the middle of the sequence. Save after walkthrough 10, reset and run 11, then restore and carry on with 12.
- **Reset to seed**.

A red banner shows on every screen while an urgent flag is open, with the 30-minute acknowledgement countdown.

## Screens

| Screen | Role | Where |
|---|---|---|
| Roster upload | Practice manager | `#/roster` |
| Enroll (confirm, consent script, call setup) | Nurse; confirm step is the practice manager | `#/enroll` |
| Today queue | Nurse | `#/queue` |
| Patient month (brief, nine-step stepper, timers, tasks, flags) | Nurse | `#/patient/:id` |
| Nurse call | Nurse | `#/call/:id` |
| AI call simulator | Tester | `#/simulator` |
| Month end (draft, copy, file) | Nurse | `#/month-end` |
| Attestation | Physician | `#/attestation` |
| Billing list (+ CSV) | Practice manager | `#/billing` |
| Audit trail, Outbox | Anyone | `#/events`, `#/outbox` |

## How it is built

- `shared/`: domain logic used by both server and browser.
  - ICD-10 codes and the condition → readings/symptoms mapping.
  - Red-flag rules and reading targets.
  - The keyword parser that turns what a patient says into answers. No LLM is needed.
  - The AI call state machine: identify → disclose → medications → symptoms → ER → readings → needs → close. An urgent answer jumps to the 911/988 line.
- `server/`: Express + better-sqlite3.
  - `service.ts` holds every command. Each runs in a transaction, writes `event` rows, and re-runs billing.
  - `billing.ts` is the single billing function.
  - `note.ts` builds the month-end note from stored rows.
  - `views.ts` computes everything the UI shows: queue, brief, stepper, billing, notes.
- `src/`: React screens. The client only renders server state and posts commands.
- `seed/`:
  - `october-roster.csv` (the 15 patients) and `roster-with-errors.csv` (a sample with rejected rows).
  - `september.json`: active patients' September consent, call setup, September call and October schedule.
  - `october-script.json`: section 5's AI call outcomes and nurse-call lines.

The data model is the nine tables from the brief plus a `demo` key-value table. A few extra columns are marked in `server/db.ts`:

- `call`: scheduling, retries and cancellation.
- `flag`: summary, escalation and the acknowledgement deadline.
- `task`: kind, created/closed time and source call.

## Decisions made where the brief was silent

- **Compressed AI run and the 30-minute rule.** The run covers 6–13 Oct in one click, so Harold's urgent flag (raised 6 Oct) would already be overdue when the clock lands on 13 Oct. The run therefore re-delivers any unacknowledged urgent alert when it finishes and starts the 30-minute window then. The audit trail says so. Urgent flags raised live (simulator, nurse call) start the window immediately. If nobody acknowledges in time, the physician and practice manager are alerted in the outbox.
- **AI call retries.** An unanswered AI call is retried 2 business days later at the same time, which reproduces W07's 7, 9 and 13 Oct. After 3 tries a nurse task is created. If the consent allows texts, a "we'll try again" text goes to the outbox.
- **Opt-out.** "Stop calling me" revokes consent, cancels all scheduled calls (each patient has this month's and next month's check-in scheduled), creates "Confirm opt-out by phone", and sets the status to opted out.
- **Concerns found on a nurse call.** These create follow-up tasks (for example "Breathing follow-up") but no flag to acknowledge, because the nurse found them herself. Urgent findings on a nurse call still create an urgent flag, marked acknowledged, which she resolves.
- **Billing.** Hold reasons are checked in this order: not enrolled → paused → call setup not finished → opted out with no service → CCM under 20 counted minutes → APCM with no completed contact → note not filed in EHR → awaiting physician attestation. Anything that passes all of them is ready.
  - A completed contact is any AI or nurse call that reached the patient or caregiver.
  - Counted time is the sum of exact seconds, floored to whole minutes. Only completed nurse calls and timed work count. AI calls, consent calls and unanswered attempts never count.
- **Program changes.** A patient's program can't change mid-month once there is activity under the current program.
- **No nudges.** The UI never shows "minutes to go". It shows the minutes, plus "Meets 20 minutes" once that is true.
- **Nine-step stepper.** The steps are: eligibility and consent, call setup, monthly contact, flags, EHR chart review, EHR medication review, EHR care plan review, tasks and coordination, note filed and attested.
- **Note format.** Section 6 of the Scope Revision wasn't available, so the note uses a plain-text layout with these sections: header, monthly contact (with answers), flags, care management work, tasks, itemised time log (AI contact shown as not counted), and the program requirement.

## Not built (parked)

Real telephony, real AI voice, anything EHR, a browser extension, pharmacy and specialist calls, a 24/7 inbound line, AI consent, care plan suggestions, remote monitoring devices, multiple practices, payments, authentication, and Synthea.
