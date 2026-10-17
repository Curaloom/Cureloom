# Cureloom V1 — workflow validation prototype

A clickable prototype for one simulated month (October 2026) at one simulated practice, Westfield Family Medicine. A nurse and a practice manager can walk through the month and tell us whether the workflow makes sense. All data is hand-made and fictional (phones are +1 555 01XX). Nothing is ever dialled, texted or sent to an EHR.

The workflow reference is [docs/WORKFLOW.md](docs/WORKFLOW.md). It covers each step of the month, the rules behind what the screens show, and the simulation controls.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

`npm start` runs one Node process: the API and SQLite database (`data/cureloom.db`), plus the React app through Vite. On first start the database is seeded. **Reset to seed** in the Simulation panel reloads it at any time.

For a preview link on a private server:

```bash
npm run build
HOST=0.0.0.0 PORT=3000 npm run serve
```

Other commands: `npm test` runs the checks in `tests/`, and `npm run typecheck`.

The database file is versioned (`PRAGMA user_version`). When the schema changes, an older `data/cureloom.db` is dropped and reseeded on the next start, and checkpoints saved under an older schema are ignored.

## Simulation controls

The demo controls are in a **Simulation** panel that opens from the header, not in a permanent demo bar. The details, including the walkthrough 11 sequence, are in [docs/WORKFLOW.md](docs/WORKFLOW.md#14-simulation-controls-for-testers).

- **Demo clock**: starts Mon 5 Oct 2026 09:00 and only moves forward, with **+1 day**, **Go to date** and **Jump to month end** (Fri 30 Oct 14:00). The CMS-1500 export opens on Sat 31 Oct, the date of service: use **Go to date** to get there.
- **1 s = 1 min**: while a timer runs, each real second records one minute.
- **Run October AI calls**: plays every APCM patient's scripted October call in date order (6–13 Oct).
- **Save / Restore checkpoint**: snapshots the whole demo state. Walkthrough 11 uses it.
- **Reset to seed**: returns to Mon 5 Oct 2026 09:00.

## Screens

| Screen | Role | Where |
|---|---|---|
| Roster & opportunity (CSV/XLSX upload, column mapper, Opportunity Matrix, eMRR) | Practice manager (Ops) | `#/roster` |
| Billing reconciliation (ledger, micro-ledger, CMS-1500 dispatcher, pre-flight, billing settings) | Practice manager (Ops) | `#/billing` |
| Enroll (consent script, call setup) | Nurse | `#/enroll` |
| Today queue: Consent pending, Care not yet delivered, Clinical urgency, Pending steps | Nurse | `#/queue` |
| Patient (This month: brief, stepper, timers, tasks, flags · Clinical profile · Care plan) | Nurse | `#/patient/:id` |
| Nurse call | Nurse | `#/call/:id` |
| Care plans & escalations (Queue A approvals, Queue B escalations with timer) | Physician | `#/physician` |
| AI call simulator | Tester | `#/simulator` |
| Month end (draft, copy, file) | Nurse | `#/month-end` |
| Attestation | Physician | `#/attestation` |
| Audit trail, Outbox | Anyone | `#/events`, `#/outbox` |

There is no login: the role switcher changes between Nurse (Rachel Okafor, RN), Physician (Dr. Anita Patel) and Practice manager (Dana Brooks, who runs the Ops panel). A red banner shows on every screen while an urgent flag is open, with the 30-minute acknowledgement countdown.

### Walking the new workflow

1. **Ops**: Roster & opportunity → **Use the October roster** (or drop `october-roster.xlsx`). Check the proposed column mapping and import. Approve, hold or reject rows in the Opportunity Matrix; the eMRR banner updates.
2. **Nurse**: Today queue → Consent pending → **Send consent link**, then **Tester: patient signs** (or **Call** for the phone script). Fill the call setup.
3. **Physician**: Care plans & escalations → **Approve & Initiate Care Program**. Only now are the patient's calls scheduled.
4. **Run October AI calls** (Simulation panel); the Clinical urgency queue fills. Escalate a patient to the physician from the patient page; the physician opens it (timer runs), writes a directive and can mark the month moderate/high complexity.
5. **Jump to month end** (Simulation panel), file notes, sign the attestation, then **Go to date** 31 Oct and open Billing reconciliation: click a row for the micro-ledger, download the CMS-1500 CSV/XLSX and the exceptions report (W06's member ID has slashes, so pre-flight excludes that claim).

## How it is built

- `shared/`: domain logic used by both server and browser.
  - `icd10.ts`: the chronic-condition ICD-10 matrix (21 condition groups by category prefix, longest prefix wins, decimal point optional on input). The server loads it into the `icd10_chronic` table on reset.
  - `codes.ts`: the condition → readings/symptoms mapping.
  - `mapper.ts`: the fuzzy column mapper (synonyms, phrase containment, Jaro-Winkler, one-to-one assignment).
  - `program.ts`: which program and code a patient qualifies for. `npi.ts`: the NPI check digit.
  - Red-flag rules and reading targets.
  - The keyword parser that turns what a patient says into answers. No LLM is needed.
  - The AI call state machine: identify → disclose → medications → symptoms → ER → readings → needs → close. An urgent answer jumps to the 911/988 line.
- `server/`: Express + better-sqlite3.
  - `service.ts` holds every command. Each runs in a transaction, writes `event` rows, and re-runs billing.
  - `payer.ts` classifies the free-text payer name; `determine.ts` proposes program, tier, confidence and monthly revenue for a roster row.
  - `billing.ts` is the single billing function. It writes every claim line (`month_close.lines`).
  - `carePlan.ts` compiles the care plan from stored rows and builds the approval hash chain.
  - `cms1500.ts` builds the CMS-1500 flat file and runs the pre-flight checks; `ledger.ts` builds the micro-ledger and audit summary.
  - `xlsx.ts` reads and writes Excel files (`read-excel-file`, `write-excel-file`).
  - `note.ts` builds the month-end note from stored rows.
  - `views.ts` computes everything the UI shows: queues, matrix, brief, stepper, profile, billing, notes.
- `src/`: React screens. The client only renders server state and posts commands.
  - `src/components/ui/`: shadcn/ui components built on Radix UI and styled with Tailwind CSS v4. `components.json` is the shadcn config.
  - `src/index.css` holds the theme tokens.
- `seed/`:
  - `october-roster.csv`: the 15 patients as an EHR-style export (headers like `Patient ID`, `Primary Insurance`, `Member ID`, `Dx Codes`; MM/DD/YYYY dates; some codes without decimals). `/api/seed/october-roster.xlsx` serves the same file as Excel.
  - `roster-with-errors.csv` (a sample with rejected rows, using the V1 snake_case headers, which the mapper also understands).
  - `september.json`: active patients' September consent, call setup, September call and October schedule.
  - `october-script.json`: section 5's AI call outcomes and nurse-call lines.

The data model is the nine tables from the brief plus a `demo` key-value table, and (schema 2) `care_plan` and `icd10_chronic`. Extra columns are marked in `server/db.ts`:

- `call`: scheduling, retries and cancellation.
- `flag`: summary, escalation and the acknowledgement deadline.
- `task`: kind, created/closed time and source call.
- `patient`: sex, payer name and member ID, all diagnosis codes, the proposed program, confidence, and the Ops decision.
- `time_entry`: the role (nurse or physician) and the escalation task.
- `month_close`: every claim line, and the physician's complexity mark.

## Decisions in the Ops / Nurse / Physician workflow

- **Billing codes follow CMS.** APCM Level 1 is G0556 (one chronic condition or fewer), Level 2 G0557 (2+), Level 3 G0558 (QMB with 2+). The spec's G0516–G0518 and HCC-based tiers are not used.
- **Coverage.** Traditional Medicare and Medicare Advantage (including dual-eligible plans) qualify for CCM with 2+ conditions. APCM is for traditional Medicare and the practice's participating value-based payers (billing settings); it is not covered under Medicare Advantage. An APCM patient whose roster row moves to Medicare Advantage is paused with a "Switch program to CCM" task.
- **Program proposal.** Traditional Medicare, 2+ conditions, not QMB: the practice setting decides (default CCM). Ops can override per row; the nurse's call setup starts from Ops' choice.
- **Confidence** = payer factor (known name 1.0, keyword 0.75, unknown 0.4) × ICD factor (exact code 1.0, category match 0.9, minus 0.05 when codes were repaired), as 0–100. The reasons are on the badge tooltip.
- **eMRR** = the monthly fee of every approved or active patient at the practice's fee schedule. Pending opportunity is the same for rows to review or held.
- **Care plan gate.** Saving the call setup compiles care plan v(n) and moves the patient to "awaiting care plan approval". No calls are scheduled until the physician approves; billing holds with "care plan not approved". Later setup changes draft a new version while the approved one stays in effect. Each approval stores the NPI, time, version and a SHA-256 hash chained to the patient's previous approval: a tamper-evident record, not encryption. Seeded active patients start with an approved v1 from September.
- **Complex CCM.** 99487 only when the month reaches 60 counted minutes and the physician has marked moderate/high complexity; then one 99489 per further full 30 minutes. Otherwise 99490 at 20 minutes plus one 99439 per further full 20 (two at most). Physician escalation time counts toward the month. Nurse and physician each have their own timer.
- **Care not yet delivered** replaces the spec's "close to milestone" queue. It opens on the 20th and lists what care is missing (contact, monthly reviews, tasks). It never shows minutes to go, in keeping with "No nudges".
- **Consent link.** "Send consent link" puts a text with a fictional link in the outbox (it is a consent request, so it is allowed before text consent). A tester button plays the patient signing; consent method `digital_link`.
- **CMS-1500 export.** Date of service is the last day of the month, so the export opens on that day (Sat 31 Oct in the demo). Pre-flight runs on every ready claim; a claim with any failing line is left out whole (an add-on never ships without its base code) and listed in the exceptions report. Patient strings lose commas, semicolons, tabs and quotes; names keep letters, digits and spaces. Fees for 99439, 99487, 99489 and G0556 are placeholders to verify against the CY2026 fee schedule. 837P and clearinghouse-specific profiles are not built.
- **Audit summary.** The browser extension is not built yet, so the micro-ledger's audit summary is compiled from the event log.

## Decisions made where the brief was silent

- **Compressed AI run and the 30-minute rule.** The run covers 6–13 Oct in one click, so Harold's urgent flag (raised 6 Oct) would already be overdue when the clock lands on 13 Oct. The run therefore re-delivers any unacknowledged urgent alert when it finishes and starts the 30-minute window then. The audit trail says so. Urgent flags raised live (simulator, nurse call) start the window immediately. If nobody acknowledges in time, the physician and practice manager are alerted in the outbox.
- **AI call retries.** An unanswered AI call is retried 2 business days later at the same time, which reproduces W07's 7, 9 and 13 Oct. After 3 tries a nurse task is created. If the consent allows texts, a "we'll try again" text goes to the outbox.
- **Opt-out.** "Stop calling me" revokes consent, cancels all scheduled calls (each patient has this month's and next month's check-in scheduled), creates "Confirm opt-out by phone", and sets the status to opted out.
- **Concerns found on a nurse call.** These create follow-up tasks (for example "Breathing follow-up") but no flag to acknowledge, because the nurse found them herself. Urgent findings on a nurse call still create an urgent flag, marked acknowledged, which she resolves.
- **Billing.** Hold reasons are checked in this order: not enrolled → paused → call setup not finished → care plan not approved → opted out with no service → CCM under 20 counted minutes → APCM with no completed contact → note not filed in EHR → awaiting physician attestation. Anything that passes all of them is ready.
  - A completed contact is any AI or nurse call that reached the patient or caregiver.
  - Counted time is the sum of exact seconds, floored to whole minutes. Only completed nurse calls and timed work count. AI calls, consent calls and unanswered attempts never count.
- **Program changes.** A patient's program can't change mid-month once there is activity under the current program.
- **No nudges.** The UI never shows "minutes to go". It shows the minutes, plus "Meets 20 minutes" once that is true.
- **Nine-step stepper.** The steps are: eligibility and consent, call setup and care plan, monthly contact, flags, EHR chart review, EHR medication review, EHR care plan review, tasks and coordination, note filed and attested.
- **Note format.** Section 6 of the Scope Revision wasn't available, so the note uses a plain-text layout with these sections: header, monthly contact (with answers), flags, care management work, tasks, itemised time log (AI contact shown as not counted), and the program requirement.

## Not built (parked)

Real telephony, real AI voice, anything EHR, the browser extension (DOM scraping, ambient timer, VoIP detection; next round), 837P and clearinghouse-specific export profiles, pharmacy and specialist calls, a 24/7 inbound line, AI consent, AI care plan suggestions (the care plan is compiled from stored rows only), remote monitoring devices, multiple practices, payments, authentication, and Synthea.
