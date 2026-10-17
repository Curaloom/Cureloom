# Cureloom workflow

This is the workflow reference for the Cureloom V1 prototype. It covers what each person does during the month, what the system does by itself, and the rules behind what the screens show. The screens carry very little explanation, so the explanation is kept here.

> **Ops, nurse and physician workflow.** Sections 2 and 3 describe the current flow. The detailed rules in sections 4 (roster upload, eligibility), 5 (Today queue) and 12 (billing) still describe V1. Where they differ, the README's "Decisions in the Ops / Nurse / Physician workflow" section is current. Those rules cover:
> - the column mapper and opportunity matrix;
> - Medicare Advantage for CCM, and APCM Levels 1–3 (G0556/G0557/G0558);
> - the four nurse queues, care plan approval and physician escalations;
> - complex CCM and 99439;
> - the CMS-1500 export.

## 1. What this prototype is

Cureloom V1 is a clickable prototype of one simulated month (October 2026) of care management at one fictional practice, Westfield Family Medicine. It covers two Medicare programs: Chronic Care Management (CCM) and Advanced Primary Care Management (APCM). A nurse, physician or practice manager can walk through the month and judge whether the workflow makes sense. All patients and data are hand-made and fictional, and every phone number is a fictional +1 555 01XX number. Nothing is ever dialled, texted or sent to an EHR. Calls play out on screen, messages land in the Outbox, and notes are copied into the EHR by hand.

## 2. Roles

There is no login. Use the role switcher to change role at any time. If an action belongs to another role, it is disabled or refused with a message naming the role to switch to.

| Role | Person | Home screen | Other screens | Main jobs |
|---|---|---|---|---|
| Nurse | Rachel Okafor, RN | Today queue | Enroll, All patients, Month end | Consent calls, call setup, nurse calls, timed work, tasks, flags, escalation, month-end notes |
| Physician | Dr. Anita Patel | Care plans & escalations | Attestation, All patients, Billing reconciliation | Approve care plans, work escalations (timed), mark complex months, sign the monthly attestation |
| Practice manager (Ops) | Dana Brooks | Roster & opportunity | Billing reconciliation, Enroll, All patients | Upload the EHR export, approve the cohort in the opportunity matrix, reconcile billing, export the CMS-1500 file |

Every role can open the three tester screens: the AI call simulator, the Audit trail and the Outbox. **All patients** lists everyone on this month's roster, with their status, program, contact this month, counted minutes and billing status.

## 3. The month at a glance

1. The practice manager uploads the EHR export (CSV or Excel) and confirms the proposed column mapping.
2. The system proposes a program and tier for each patient with a confidence score and monthly value. The practice manager approves, holds or rejects each row in the opportunity matrix.
3. Consent is recorded. It arrives in the roster from the office visit, or the nurse sends a consent link or takes it by phone.
4. The nurse fills in each patient's call setup: program, readings, symptoms to watch and targets. Saving compiles a care plan.
5. The physician approves the care plan, which starts the program and schedules the calls.
6. The monthly contact happens. APCM patients get an AI check-in call. CCM patients get a nurse call, as does anyone the AI cannot or should not call.
7. Concerns and urgent answers become flags and tasks on the nurse's Today queue (four tabs: consent pending, care not yet delivered, clinical urgency, pending steps). An urgent flag must be acknowledged within 30 minutes.
8. The nurse does the care management work and times it: EHR reviews, coordination, education and documentation. Anything that needs the physician is escalated; the physician's review is timed too, and the physician can mark the month as complex.
9. At month end the system drafts a note for each patient. The nurse reviews it, copies it into the EHR and marks it filed.
10. The physician signs one attestation that covers every filed note.
11. Billing reconciliation shows every claim line, who is ready to bill and why everyone else is held. From the date of service (the last day of the month) it exports a pre-flight-checked CMS-1500 file.

## 4. Enrollment

The Enroll screen groups new patients by what they need next: awaiting practice confirmation, confirmed with no consent yet, consented with no call setup yet, not eligible, and paused or opted out. Once call setup is saved, the patient is active and moves to the Today queue.

### Roster upload

The roster comes from the EHR as a CSV, but nothing connects to the EHR. The required columns are `mrn`, `first_name`, `last_name`, `dob`, `phone`, `coverage`, `icd10_codes` and `last_visit_date`. The optional columns are `state`, `is_qmb`, `caregiver_name`, `caregiver_phone`, `preferred_language`, and the consent columns `consent_date`, `consent_method`, `automated_calls_ok` and `texts_ok`.

A row is rejected, with the reason shown, when the MRN is missing or appears twice, a name is missing, the date of birth is invalid or in the future, a phone number is not a fictional 555-01XX number, coverage is not traditional or advantage, `is_qmb` is not yes or no, a code is not shaped like an ICD-10 code, or a date or consent field is malformed. Rejected rows can be downloaded as an error list CSV.

Uploading a roster again updates existing patients. If an enrolled patient no longer qualifies (for example, they switched to Medicare Advantage), they are paused, their scheduled calls are cancelled and the nurse is alerted.

### Eligibility

The system flags a patient as eligible when all three of these hold:

- they have **traditional Medicare** (Medicare Advantage is not eligible)
- they have **2 or more qualifying chronic-condition codes**
- they had **a visit in the last 12 months** (otherwise the status is "needs a visit")

An eligible patient waits for the practice manager to confirm with one click. The system never enrolls anyone by itself.

### Consent

Consent is usually taken at the office visit and arrives in the roster. After confirmation, those patients go straight to call setup. For everyone else, the nurse opens the consent script and calls the patient.

The script starts with an introduction (who is calling, from Dr. Patel's office, and what the program offers). Then come four items. The nurse must explain and tick all four before she can record that the patient agrees:

1. **Availability.** The patient can reach the practice day or night through the after-hours line, and the practice checks in every month.
2. **Cost sharing.** Medicare covers the service, but coinsurance or a deductible may apply, usually about 20% of the monthly fee. Supplemental insurance may cover it.
3. **One practitioner.** Only one practitioner can bill for the service each month, so Dr. Patel's office is the one providing it.
4. **Right to stop.** The patient can stop at any time by telling the practice. Stopping takes effect at the end of the month.

Two permissions follow. Each one is optional:

- **Automated calls.** The monthly check-in may be an automated, recorded call from the practice number (+1 555 0100) that asks a few health questions. The patient can ask for a nurse at any time, or say "stop calling me" to end these calls.
- **Texts.** The practice may send text reminders. The patient replies STOP to end them.

The nurse starts the consent call timer, reads the script, and records one of three results: agrees, declines, or call back later. **The consent call is logged but never counted** toward care management time.

### Call setup

The setup is prefilled from the patient's qualifying conditions, and every choice can be changed. Readings that match a condition are marked as matching.

| Condition | Readings asked | Symptoms watched |
|---|---|---|
| Hypertension | Blood pressure | Chest pain, stroke warning signs |
| Heart failure | Weight | Chest pain, severe shortness of breath, fainting, rapid weight gain, leg swelling |
| Type 2 diabetes | Fasting glucose | Low blood sugar spells |
| COPD | Oxygen saturation | Severe shortness of breath, rescue inhaler use |
| Atrial fibrillation | — | Stroke warning signs, fainting, racing heartbeat |
| Chronic kidney disease | — | Leg swelling |
| Depression | — | Thoughts of self-harm, low mood |
| Dementia | — | Falls, confusion |
| Osteoporosis, osteoarthritis | — | Falls |
| Hyperlipidemia, coronary artery disease | — | Chest pain |
| Asthma | — | Severe shortness of breath, rescue inhaler use |

Each symptom is a red-flag rule. Urgent rules are always asked first.

| Symptom | Level | Result |
|---|---|---|
| Chest pain, pressure or tightness | Urgent | Told to call 911 |
| Severe shortness of breath (hard to talk or lie flat) | Urgent | Told to call 911 |
| Stroke warning signs | Urgent | Told to call 911 |
| Fainting | Urgent | Told to call 911 |
| Thoughts of self-harm | Urgent | Told to call or text 988 |
| More rescue inhaler use | Concern | Breathing follow-up task |
| Rapid weight gain (3 lb in a day or 5 lb in a week) | Concern | Fluid and weight follow-up task |
| Leg or ankle swelling | Concern | Fluid and weight follow-up task |
| Racing or irregular heartbeat | Concern | Heart rhythm follow-up task |
| Possible low blood sugar spells | Concern | Low blood sugar follow-up task |
| Low mood | Concern | Mood follow-up task |
| New or worse confusion | Concern | Memory and safety follow-up task |
| Fall | Concern | Fall follow-up task |

Reading targets have defaults that the nurse can edit for each patient. A reading outside its target shows as "above target" or "below target" in the brief. It raises a concern only past the thresholds in the last column.

| Reading | Default target | Concern raised when |
|---|---|---|
| Blood pressure | Below 140/90 | Systolic 160 or more, diastolic 100 or more, or systolic below 90 |
| Fasting glucose | 90–130 mg/dL | Any value above 180 or below 70 |
| Weight | Dry weight (lb), with a 5 lb gain limit | Gain of the limit or more over dry weight (only when a dry weight is set) |
| Oxygen saturation | 92% or higher | Below the target |

Other answers can also raise a concern. Missed or stopped medicines create a refill task named after the medicine, or a medication follow-up task. An ER or hospital visit creates a transition follow-up task, with contact due within 2 business days. Requests for a refill, an appointment or a nurse call create request tasks but are not concerns. A reported medication change is only noted.

The setup also records the **last EHR care plan review date**, which defaults to the last visit date.

**Program choice:**

| Program | Code | Monthly contact | Billing rule |
|---|---|---|---|
| CCM | 99490 | The nurse makes the monthly call | Billed only with 20 real staff minutes in the month |
| APCM | G0557, or G0558 for a QMB patient | The AI makes the monthly check-in call | No time rule; needs a completed contact |

If the consent has no automated-call permission, an APCM patient's monthly call becomes a nurse task ("Nurse check-in call").

Saving the setup makes the patient active and schedules the first contact. For CCM, the monthly nurse call is due immediately. For APCM, the AI check-in is booked for 10:00 on the next business day. Each patient also has next month's call booked for the same day of the month, moved to a business day if needed. The setup can be edited later. The program cannot change mid-month once there is activity under the current program.

## 5. The Today queue

The queue is the nurse's home screen. It lists the active, paused and opted-out patients who need something, one row per patient, under the most pressing reason. Rows are ordered by category, then by acknowledgement deadline, then by MRN. Each row shows the patient's counted minutes this month.

| Order | Category | Meaning |
|---|---|---|
| 1 | Urgent | An urgent flag is open. Until acknowledged, the row shows the 30-minute countdown. After that it reads "acknowledged, resolve when handled". |
| 2 | Concern | A concern flag from an AI call is open. The row shows which call and what was found. |
| 3 | Not reached | The AI tried 3 times with no answer, and a nurse call task is open. The row lists the dates tried. |
| 4 | CCM call due | A CCM patient's monthly nurse call is due today or earlier. |
| 5 | Open tasks | The patient has open tasks, which are listed. |
| 6 | Quick review | An AI call reached the patient with no concerns, and the nurse has not marked it reviewed yet. |

Opening a row goes to that patient's month.

## 6. The patient month

The header shows demographics, phone, coverage (and QMB), caregiver, status, program, a **Prefers a human** setting and a link to the patient's audit trail. Patients who want a human always get a nurse call (see section 7).

### One-minute brief

- **Last month:** a summary of last month's call.
- **This month:** the completed contact, or "no completed contact yet" with any unanswered tries and the next scheduled call.
- **AI call** (APCM only): one line for each AI call this month.
- **Readings:** the latest value of each reading this month, with its target and whether it is in range, above or below.
- **Flags:** each flag and its state (not acknowledged, acknowledged but not resolved, or resolved).
- **Open tasks:** each open task with its due date.

### The nine steps

Each step shows as done, open, needing attention or not applicable, with a detail line and the actions for that step.

| # | Step | Done when | Actions |
|---|---|---|---|
| 1 | Eligibility and consent | Consent is on file. Revoked consent needs attention. | Open the consent script |
| 2 | Call setup | The setup is saved | Fill or edit the call setup |
| 3 | Monthly contact | An AI or nurse call reached the patient or caregiver this month | Start or return to a nurse call; mark a completed AI call reviewed |
| 4 | Flags | Every flag raised this month is resolved. Any open flag needs attention. | Acknowledge; resolve with a note |
| 5 | EHR chart review | A timed chart review is saved this month | Working-in-EHR timer |
| 6 | EHR medication review | A timed medication review is saved this month | Working-in-EHR timer |
| 7 | EHR care plan review | A timed care plan review is saved this month. Saving one also updates the last care plan review date. | Working-in-EHR timer |
| 8 | Tasks and coordination | No tasks are open. Coordination minutes are shown. | Coordination timer |
| 9 | Note filed and attested | The physician has attested the filed note | Open the month-end note |

### Timers and counted time

Time comes only from timers. Timers record exact seconds, and the month's total is floored to whole minutes. **Minutes cannot be entered by hand.** Only one timer runs at a time across the whole app, and a running timer stays visible on other screens with a link back to it. Time is logged only once the patient is enrolled. To stop a timer, the nurse picks an outcome and saves it, or discards it, which logs nothing. Stopping a timer moves the demo clock forward to when the work ended.

| Activity | Counts | Outcomes to choose from |
|---|---|---|
| EHR chart review | Yes | No changes needed; findings noted for care plan; follow-up needed |
| EHR medication review | Yes | No discrepancies; discrepancy found, change requested; discrepancy found, resolved; medication list updated |
| EHR care plan review | Yes | Care plan current; care plan updated; update requested from physician |
| Care coordination | Yes | Pharmacy contacted; specialist office contacted; appointment arranged; home health or community service arranged; other |
| Patient education | Yes | Self-management; medication; caregiver |
| Documentation | Yes | Documentation completed |
| Nurse call, completed | Yes | Set when the call ends |
| Nurse call, no answer or declined | No: logged with 0 counted minutes | Set when the call ends |
| Consent call | No | Agreed; declined; call back later |
| AI check-in call | No: shown in the note's time log, never counted | Automatic |

The minutes panel shows counted minutes and the exact seconds behind them. For a CCM patient it adds "Meets 20 minutes" once that is true. The screen never shows "minutes to go".

### Tasks

Calls create tasks automatically (see sections 7 and 8), and the nurse can add her own with a title and a due date. The due date defaults to the next business day, and two open tasks cannot share a title. The nurse closes tasks. The physician can also close physician-review tasks. A call task can be started from the task itself, and completing a nurse call closes the patient's open call tasks.

### Escalation to the physician

The nurse writes what Dr. Patel should review and sends it. This creates a physician-review task due the next business day, puts an alert in the Outbox and adds an entry to the audit trail. The request then appears on the physician's Attestation screen until she marks it reviewed.

## 7. AI check-in calls (APCM)

The AI calls a patient only when the patient is active and in APCM, their consent is active and includes automated-call permission, their call setup is filled in, and they are not marked as preferring a human. For anyone else, the monthly call is a nurse task.

The AI asks only scripted questions, in this order:

1. **Ring.** If there is no answer after 6 rings, the call ends without leaving a voicemail.
2. **Disclosure.** The first words on every connected call are: *"This is an automated call from Westfield Family Medicine, Dr. Anita Patel's office. This call is recorded."*
3. **Identify.** The AI asks whether it is speaking with the patient or with someone who helps with their care. A caregiver can answer if one is on file, and the questions are then phrased about the patient. A wrong number ends the call and counts as an unanswered try.
4. **Purpose.** This is the monthly check-in and takes about three minutes. The person can ask for a nurse at any time, or say "stop calling me". The AI asks whether now is a good time.
5. **Medications.** Is the patient taking them as prescribed, or has any run out or been stopped?
6. **Watched symptoms,** urgent ones first.
7. **ER or hospital** since the last check-in.
8. **Readings,** one question for each reading in the setup.
9. **Needs.** A refill, an appointment, or a call from the nurse.
10. **Close.** The nurse will review the call. If anything gets worse, call the office or, in an emergency, 911.

**Keyword parsing.** Plain keyword rules turn the answers into structured fields. No LLM is involved. A yes or no answers the question being asked. Details mentioned in passing (for example "I ran out of metformin" or "my sugar was 190") fill the matching fields but never override an explicit answer. Readings are taken from the numbers spoken, such as "150 over 95" or "weighed 182".

**Routing.** What happens next depends on the answers:

- A **concern:** for a symptom, medicine or ER answer, the AI says the nurse will see it today and carries on. After the call, all concerns (including readings past the thresholds) become one concern flag on the nurse's queue with an Outbox alert, and the matching follow-up tasks are created.
- An **urgent answer:** the call ends at once. The AI tells the person to hang up and call 911 now. For thoughts of self-harm, it tells them to call or text 988 (the Suicide and Crisis Lifeline), or 911 if in danger. It says the nurse and Dr. Patel's office are being alerted. The result is an urgent flag (see section 9).
- **No concerns:** the call goes to the nurse's queue as a quick review until she marks it reviewed.

**What happens after each kind of ending:**

| Ending | What follows |
|---|---|
| No answer or wrong person | The AI retries **2 business days later** at the same time. If the consent allows texts, the patient gets a "we'll try again" text naming the next day. After **3 tries**, a "Not reached after 3 tries — nurse call" task is created and the patient moves to Not reached on the queue. |
| Call back later | The AI retries the next business day at the same time. This does not count as an unanswered try. |
| Asks for a nurse or a person | The patient is marked as preferring a human, their AI calls are cancelled and a "Nurse call requested" task is created. |
| "Stop calling me" (at any point) | Opt-out (see below). |
| Urgent answer | Urgent flag, alerts, and the 30-minute acknowledgement window. |
| Completed | Concerns become a flag and tasks. Requests become tasks. |

Business days are Monday to Friday. There is no holiday calendar.

**Opt-out.** "Stop calling me" works on an AI call or on a nurse call. It does four things:

- revokes consent that day
- cancels every scheduled call (each patient has this month's and next month's check-in booked)
- creates a "Confirm opt-out by phone" task
- sets the status to opted out

The AI tells the patient a nurse will call once to confirm. An opted-out patient can still be billed for the month if the service was delivered: for APCM, a completed contact before the stop; for CCM, 20 counted minutes.

**Patients who prefer a human.** The nurse can set Prefers a human on the patient month. For an active APCM patient, this cancels the scheduled AI calls and creates a "Nurse check-in call" task, unless the month's contact has already happened. If the nurse clears the setting and there has been no contact yet, the AI check-in is booked again for 10:00 the next business day.

AI talk time is recorded on the call and shown in the note's time log as not counted. It never counts toward minutes.

## 8. Nurse calls (CCM and fallbacks)

The nurse calls CCM patients every month. She also calls any APCM patient the AI could not reach, should not call, or who asked for a person. A nurse call can be started from the Monthly contact step or from a call task. It needs a filled call setup, and it starts the nurse-call timer.

**Script steps,** in order: Opening, How are things, Medications, one step for each watched symptom, ER or hospital, one step for each reading, Needs, Close. The nurse asks a question by selecting it, then records the reply in one of three ways:

- pick the patient's line from the October seed script (where one exists) or a plain default reply
- type what the person said
- play the rest of the script automatically

When a caregiver is on file, she marks whether the patient or the caregiver is speaking. The live transcript is simulated, and nothing is dialled.

**Answers panel.** The same keyword rules as the AI fill this panel live: medications, any medication change, each watched symptom, ER or hospital, each reading against its target, and requests. The panel lists findings as they appear, with the overall level. When the level is urgent, it reminds the nurse to tell the patient to call 911 now, or 988 for thoughts of self-harm.

**Outcomes.** When she ends the call, the nurse picks Completed (reached the patient or caregiver), No answer, or Reached but declined. She can add an optional nurse note, such as "called 911, taken to ER", which goes into the month-end note. The result screen shows the outcome and duration, whether the time counted, the drafted note section for this call, the tasks the call created, and the transcript.

**What counts and what follows:**

- **A completed call** counts in full. Concerns create follow-up tasks but no flag to acknowledge, because the nurse found them herself. An urgent finding creates an urgent flag that is already marked acknowledged by the nurse, and she resolves it with a note. The patient's open call tasks are closed.
- **No answer or declined** is logged with its duration but **0 counted minutes**. For a CCM patient, the monthly call stays due.

## 9. Flags and the 30-minute acknowledgement window

A flag is either a **concern** or **urgent**.

- **Concern flags** come from AI calls. They go to the nurse's queue with an Outbox alert and have no deadline.
- **Urgent flags** alert the nurse on screen and alert the practice front desk and the practice manager through the Outbox. A red banner then shows on every screen until the flag is resolved. For a flag raised by an AI call, the **30-minute acknowledgement window** starts when the flag is raised, and the banner and queue show the countdown. A flag raised on a nurse call is already acknowledged by the nurse.

Only the **nurse acknowledges** flags, from the banner or the patient's Flags step. Other roles see that the nurse acknowledges. The audit trail records how many minutes she had to spare, or how late she was.

If nobody acknowledges within 30 minutes, the system logs it and alerts the **physician and the practice manager** in the Outbox, once per flag. The countdown then shows how long the flag has been overdue.

To **resolve** a flag, the nurse writes a note saying how it was resolved (for example "called 911, taken to ER"). Resolving acknowledges the flag too, if that has not happened yet. The resolution note appears in the month-end note and on the physician's Attestation screen.

**The compressed AI run.** "Run October AI calls" plays 6–13 Oct in one click. A flag raised on 6 Oct would therefore already be overdue when the clock lands on 13 Oct. To handle this, the run re-delivers each unacknowledged urgent alert that went overdue during the run when it finishes, and starts a fresh 30-minute window from then. The audit trail says so. An urgent flag raised live in the simulator starts its window immediately.

## 10. Month end

Every active patient gets a note. So does any opted-out or paused patient with activity this month: calls, timed work or tasks. The system drafts each note from logged activity, and nothing is typed from scratch. The draft has these sections:

- **Header:** patient, program and code, qualifying conditions, consent and permissions, caregiver, last care plan review
- **Monthly contact:** each call with its answers. AI calls are marked automated and not counted. Nurse notes are included.
- **Flags:** with raised, acknowledged and resolved times and the resolution note
- **Care management work:** the timed EHR reviews, coordination, education and documentation
- **Tasks:** done and open
- **Time log:** every entry in exact seconds, whether it counted (and why not), and the counted total floored to minutes
- **Program requirement:** for CCM, whether 20 minutes were met; for APCM, whether there was a completed contact

The steps for each patient:

1. **Read and edit.** Before filing, the nurse can edit the text and save her edits, or go back to the system draft.
2. **Copy** the note to the clipboard and paste it into the EHR. The copy is logged. If the browser blocks the clipboard, she selects the text and copies it by hand.
3. **Mark filed in EHR.** The screen moves on to the next unfiled patient.

A filed note is read-only. If time, calls, tasks or flags change after filing, the note shows **new activity since filing**, and the nurse re-files an updated note. Re-filing after the physician has signed clears that attestation, so the physician must sign again.

Drafts exist before month end and update as work is logged. Each patient's note shows as Draft, Edited or Filed, next to their minutes and billing status.

## 11. Attestation

The physician signs after the nurse files the notes. The Attestation screen shows:

- **Urgent flags this month,** each with its raised, acknowledged and resolved times and the resolution note. A flag never acknowledged is marked as such, and an unresolved one as open.
- **Escalations,** meaning the open physician-review requests. Marking one reviewed closes the task.
- **Notes and patients to bill:** how many notes are filed out of the total, with a warning that **patients whose notes are not filed are not covered by the signature**. For each filed note awaiting signature, it shows the program and code with the amount after signing, or the reason the patient would still be held.
- **The attestation text:** *"I attest that, for October 2026, the care management services documented in the notes filed for the patients listed were furnished by clinical staff of Westfield Family Medicine under my general supervision and in line with each patient's care plan; that I am the one billing practitioner for these services this month; and that CCM time was counted from clinical staff activity only, with automated (AI) contact never counted."*

Only the physician can sign. Signing covers every note that is filed and not yet attested at that moment. Notes filed later need another signature. Each signature is listed with its time and patient count.

## 12. Billing

The billing list is recalculated after every change. A patient is **Ready** only when three things are true:

- the **program rule is met**
- the **note is filed in the EHR**
- the **physician has attested** it

Otherwise the patient is **Held** with the first reason that applies, checked in this order:

| Check | Held reason |
|---|---|
| Not enrolled (awaiting confirmation, no consent, not eligible, needs a visit) | Shown as Not enrolled |
| Paused | Paused, with the reason (for example, now Medicare Advantage) |
| No call setup yet | Call setup not finished |
| Opted out with no service before the stop | Opted out, no service |
| CCM with under 20 counted minutes | Under 20 minutes, with the count |
| APCM with no completed contact | No completed contact |
| Note not filed | Note not filed in EHR |
| Not signed | Awaiting physician attestation |

A completed contact is an AI or nurse call this month that reached the patient or caregiver. That includes an urgent call that ended early.

| Code | Description | Fee |
|---|---|---|
| 99490 | CCM, first 20 minutes of clinical staff time | $66.13 |
| G0557 | APCM, 2+ chronic conditions | $53.78 |
| G0558 | APCM, QMB with 2+ chronic conditions | $117.24 |

The list has two parts. The summary groups patients by status (Ready by code, Held by reason, Not enrolled) with their MRNs and the total ready. The full list has a row for every patient: code, amount, status, reason and counted minutes. **Download CSV** exports the month (`billing-2026-10.csv`) with the columns mrn, patient, program, code, amount, status, reason and counted_minutes, plus a total-ready line. Each change in a patient's billing status is logged in the audit trail.

## 13. Audit trail and Outbox

**Audit trail.** Every change writes an event, in the order it happened. Each event records the demo time, the actor, the patient, an event type (such as `flag.raised`, `call.ai`, `time.logged` or `billing.status`) and a plain-language detail. The actor is a staff member, the AI caller, the System, or the Tester for demo actions such as clock moves, runs, checkpoints and resets. The trail can be filtered by patient and by event type, and each patient month links to that patient's trail.

**Outbox.** The Outbox lists the alerts and texts the system would send, newest first. Nothing is sent: no phone calls and no texts. It holds:

- urgent-flag alerts to the nurse (on screen) and to the front desk and practice manager
- concern alerts to the nurse's queue
- alerts to the physician and practice manager when an urgent flag goes 30 minutes without acknowledgement
- escalation alerts to the physician
- alerts when the roster pauses a patient
- "we'll try again" texts after an unanswered AI call, when the consent allows texts

## 14. Simulation controls (for testers)

The simulation controls are in the **Simulation** panel, which opens from the header.

| Control | What it does |
|---|---|
| Demo clock | Starts **Mon 5 Oct 2026 09:00**. While the app is open, time ticks in real time, and idle time **stops at 18:00** each day. The clock only moves forward, and the clock controls are refused while a timer is running. |
| +1 day | Moves to the next day at **09:00**. |
| Go to date | Picks any later date up to 31 Oct. The day starts at 09:00. |
| Jump to month end | Goes to **Fri 30 Oct 14:00**, the last business day. |
| 1 s = 1 min | On by default. While a timer runs, each real second records one minute. A timer keeps the speed it started with. Turn this off for real-time timers. |
| Run October AI calls | Plays every APCM patient's scripted October outcome, **6–13 Oct, in date order**, including retries. The clock moves to the last call. Unacknowledged urgent alerts are re-delivered at the end, with a fresh 30-minute window (section 9). Patients the AI may not call are skipped and get a nurse task. A summary lists every call: when, patient, outcome, flag, what happened and the AI's first line. |
| Save checkpoint | Snapshots the whole demo state, including the demo time. A timer cannot be running. |
| Restore checkpoint | Returns to the saved snapshot and discards everything done since. |
| Reset to seed | Clears everything and returns to Mon 5 Oct 2026 09:00. Ten patients are already active from September, each with consent, call setup, a September call and an October call scheduled. The October roster is not uploaded yet, and the speed returns to 1 s = 1 min. |

**Checkpoints and walkthrough 11.** Walkthrough 11 needs a reset in the middle of the sequence. Save a checkpoint after walkthrough 10, reset and run 11, then restore the checkpoint and carry on with 12.

**AI call simulator.** On this screen you play the patient. Pick an APCM patient (anyone the AI may not call is listed with the reason), start the call and answer each question. You can use the quick answers (pick up or no answer; patient, caregiver or wrong number; yes, no, wants a nurse, "stop calling me", call back later) or type what the person says. The AI uses the same script, disclosure, keyword rules, routing and retries as the batch run. The finished call is saved at the current demo time exactly like a real one, and nothing is dialled. The same screen can also run the October batch and shows its last summary.

**Seed roster files.** Two sample files are available from the Roster upload screen, and only the practice manager can upload:

- **`october-roster.csv`** holds the 15 October patients. It can also be uploaded directly in one step.
- **`roster-with-errors.csv`** is a short sample in which most rows are rejected, showing the error list. The rejected rows have an invalid date of birth, a real-looking phone number, a missing MRN, an unknown coverage type and a code that is not ICD-10.
