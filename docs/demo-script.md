# Operator demo script

Who it's for: the person who runs care management at an ACO enablement company, MSO, IPA or CCM/APCM vendor. That is usually the VP of Care Operations, the COO, or the clinical lead who owns the nurses.

Length: 12 minutes of demo inside a 30-minute call. Talk for the first 5 minutes, demo for 12, then spend the last 10 on their numbers and the ask.

What a good call ends with: their numbers in the ROI page, a sponsor's name in the pilot plan, and agreement to review a one-page non-binding letter of intent.

Every number below is what a fresh seed shows. Reset before each demo: **More → Reset to seed**. If you also uploaded Westfield's roster, a few counts move by one or two.

## Before the call (15 minutes)

1. Find what you can about their book: APCM and CCM patients, how many client practices, how many nurses, which EHRs. If you don't know, use the defaults and say they are placeholders.
2. Run `npm start` and open `http://localhost:3000`. Share a browser window at least 1,400 px wide.
3. Reset to seed.
4. On **ROI**, put their name in *Operator* and any numbers you know, then **Save**. Their name now shows across the demo.
5. On **Pilot plan**, add the sponsor's name and title, then **Save**.
6. **More → Save checkpoint**, so you can get back here with **Restore checkpoint** if a click goes wrong.
7. Keep the three questions (below) on a sticky note.

## The talk track

### 1. Frame it (1 minute): Dashboard, Ops lead role

**Say:** "This is your operation as Cureloom sees it on Monday 5 October: five client practices, about 218 active patients in APCM and CCM. Everything here is synthetic: no real patients, nothing is dialled. The question this demo answers is how many nurse minutes an APCM patient-month takes when the monthly check-in is automated and your nurses work only the exceptions."

**Point at:**

- The *Synthetic data* pill.
- The hero tile, empty for now, against today's 19.7 minutes at 350 patients per nurse.

### 2. The check-ins (2 minutes): Run October AI check-ins

**Click:** **Run October AI check-ins** in the demo bar.

**Say, from the summary:**

- "141 calls to 104 AI-eligible APCM patients, up to three tries each. 91% were reached, 12 of them by a caregiver."
- "26 patients were routed to a nurse: 13 concerns, 3 urgent, the rest asked for a person, opted out, or weren't reached in three tries."
- "37 unanswered tries were retried automatically, two business days later."

**Point at:**

- The first AI line on any call: *"This is an automated call from Westfield Family Medicine, Dr. Anita Patel's office. This call is recorded."* It goes out in the practice's name, from its number.
- The yellow note: 17 patients at the simulated practices get no AI call, because they don't permit automated calls, prefer a person, or don't speak English. Say plainly: "English only for now. Those patients get a nurse call."

**Then:** close the summary, click **Open patient** on the red banner (Harold Jenkins), and open the transcript.

**Say:** "Chest tightness on the stairs. The AI tells him to call 911, and if he can't, to stay on the line while it connects him to his nurse. It doesn't hang up on him. The nurse has 30 minutes to acknowledge, and the clock is on screen."

### 3. The nurse's day (2 minutes): Nurse role, Today queue

**Click:** **Nurse** in the demo bar. That's Rachel Okafor, RN, who covers Westfield and Oakridge.

**Say:**

- "Rachel has 70 patients. 20 need a person today, in priority order. 31 CCM monthly calls are due: CCM is billed on nurse time, so those are nurse calls by design. Spot-checks of clean AI calls are optional; how many to review is your QA policy. Everyone else's month is done."
- "Without the check-ins, every one of her APCM patients would need a nurse call this month."

**Click:**

1. **Acknowledge** on the red banner. The dashboard will show 3 of 3 urgent alerts acknowledged within 30 minutes.
2. Open Maria Delgado (W02, *Concern*): out of metformin for 3 days, fasting glucose 240 against a 90–130 target.

**Point at:**

- The one-minute brief.
- The step-by-step month.
- The *Billing pre-flight* card on the right: every check this patient-month must pass, live.

### 4. The claims (2 minutes): Ops lead role, Billing pre-flight

**Click:** **Ops lead**, then **Billing pre-flight**, then **Run eligibility check**.

**Say:**

- "18 patients weren't verified for October yet. The check queried each one, and two had changed. Loretta Torres moved to Medicare Advantage on 1 October, so a traditional Medicare claim would be denied. Beverly Campbell lost QMB status, so she bills G0557, not G0558."
- "Below that: Willie Ross is enrolled at two of your client practices. Only one practitioner may bill care management a month, so the later enrollment is held."
- "And 14 patients qualify only on lower-acuity conditions like hyperlipidemia and hypothyroidism. OIG's 2026 CCM audit tested exactly that: whether the conditions put the patient at significant risk. Those claims are held until a clinician writes down why, or takes the patient off the program."

**Ask** question 3 here (below).

### 5. The month (1 minute): Fast-forward October

**Click:** **Fast-forward October**, then **OK**, then **See October 2026 on the dashboard**.

**Say:** "The simulated care team worked the rest of the month at the four simulated practices, then closed it: notes filed, physicians signed. Westfield is untouched; that one's yours to drive."

**Point at the dashboard:**

- **9.2 nurse minutes per APCM patient-month**, against 19.7 today: about half the nurse time.
- **91%** of check-ins completed.
- **52%** of APCM patients needed a nurse for some reason. Only 26 of those were routed by the calls; the rest are the 90-day nurse touches your policy asks for, and patients without AI calls.
- **3 of 3** urgent alerts acknowledged within 30 minutes.
- **$10,910.60** ready to bill: 175 patient-months. 60 are held, each with a reason.
- **Where nurse time went**: CCM calls first, then exceptions, EHR reviews and documentation.
- **Program integrity**: $183.37 caught before submission.

**Say:** "These are synthetic. The answer rates and the minutes are our assumptions. The pilot replaces every one of them with your numbers."

### 6. The evidence (1 minute): Audit packet

**Click:** **Billing pre-flight**. In the status filter pick **Ready**, then click **Audit packet** on any row.

**Point at:**

- Every pre-flight check with its evidence.
- Consent with the four required explanations.
- Each contact with its transcript.
- The time log in exact seconds.
- The filed note, the attestation, and the event trail.

**Click:** **Print or save as PDF**.

**Say:** "When an auditor asks for a patient-month, this is what you send."

### 7. Their numbers (2 minutes): ROI

**Click:** **ROI**. Type in what they told you: APCM patients, patients per nurse, salary.

**Point at:**

- **Break-even**: how many nurse minutes per APCM patient-month Cureloom must save to pay for itself. At the defaults it is 2.9 minutes.
- **Net savings a year** after Cureloom's fees, and the FTE change.
- **The math, line by line**: every formula is visible. Invite them to check it.
- **Where this can be wrong**, out loud:
  - CCM counted time never drops below 20 minutes.
  - If their nurses already carry 600+ APCM patients, the case is thinner.

### 8. The ask (1–2 minutes): Pilot plan

**Click:** **Build the pilot plan**.

**Say:** "Here's what we'd propose: 90 days, 500 APCM patients at two or three of your practices, your nurses. Five targets:

- 60% check-in completion;
- 30% fewer nurse minutes than your own baseline, which we measure in the first two weeks;
- no more than 15% asking to stop AI calls;
- every urgent alert acknowledged within 30 minutes;
- a complete audit packet for every billed month.

The pilot is $2 per patient a month. If it hits the targets, it converts at $4 and expands to your book."

**Ask:** "If the pilot hit those five targets, is there any reason you wouldn't expand? If not, can we put that in a one-page letter of intent? It's non-binding and subject to a BAA and a pilot agreement; your counsel reviews it."

Then **Print or save as PDF** and send it the same day.

## The three questions

Ask them during steps 2–4. The answers decide whether this is a pilot.

1. **"How many APCM patients do you manage, and how many does one nurse carry?"** This is the ROI baseline. Above about 600 APCM patients per nurse, the savings case is weak; say so.
2. **"How does the monthly contact happen today, and in a typical month what share of patients actually need a nurse?"** This tells you their exception rate, whether they already have an AI or dialler vendor, and who makes the calls.
3. **"When did a claim last come back, and why? Who checks eligibility before claims go out?"** This uncovers billing pain: MA switches, QMB, duplicates, documentation. If they have an audit story, the pre-flight and the audit packet are the pitch.

Also find out, before you ask for the LOI:

- who signs;
- whether there is budget this quarter;
- how their BAA and security review work;
- what they are using today.

## Hard questions

**"Is this a real AI voice?"**
No. The demo runs the call flow as a scripted state machine with simulated answers. The pilot runs on a production voice stack. Don't name one until it's chosen.

**"What if the AI misses an urgent symptom?"**
- The AI asks about each red-flag symptom in the patient's call setup, by name.
- A yes to an urgent one gets 911 (or 988), a live-transfer request and an alert to the practice.
- The AI never reassures.
- Concern calls go to the nurse. Clean calls can be spot-checked.
- The pilot target is 100% of urgent alerts acknowledged within 30 minutes, tracked on the dashboard.

**"Our patients won't talk to a robot."**
- They can ask for a person at any time.
- "Prefers a person" is remembered and always honoured.
- The pilot's opt-out target (≤ 15%) tests exactly this, on their patients.

**"Consent for automated calls?"**
The consent script asks for automated calls and texts separately, says what number calls and how to stop. Their compliance team and counsel approve the scripts, the consent language and the calling number in pilot weeks 1–2. Don't give a legal opinion.

**"EHR integration?"**
Not needed for the pilot: the roster comes in as a CSV and the note goes out as text the nurse pastes. Integrations come later, one EHR at a time.

**"We already use an AI vendor, or we're building one."**
Ask what their nurse minutes per APCM patient-month are today. Offer to run the pilot against that baseline. The difference to point at: the exception queue, the billing pre-flight and the audit packet run as one workflow, across every client practice.

**"Price?"**
- The demo uses $4 per APCM patient a month and $2 per CCM patient a month, with the pilot at $2.
- If they ask for per-completed-call pricing, say you'll look at it. Fees tied to billed services need counsel's review first.

**"Security, HIPAA?"**
A BAA at pilot start, and their security questionnaire answered. The demo holds no PHI.

## What not to say

- Don't present synthetic numbers as results. Say "in this simulation", or "your pilot measures that".
- Don't claim HIPAA compliance, a certification, clinical validation, or that the AI is approved by anyone.
- Don't promise billing outcomes or give coding or legal advice. The practice's biller and their counsel decide.
- Don't name customers, partners or advisers you don't have.

## After the call

Send within a day:

> Subject: Pilot plan: AI check-ins for [operator]
>
> [Name], thanks for the time today. Attached is the pilot plan we walked through: 90 days, [cohort] APCM patients at [practices], five targets, $[price] per patient a month, converting at $[price] if the targets are met.
>
> The last page is a one-page letter of intent. It's non-binding and subject to a BAA and a pilot agreement, so your counsel will want to see it. If it looks right, could you sign it by [date] so we can start set-up on [start date]?
>
> Happy to walk your compliance team through the call scripts and the consent language before then.

Then work the **Before you ask for the LOI** checklist on the pilot plan page, and log their answers to the three questions.

## Optional extras

Use these if they ask, or if there's time.

- **Play a call yourself.** Go to **AI call simulator**, pick a Westfield APCM patient and answer as the patient. Say "stop calling me" to see an opt-out, or "I have chest pain" to see the urgent path.
- **Roster upload.** On **Roster**, choose **Upload the October roster**. Then try `roster-with-errors.csv` to see rejected rows with reasons.
- **Finish Westfield by hand.**
  1. As the Nurse, work the queue and use the timers.
  2. In **Month end**, file the notes.
  3. As the Physician, sign on **Attestation**.
  4. Open the pre-flight: Westfield's ready claims appear.
- **Document a risk basis.** Open a patient held for *risk basis not documented*. As the Nurse, write the basis on the patient page; the claim clears on the next check.
