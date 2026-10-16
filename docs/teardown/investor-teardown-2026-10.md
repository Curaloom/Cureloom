# Cureloom: seed investment teardown (16 October 2026)

**PASS.**

*Labels: **[V]** verified, source in §10 · **[F]** founders' claim · **[A]** my assumption · **[NV]** not verified this session · **[Repo]** taken from the prototype code. "Verified" means confirmed in search-result extracts of the cited page. Full pages could not be fetched from this environment, and the search budget ran out before every item was checked (the open items are listed in §10). The model is in `docs/teardown/ue_model.py` and `docs/teardown/sens.py`.*

## 1. Decision, main reason, flip conditions

**The main reason.** This is a nurse-staffing company pitched as an AI company, and the AI doesn't carry the margin. Medicare's billing rules decide where software can replace people, and in both of your programs they work against you.

- **CCM (54% of the patients in your own model).** Medicare pays for 20 minutes of human time. AI can only trim the uncounted minutes around those 20. At market wages and realistic caseloads, each CCM patient costs $28–38 a month to serve, against $25.92 of net fee [A].
- **APCM (no time rule).** The margin rests on one nurse covering 1,400 patients, which is 5–7 minutes of human attention per patient per month. Nobody has measured that. At 600 patients per nurse, gross margin is 20% and a practice takes 56 months to pay back what it cost to acquire [A].

Meanwhile the buyer can't see "fewer humans." The practice sees the same "Medicare revenue without hiring" offer ChartSpan has made for a decade, at about the same net to the practice [V: ChartSpan marketing]. It comes from a company with no customers, no clinician, and no founder confirmed to be in the US.

**What would have to be true to flip this decision** (each measurable within six months):
1. **Paying demand.** At least 3 independent practices signed at ≥$27 per patient per month (PPPM) for APCM. At least 1 has been live for 90 days, and at least 1 previously turned down an incumbent and can say why it chose you.
2. **Enrollment.** At least 30% of eligible traditional-Medicare patients consented within 120 days of go-live, at ≤$25 of consent cost per enrolled patient.
3. **AI acceptance.** Across at least 200 consented patients aged 75+, at least 65% complete the monthly AI check-in within three attempts, and no more than 15% ask to stop AI calls or switch to a human.
4. **Nurse capacity.** At least 850–900 APCM patients per RN FTE for two consecutive months, with zero missed urgent escalations and a ≥95% pass rate on an independent chart-and-billing audit.
5. **Economics.** Measured APCM gross margin ≥40%, CAC ≤$8k per practice, payback ≤18 months.
6. **Team.** One founder physically in the US with work authorization before the batch. A US-based clinical-operations co-founder with ≥10% equity, who has run a CCM/APCM, home-health or practice nursing operation. A signed medical director. Malpractice and tech E&O cover bound.
7. **Policy.** The CY2027 final rule (due about 1 November) does not extend the direct-employment rule to CCM/APCM and does not add a contact or time requirement to APCM. The conversion-factor cut stays near the proposed −1.68%.

For the pivot in §7, one result alone would get a second meeting: **two paid pilots with care-management operators at ≥$4 PPPM for the software alone.**

**What I don't know that could change this verdict:**
- **Where the technical founder lives, and whether they can work in the US.** If they are US-based with work authorization, F2 drops from fatal to serious.
- **Warm access to practices** (a physician relative, a billing company, an IPA). That could halve CAC and get a pilot live in 60 days.
- **2025 APCM claim counts.** CMS has 2025 utilization data behind the CY2027 proposal; I couldn't open it. If small independent practices already bill APCM at scale, incumbents have captured it. If they barely bill it, the barrier is compliance and quality reporting, which your no-integration design doesn't touch.
- **Any measured nurse minutes per APCM patient-month** from a real operation.
- **Counsel's view on per-enrolled-patient pricing.** If the fee must be a fixed per-practice amount, pricing gets harder.
- **The CY2027 final rule.**
- **Whether both founders are full-time, and how much runway they have.**

**Should you drop it?** Drop the done-for-you services business, but keep its one real insight. APCM pays less than CCM and has no time rule, so whoever employs the nurses must cut cost per patient-month. Sell that as software to the operators who already employ the nurses and own the practice relationships (§7). If neither founder can be in the US by mid-2027, and you can't recruit a US clinical operator within 90 days, drop US care delivery entirely. Software sold to US operators is the only version of this company the current team can run from where it sits.

## 2. Fatal, serious and fixable flaws

### FATAL

**F1. CCM at a $27 flat fee loses money on every patient.**
- **Your number is too low.** Your $18.91 cost at 380 patients per nurse implies $18.91 × 380 = $7,186 a month, or **$86.2k a year fully loaded**. At a 27% load that is about $68k base [F→A]. The BLS May 2024 median RN wage is $93,600 [NV].
- **Your caseload doesn't fit in the month.** 380 patients × 20 billed minutes is 127 hours of countable time out of 173 paid hours. That leaves 46 hours for PTO, holidays, training, failed dials, logging into a dozen EHRs, uncounted documentation and escalations.
- **My rebuild [A].**
  - Productive time is 114.8 hours a month, after 8% PTO, 10% admin and 80% occupancy.
  - Nurse time averages 23.6 minutes per enrolled patient-month. That blends 80% of patients billed at about 24 counted plus 3 uncounted minutes, and 20% unbilled who still take about 10 minutes of attempts.
  - That gives about **300 patients per nurse**, not 380.
  - An RN at $90k × 1.27 costs $9,525 a month, which is **$31.75 per patient-month in nurse cost alone**. Net fee is only $25.92 ($27 less 4% credits and bad debt).

Fully loaded gross margin:

| Staffing | 250 per nurse | 300 per nurse | 380 per nurse |
|---|---|---|---|
| RN ($90k) | −76% | **−48%** | −19% |
| LPN ($62k) | −29% | −9% | +12% |
| Medical assistant ($44k) | +1% | +16% | +32% |

- **AI doesn't rescue it.** In a time-based code the 20 minutes must be human. AI removes only the roughly 3 uncounted minutes, and AI that speeds up countable work shrinks counted minutes rather than adding billable ones.
- **No price works for both sides.** A 40% gross margin with LPNs needs a **$49 fee**, which leaves the practice **−$1.60 per enrolled patient-month**. With an RN it needs $66.71, which is more than Medicare pays [A]. The practice collects about $47.44 per enrolled CCM patient-month after coinsurance losses, unbilled months and a 6% biller. Only medical assistants at your 380 caseload clear 30%; then you are a smaller ChartSpan without RN judgment on escalations.
- **Fix.** Drop done-for-you CCM. At most, sell CCM tooling to staff the practice employs.

**F2. Nobody confirmed to be in the company can do the job where it has to be done.**
- **Evidence.**
  - The CEO is in India, facing first B1/B2 interview waits of 6–12+ months [F].
  - Your counsel advises no production access to patient data from outside the US [F].
  - There is no clinician or clinical advisor [F].
  - The technical founder's location and work authorization aren't stated.
  - Medicare doesn't pay for services performed outside the US. BioTelemetry/CardioNet paid **$44.9M** in December 2022, partly over cardiac data reviewed by technicians in India [V].
  - India isn't an E-2 treaty country; the UK is. New H-1B petitions faced a $100,000 fee under the September 2025 proclamation; its status after September 2026 is unknown [NV].
- **Why fatal.** Each of these needs someone in the US with clinical authority or access to patient data, and nobody confirmed in the company has either:
  - Your first ten customers will be won in practice hallways.
  - Your first nurse must be hired, credentialed and supervised in the US.
  - Your urgent-symptom protocol needs a US physician's signature.
  - Your first production incident involving patient data needs a US-based engineer.
- **Fix (within about 90 days, or stop).**
  1. The technical founder moves to the US. UK citizens can make business-meeting trips under ESTA now and are E-2 eligible; confirm with immigration counsel.
  2. Recruit a US-based clinical-operations co-founder with real equity (10–20%).
  3. The CEO pursues an O-1A after traction. Until then, the CEO owns work that touches no patient data: product, fundraising and remote sales calls.

**F3. Your advantage is invisible to the buyer, the market is limited by demand rather than vendor labor, and the ceiling is below venture scale.**
- **Demand.**
  - Done-for-you CCM has been sold for a decade [V]:
    - ChartSpan claims 45% enrollment, against about 10% for in-house programs.
    - It launched full-service APCM in June 2025, sells through hospital associations in PA, CO, TX, KY, IA and AR, and bought Validic in June 2026.
    - Prevounce, HealthArc, TimeDoc and TelliHealth (formerly Signallamp + Accuhealth) all sell managed services.
  - Even so, CCM reached about 4% of eligible fee-for-service beneficiaries in 2019 and stayed near there through 2023, about 1.3M people in 2023 [V].
  - CMS's CY2027 proposal calls care-management uptake "surprisingly limited." It says first-year APCM uptake fell short of expectations, and it names cost-sharing and documentation burden as the barriers, not vendor labor cost [V].
  - Using fewer nurses changes neither barrier.
- **Price.** ChartSpan advertises "$100K+ annually with 300 enrolled patients." Read as net to the practice, that is **$27.78 per enrolled patient-month** [V: vendor marketing]. Your model leaves the practice **$20.44 (CCM) to $25.20 (APCM)** per enrolled patient-month after coinsurance losses, unbilled months and its biller [A]. By the leader's own marketing, you are not cheaper.
- **Scale.**
  - $100M of revenue needs **1,459 practices** on your numbers and **about 2,736** on mine (§4).
  - The category leader reports "175+ practices, hospitals and health systems" after about ten years [V].
  - Even if every small independent primary-care practice in the US signed, the revenue pool would be about **$0.4–0.7B a year** [A].
- **Why fatal.** You would be selling the incumbents' promise with less trust (an automated caller phoning their patients), no relationships and no references. Winning would still leave you a capped services company.
- **Fix.** Change the buyer (§7). Nothing inside the current wedge fixes this.

### SERIOUS (fix within 3–6 months, or fundraising and growth stall)

**S1. The only line that can make money (APCM) depends on an unmeasured caseload, and on a monthly call that APCM doesn't require.**
- **Caseload.**
  - At 1,400 patients [F], a nurse has **4.9 minutes per patient-month** at my productive hours, or 7.4 minutes at 100% of paid hours [A].
  - In that time the nurse must review calls and handle concerns (about 15% of calls), urgent flags (about 1%), unreached patients (about 25%), patients who refuse the AI (about 15%), care transitions and the care plan. They must also paste a note into the EHR for every patient.
  - My bottom-up estimate is 11.7 minutes, or **about 590 patients per nurse** [A].
  - APCM gross margin at $27 is −3% at 450 per nurse, **20% at 600**, 43% at 900 and 59% at 1,400.
  - A 40% margin needs **at least 850 patients per nurse**, with an RN at $90k.
  - Every additional 10% of patients who refuse the AI cuts capacity by about 8%.
- **Value.**
  - As I read the CY2025 final rule, APCM has no monthly minimum of time or contact [NV: a confident recollection; confirm with counsel]. So the practice doesn't need your monthly call to bill.
  - It does need consent, the service elements and, for MIPS-eligible clinicians, reporting of the Value in Primary Care MVP. The CY2027 proposal describes that reporting as a current safeguard [V].
  - You charge about half of APCM revenue for the one element billing doesn't require.
  - The elements that are hard for a practice with no staff all need EHR data, which your no-integration design deliberately avoids: 24/7 access to someone with the chart, care transitions with electronic information exchange, population-level gap analysis and quality reporting.
- **Audit optics.** Your prototype makes an APCM month billable once any AI or nurse call reaches the patient [Repo: `server/billing.ts:57`, README line 82]. "We billed $53.78–$117.24 because an automated call connected" is what a program-integrity reviewer looks for while OIG audits the neighboring code.
- **Fix.**
  - Measure the caseload in a live pilot.
  - Design deliberate human touchpoints into the APCM month.
  - Get counsel's written view on what makes an APCM month defensible.

**S2. No customer evidence at all.** You have no completed conversations and no LOIs [F]. Enrollment, caseload, AI acceptance, CAC, churn and ramp are all assumptions, and the first interview question will be about customers (§6).

**S3. Your enrollment assumption contradicts your own consent design.**
- **The 45% figure.** It is ChartSpan's claimed result, from a model built on its own enrollment outreach; ChartSpan says in-house programs average about 10% [V: vendor claim]. I found no public source for an "industry median ~24%" [NV].
- **Visit-based consent caps enrollment.** Your default is consent at the office visit. That ties enrollment to the visit cadence: patients with multiple chronic conditions are seen about 3–4 times a year [A]. It also depends on a physician remembering to pitch a program that costs the patient about $13 a month.
- **Phone consent is costly and unmodeled.** It takes about 35 nurse-minutes per successful enrollment, about **$48 per enrolled patient** at RN cost [A], and your model doesn't include it.
- **Effect.** At 25% instead of 45%, revenue per practice falls from $68.5k to $36.5k a year. Even on your own cost numbers, break-even moves from 50 practices to 173 (§4).

**S4. Your go-to-market doesn't match how this buyer buys.**
- LinkedIn is the main channel into owners who decide in person, and the CEO is 9.5–13.5 hours ahead of US time.
- Channels (billing companies, IPAs, ACO enablement firms) will want 10–20%, and many already have a care-management partner; ChartSpan sells through hospital associations [V].
- CAC isn't modeled. I use **$12k per practice plus about $5.8k** for onboarding and initial enrollment [A].

**S5. Your one payer is moving against your model.**
- **OIG audit OAS-26-09-007.** Announced 16 March 2026 and running to FY2028, it targets CCM paid for patients who don't meet the multiple-chronic-condition standard. CCM payments "increased substantially" from 2019 to 2024 [V].
- **The CY2027 proposed rule** [V]:
  - It would pay for RPM/RTM only when the clinical staff are **direct employees** of the billing practice, and it revalues RPM down. RPM is your first planned expansion.
  - CCM and APCM are exempt as proposed. But the care-management RFI asks about supervision, initiating visits and fraud, and Nixon Law Group reads that as a preview of CY2028 proposals mirroring the RPM restrictions.
- **A 2027 cut.** The conversion factor is proposed at −1.68% for 2027, because the one-year 2.5% bump for 2026 expires. If relative values hold, 99490 becomes **$65.02**, G0557 **$52.88** and G0558 **$115.27** [V/A]. Your $27 doesn't move, so the practice's share shrinks.
- **Enforcement against vendor-run CCM** [V]:
  - Sunshine Care Partners and its owner received 10-year exclusions (June 2026) for complex CCM that was billed but never provided by vendor staff.
  - Piedmont Health Services paid $4.8M (April 2025).
  - Bluestone paid $14.9M (June 2024).
  - WNY Medical paid $251k for CCM billed without the 20 minutes.
- **Fix.** None within your control. Hedge by making the product usable by staff the practice employs.

**S6. Your eligibility and billing logic builds audit exposure in.**
- **Eligibility.** Any two ICD-10 codes from a list that includes E78.5 hyperlipidemia, E03.9 hypothyroidism and M19.90 osteoarthritis qualify a patient [Repo: `shared/codes.ts:20-30`]. "Hyperlipidemia + hypothyroidism" is two chronic conditions on paper. It is also exactly the low-risk case OIG's eligibility audit is built to find.
- **QMB status sets the payment.** The choice between G0558 ($117.24) and G0557 ($53.78) rests on an `is_qmb` column the practice types into the CSV [Repo: `server/billing.ts:14`]. That is a 2.2× payment difference on an unverified flag that changes with Medicaid redeterminations. Coverage type (traditional vs Medicare Advantage) comes from the same CSV.
- **Fix.** Monthly eligibility and QMB verification, plus a per-patient clinical-risk attestation. Each adds cost per patient.

**S7. Whether patients aged 75+ will answer and finish an automated call is untested.**
- Unknown-number pickup rates, hearing loss, cognitive impairment and caregivers answering all work against you.
- Every patient who won't do the AI call moves to the nurse queue at about 10 minutes a month.
- I found no published data this session on seniors' acceptance of AI check-in calls [NV].

**S8. Clinical governance and liability.**
- You have no medical director, no signed escalation protocol, and no malpractice or E&O cover.
- Your AI tells patients to call 911 or 988 and then **ends the call** [Repo: `shared/aiCall.ts:3`].
- One missed stroke, or one suicide after a 988 referral and a hang-up, ends every practice relationship you have.

**S9. "No integration" contradicts itself and scales linearly with patients.**
- **You still need EHR access.** The brief says "they never view the chart." Your prototype's nine-step month includes EHR chart review, EHR medication review, EHR care-plan review and filing the note in the EHR [Repo: README line 86; `shared/constants.ts:82-108`]. So you need credentials in every practice's EHR; what you skipped is the automation, not the integration.
- **The practice carries manual work too.** Every month it must send a 17-column CSV that includes coverage type and QMB status, which most small-practice EHRs don't hold [Repo: `server/roster.ts:55`]. The physician must also attest every patient every month [Repo: `server/billing.ts:61`].
- **At scale.** With 50 practices at 25% enrollment, every month brings **50 CSVs, about 5,875 pasted notes and about 5,875 physician attestations**, across roughly 8–12 different EHRs [A].
- **Competitors are ahead here.** Beacon Health (YC W26) already automates EHR work through the screen [V].

**S10. Your expansion story runs straight into the scrutiny.**
- RPM is the target of the proposed outsourcing ban [V].
- Behavioral health brings state-level AI restrictions [NV].
- "Sell the platform as software later" means competing with ThoroughCare and ChronicCareIQ, at one-fifth to one-tenth of your services fee per patient [V]:
  - ThoroughCare: about 700 organizations, about $1–8 PPPM (third-party estimate).
  - ChronicCareIQ: $2–5 PPPM, or $500 per provider per month.

### FIXABLE (normal execution)

- **X1. The flat fee per enrolled patient** bills the practice for months it can't bill Medicare (about 20% of CCM months), which invites disputes. Price per serviced patient-month or in per-practice tiers, with counsel. I model 4% for credits and bad debt.
- **X2. Working capital.** Nurses are paid about two months before cash arrives. At 50 APCM practices that is about $175k of cost financed and about $305k in receivables (§4). Use ACH autopay, net-15 terms and a receivables line.
- **X3. Nurse licensure follows the patient's location.** Start in Nurse Licensure Compact states; the prototype practice is in Texas [NV on current compact membership]. Plan for snowbirds.
- **X4. TCPA and AI disclosure.**
  - FCC 24-17 (February 2024) makes AI voices "artificial," so AI calls to cell phones need prior express consent [V].
  - The consent-revocation rules were rewritten again on 30 September 2026 (FCC 26-67) [V].
  - State AI-disclosure laws such as California AB 3030 and Texas TRAIGA may apply [NV].
  - Your design puts automated-call permission inside enrollment consent, and "stop calling me" revokes it; that points the right way under the FCC ruling. Keep counsel on it.
- **X5. Caller ID.** High-volume unknown numbers get labelled "Spam Likely." Use branded, registered caller ID for each practice, and 10DLC registration for texts.
- **X6. HIPAA program.** BAAs with the telephony, speech and LLM vendors; production access from the US only; SOC 2 Type I within about 12 months.
- **X7. Insurance.** Get quotes now for professional liability, tech E&O that covers AI, and cyber. It is a cost-of-service line.
- **X8. Model hygiene.** Separate the CCM and APCM P&Ls. Add CAC, sales cycle, ramp, churn, working capital, account management and compliance.
- **X9. 24/7 access.** Name in the contract who covers it: the practice's on-call or a contracted nurse-triage service.
- **X10. Medicare Advantage isn't automatically zero.** MA plans must cover Part B services, so CCM and APCM are covered benefits. Whether a plan pays a given practice depends on its contract [NV, confident recollection]. Your prototype simply pauses MA patients. Check each practice's top three MA contracts.

## 3. Scorecard

10 = best in class. For the two risk rows, 10 = lowest risk.

| Dimension | Score | Why |
|---|---|---|
| Problem severity | 4 | For the buyer this is an opportunity cost (about $10–12k per physician per year at realistic enrollment), not a pain. Ten years of done-for-you vendors and about 4% uptake show how little it hurts. |
| Reachable market size | 3 | About 29M traditional-Medicare beneficiaries, with MA heading to 63% by 2034, and most physicians now employed (82% per PAI). $100M needs about 2,736 practices. |
| Why now | 4 | APCM and cheap voice AI are real catalysts, but every competitor has both. 2027 brings a conversion-factor cut, an RPM outsourcing proposal and an RFI on your staffing model. |
| Wedge choice | 2 | The slowest-to-sell, smallest-ACV, most crowded segment, chosen by a team that can't visit it. |
| Differentiation | 2 | "Fewer humans" is your cost structure, not the customer's benefit, and an incumbent can license it within two quarters. |
| Business model and pricing | 3 | A flat $27 loses money on every CCM patient and charges about half of APCM revenue for a call APCM doesn't require. |
| Unit-economics realism | 2 | Nurse cost about 25% below market, caseloads 25–130% above anything measured, enrollment at the leader's best claim, and no CAC, ramp, churn or working capital. |
| Services-vs-software risk | 2 | A nurse-staffing company with good software. AI is about 5% of the cost of an APCM patient-month; the nurse is about 76%. |
| Go-to-market | 2 | Zero completed conversations, LinkedIn into an in-person buyer, and a CEO 9.5–13.5 hours ahead. |
| Regulatory and policy risk | 3 | One payer, annual repricing, an active OIG audit of your core code, a proposed ban on your first expansion model, and an RFI on your staffing structure. |
| Clinical and operational risk | 3 | AI triage of patients aged 75+ with no medical director, protocol or insurance, plus a manual multi-EHR workflow that grows with every patient. |
| Team and founder-market fit | 2 | No healthcare operator, no clinician, a CEO who can't reach the US for months, and (on your counsel's advice) no production-data access from outside the US. |
| Defensibility | 2 | No data, relationships, integrations, regulatory position or proprietary AI. |
| Fundability today | 2 | Pre-customer, services-heavy, no domain expertise, no US presence: a near-automatic pass at seed. |
| Fundability with 2–3 paid pilots | 4 | Pilots fix the evidence gap but not the CCM loss, the scale ceiling or the team. A measured APCM caseload of ≥850 plus a US clinical co-founder would get this to 5–6. |

## 4. Rebuilt unit economics

**Answers first.**
- **My base case** (25% enrollment, 50/50 CCM/APCM mix): there is **no break-even practice count and no payback**.
- **Best realistic configuration** (APCM only, 600 patients per nurse): break-even at **1,136 practices**, payback in **56 months**.
- **Optimistic case** (900 per nurse): **197 practices**, **25 months**.
- **Enrollment floor:** below **about 25% enrollment** the business fails even in its best configuration.

**Assumptions: yours vs mine**

| Input | Yours [F] | Mine [A] | Why |
|---|---|---|---|
| Eligible traditional-Medicare patients (3 physicians) | 470 | 470 | Kept for comparability. The typical small practice has 1–2 physicians; 313 eligible is tested below. |
| Steady-state enrollment | 45% | **25%** | 45% is ChartSpan's best claim, from enrollment outreach. It says in-house programs reach about 10%. Your default is consent at the visit. |
| Ramp | none | Months 1–2 zero, linear to steady state by month 12 | Consent depends on visit cadence. |
| Monthly billable rate (practice side) | ~78% implied | CCM 80%, APCM 95% | Unreached CCM patients don't reach 20 minutes. |
| Fee collected | $27 | $27 × 0.96 | Credits for unbillable months, bad debt. |
| Nurse, fully loaded | $86.2k implied | RN $114.3k ($90k × 1.27); LPN $78.7k | BLS RN median $93.6k [NV]. |
| CCM patients per nurse | 380 | **300** | 114.8 productive hours ÷ 23.6 minutes per enrolled patient-month. |
| APCM patients per nurse | 1,400 | **600** base, 900 upside | Bottom-up estimate of 11.7 minutes per patient-month (about 590). |
| Clinical supervision | none | 1 nurse manager ($146k loaded) per 10 nurses | Needed for quality assurance and audits. |
| AI + telephony + speech + LLM | ~$2.71 non-nurse cost (APCM, implied) | $1.00 APCM / $0.75 CCM | About 7 voice-minutes a month at roughly $0.15/minute. AI cost isn't the problem. |
| Infrastructure / after-hours reserve / re-enrollment | none | $0.40 / $0.50 / $0.97 | 2% monthly patient churn, re-consented by phone. |
| CAC per practice | none | **$12,000** | An account executive plus an SDR at about 2 closes a month, plus tools and travel. |
| Onboarding + initial enrollment | none | $3,000 + phone consent for half of enrollees ≈ **$5,843** | 35 RN-minutes per successful consent. |
| Sales cycle | none | 4 months, first touch to signature | |
| Account management | none | 1 CSM per 40 practices = $212 per practice-month | |
| Practice churn | none | 1.5% a month (about 17% a year) | Consolidation (about 13,900 practices acquired from 2024 to January 2026 [V]) and an immature product. ChartSpan claims 98% retention [V: vendor]. Churn isn't the swing factor (see stress tests). |
| Fixed opex, excluding sales and CS | $1.66M implied | **$2.0M** | Founders, 3 engineers, a director of nursing, a part-time medical director, compliance, ops, G&A, insurance, security. |
| Working capital | none | About 2 months of cost of service | Service month → practice claims → Medicare pays → practice pays you net-30. |

**Your model, reproduced.**
- Nurse cost: $18.91 × 380 = $7,186 per nurse-month.
- Blended cost: 0.54 × $18.91 + 0.46 × $7.84 = $13.82, a 48.8% margin.
- Per practice: 210 × ($27 − $13.82) = $2,768 a month.
- Company: × 50 practices × 12 months = **$1.66M**. That is the whole opex your 50-practice break-even implies.

**Cost per enrolled patient-month**

| Program / staffing | Nurse | Supervision | AI | Other | **Total** | Gross margin at $25.92 net |
|---|---|---|---|---|---|---|
| CCM, RN, 300 per nurse | 31.75 | 4.06 | 0.75 | 1.87 | **38.42** | **−48%** |
| CCM, LPN, 300 | 21.87 | 4.06 | 0.75 | 1.57 | **28.25** | −9% |
| CCM, RN, 380 (your caseload) | 25.07 | 3.20 | 0.75 | 1.87 | 30.89 | −19% |
| APCM, RN, 450 | 21.17 | 2.70 | 1.00 | 1.87 | 26.74 | −3% |
| APCM, RN, 600 | 15.88 | 2.03 | 1.00 | 1.87 | **20.77** | **20%** |
| APCM, RN, 900 | 10.58 | 1.35 | 1.00 | 1.87 | 14.80 | 43% |
| APCM, RN, 1,400 (your caseload) | 6.80 | 0.87 | 1.00 | 1.87 | 10.54 | 59% |
| *Yours* | | | | | *CCM 18.91 / APCM 7.84* | *30% / 71%* |

**Worked example: APCM at 600 patients per nurse.**
- Nurse: $9,525 ÷ 600 = $15.88.
- Supervision: $12,171 ÷ 10 ÷ 600 = $2.03.
- AI $1.00, infrastructure $0.40, after-hours reserve $0.50.
- Re-enrollment: 2% × 35 minutes × $1.38 per minute = $0.97.
- Total cost: **$20.77**. Net fee is $27 × 0.96 = $25.92, so the margin is $5.15 (19.9%).
- Per practice: 117.5 enrolled × $5.15 = $605, minus $212 of account management = **$393 a month**.
- Payback: $17,843 of acquisition cost (CAC plus onboarding), recovered over a 2-month setup and a 10-month ramp, takes **56 months**.
- Break-even: $393 × 12 = $4,721 a year per practice. Subtract replacement CAC of 16.6% churn × $17,843 = $2,962, leaving $1,759. Then $2.0M ÷ $1,759 = **1,136 practices**.

Your 49% blended margin needs roughly a 54/46 CCM/APCM mix at your costs. On my costs, a 50/50 mix (LPNs on CCM, RNs at 600 on APCM) earns **5.4%**.

**Per practice and company**

| Scenario | Gross margin | Contribution per practice-month | Payback from signing | LTV ÷ acquisition cost | Break-even practices |
|---|---|---|---|---|---|
| Your model (45%, your costs, no CAC/churn/account management) | 48.8% | $2,788 | immediate | n/a | **50** |
| Your costs, with my enrollment, CAC, ramp, churn, account management and opex | 46.7% | $1,210 | 23 months | 3.9 | **173** |
| **My base: 25%, 50/50 mix** | **5.4%** | **−$46** | **never** | <0 | **never** |
| CCM only, LPN | −9.0% | −$485 | never | <0 | never |
| APCM only, 600 per nurse | 19.9% | $393 | **56 months** | 1.2 | **1,136** |
| APCM only, 900 per nurse | 42.9% | $1,095 | **25 months** | 3.5 | **197** |
| APCM only, 600, at 45% enrollment | 19.9% | $877 | 32 months | 2.5 | 278 |
| APCM only, 900, at 35% enrollment | 42.9% | $1,617 | 20 months | 4.9 | 123 |
| Base, 2-physician practice (313 eligible) | 5.4% | −$101 | never | <0 | never |

For payback from first contact rather than signing, add about four months of sales cycle: 27 months on your costs, 29 months at APCM 900, 60 months at APCM 600.

**APCM only: payback months / break-even practices, by caseload and enrollment**

| Patients per nurse | 15% | 20% | 25% | 30% | 35% | 45% |
|---|---|---|---|---|---|---|
| 600 | 126 / never | 75 / 4,970 | 56 / 1,136 | 45 / 642 | 39 / 447 | 32 / 278 |
| 750 | 52 / 964 | 38 / 450 | 31 / 294 | 26 / 218 | 24 / 173 | 20 / 123 |
| 900 | 39 / 489 | 29 / 280 | 25 / 197 | 22 / 151 | 20 / 123 | 17 / 90 |
| 1,100 | 32 / 337 | 25 / 209 | 21 / 151 | 19 / 118 | 17 / 97 | 15 / 72 |
| 1,400 | 28 / 260 | 22 / 167 | 19 / 124 | 17 / 98 | 16 / 81 | 14 / 60 |

**Stress tests (APCM, 900 per nurse, 25% enrollment):**

| Change | Payback | Break-even practices |
|---|---|---|
| Practices pay only for billable months | 27 months | 240 |
| Sold through a channel: $6k CAC, but 15% of the fee goes to the channel | 28 months | 352 |
| Opex of $3M instead of $2M | 25 months | 295 |
| Practice churn of 2.5% a month instead of 1.5% | 25 months | 236 |

The swing factors are caseload and enrollment, not churn or opex.

**The enrollment rate below which the business doesn't work.** I define "works" as payback within 24 months and company break-even at 300 practices or fewer.
- **With CCM in the mix, no enrollment rate works.** CCM alone loses money at any enrollment. A 50/50 mix needs 32% enrollment just to reach positive contribution, and it never pays back within 24 months.
- **APCM only at 600 per nurse.** It needs at least 43.5% to break even at 300 practices or fewer, and at least 65% to pay back within 24 months. That is above any vendor's claim.
- **APCM only at 900 per nurse.** It needs at least **19.5%** to break even at 300 practices or fewer, and at least **25.5%** to pay back within 24 months.
- **Bottom line.** Below about 25% enrollment the business fails even in its best configuration (APCM only, at least 900 patients per nurse, both unproven). At a realistic 600 per nurse it needs 45–65%.

**What the practice actually keeps.** Assumes 3 physicians and a 6% biller. Medicare pays 80% of the rate, less 2% sequestration. Coinsurance is collected at 85%, but at 30% for QMB patients, because many states pay little or nothing toward QMB cost-sharing [A].

| Enrollment | CCM: net to practice per year | APCM: net to practice per year |
|---|---|---|
| 25% (117 patients) | **$28.8k** | **$35.5k** |
| 45% (211 patients) | $51.9k | $64.0k |

At realistic enrollment that is about $10–12k per physician per year. In return the practice handles:
- consent pitches;
- about 118 attestations a month;
- the CSV;
- escalations;
- for APCM, MVP quality reporting.

A physician who has said no five times will do this math.

**Scale.**
- $100M of revenue means **2,736 live practices** on my numbers (1,459 on yours).
- At about 17% churn, holding that base takes about 455 new practices a year.
- If you signed *every* small independent practice in the US, the revenue pool would be **$393M a year** ($708M at 45% enrollment):

  29.0M traditional-Medicare beneficiaries [V] × 67% with 2+ chronic conditions [V] × 25% in small independent practices [A] × 25% enrolled × $27 × 12

**Working capital at 50 practices (APCM 900).** Revenue is $152k a month and cost of service $87k a month. About $174k of cost is financed before cash arrives, and receivables at 60 days are about $305k.

## 5. Competitive kill scenario

**ChartSpan, months 0–12, once it adds AI calls:**
1. **Months 0–3.** It licenses or builds an AI check-in agent and pilots it on its existing APCM patients. It already has consent, EHR access, care managers and a 24/7 care line [V].
2. **Months 3–6.** It holds the practice's net at about $28 per patient-month while cutting its own cost per patient by 30–50%. The pitch: "AI-assisted APCM with nurse oversight, inside your EHR. 45% enrollment, NPS 75.75, RPM devices through Validic" [V: claims].
3. **Months 6–12.** It pushes this through hospital-association channels in six states and converts its CCM patients to APCM. If no-integration ever turns out to matter, it adds a lite tier.

**Result.** Your one difference is matched. In a head-to-head the practice sees the same price, more proof, EHR integration, and nurses who already know its patients. ChartSpan doesn't need to do any of this to beat you today; it is the response you'll get the day you gain traction. TimeDoc ("AI-enhanced" engagement, April 2026) and CareHarmony ("AI-powered" coordination) already market AI [V].

**Kaigo Health (YC F25).** It built AI phone agents for outpatient Medicare care management, covering check-ins, transitional care and care gaps, "starting with providers" [V]. By September 2026 its website appears to describe an outsourced business office for skilled-nursing facilities [V: site description, not confirmed]. The threat isn't Kaigo competing with you. It's the conclusion the partner reading your application will draw: *we funded this last year and they moved on.*

**Hippocratic AI.** With $404M raised at a $3.5B valuation (November 2025), it sells chronic-care-management agents to payers and health systems [V]. It doesn't need small practices. It sells to the channels you plan to use — ACO enablement firms, MSOs, health systems, payers — and makes "AI check-in calls" a commodity input for your would-be distributors. Your channel list becomes its customer list.

**Also in the field:**
- **Cadence** ($100M Series C, June 2026, $1.23B valuation) runs RPM and APCM for health systems [V].
- **Beacon Health** (YC W26) automates EHR work through the screen, solving the integration problem you sidestepped [V].
- **Innovaccer** markets AI voice agents for CCM follow-up [V].
- **Medsien** sells AI care-management software plus services to hospitals, ACOs, FQHCs and independent practices. It is your closest analog [V].
- **EHR vendors:** not checked this session [NV].

**Your defense today: none.** You have no customers, no outcome data, no relationships, no integration, no regulatory position and no proprietary AI. The only defenses available later:
- measured outcomes from the AI-plus-nurse model that someone will pay for;
- the lowest audited cost per APCM patient-month, with a clean compliance record;
- exclusive channel relationships.

None of these exists yet.

## 6. The interview

| # | Question | Likely answer today | Why it fails | Fundable answer |
|---|---|---|---|---|
| 1 | How many practices have you talked to, and what did the last one say? | "We just started LinkedIn outreach; responses are encouraging." | Zero data on the only question that matters. | "42 in five weeks. 26 had been pitched CCM and 9 use a vendor. 3 signed LOIs at $27 for APCM. Here are the top three reasons the others said no." |
| 2 | They've all been pitched ChartSpan. Why would they say yes to you? | "No EHR integration, fewer humans, a flat fee, built around APCM." | None is a buyer benefit. ChartSpan already offers APCM and claims 45% enrollment, and the practice nets about the same. | "They said no to incumbents because of X, and we remove X. Two practices dropped their vendor for us; here's what changed." |
| 3 | Walk me through a CCM patient-month. Where does AI cut billable labor? | "AI schedules, dials, briefs, transcribes and drafts notes. The nurse just talks." | The 20 minutes stay human and AI trims about 3. You lose money on CCM at $27. | "We measured 27 nurse-minutes per billed patient and 330 patients per LPN, so we price CCM at $X or don't offer it." |
| 4 | You assume 1,400 APCM patients per nurse. How do you know? | "Our model. The AI does the calls and the nurse handles exceptions." | That's 5–7 minutes of human time per patient-month, unmeasured. At 600 per nurse the margin is 20%. | "In our pilot, 640 patients on 0.7 FTE for 2 months, which is 914 per FTE. 11% escalation rate, zero missed urgent flags, external audit passed." |
| 5 | APCM has no contact requirement. What does the AI call add that the practice can't get from $5 software? | "Clinical surveillance and an audit trail, and the practice does nothing." | Not quantified. The hard APCM elements (EHR access, transitions, population management, MVP reporting) aren't yours. | "X% of calls led to an action: a refill, a visit, an avoided ED trip. Here's the element-by-element split of who delivers what." |
| 6 | Where do you live, and who sells to and supervises nurses in Texas? | "I'm in India and relocating. My co-founder is in the UK. We'll sell remotely for now." | No US presence, no patient-data access, no in-person sales. Attending the batch itself is at risk. | "Our US co-founder is an RN who ran a 3,000-patient CCM program; she owns ops and sales. My co-founder has relocated, and I'm on an O-1 path." |
| 7 | What happens when your AI misses a stroke? | "It's scripted for red flags. It tells them to call 911, ends the call and alerts the nurse within 30 minutes." | No medical director, no signed protocol, no insurance. Hanging up on a possible stroke is not a protocol a physician will sign. | "Our protocol is signed by Dr. X. The AI stays on the line during a 911 transfer. We validated it on 500 test calls and 200 real ones, and we're insured by Y." |
| 8 | Show me $100 million. | "200 practices is $13M. Then RPM, TCM, behavioral health, then software." | $100M takes 1,459–2,736 practices. RPM is being pushed in-house. Software ACV is a fraction of the services fee. | One contract that brings hundreds of practices or tens of thousands of patients, at software margins. |
| 9 | Why you? What do you know that ChartSpan doesn't? | "We're technical, we move fast, and we've studied the CMS rules deeply." | ChartSpan has studied the rules for ten years. This business is won on nurse operations, compliance and small-practice sales, and you've done none of them. | A proprietary insight from lived experience or data, or a co-founder who has run the operation. |
| 10 | Kaigo built AI check-ins for Medicare patients in F25 and seems to have moved on. Why will you work? | "We pair AI with nurses and run the whole program." | That's ChartSpan plus Kaigo, and it doesn't name the failure you avoid. | "We talked to Kaigo's founders and their target customers. The blocker was X, our model removes X, and here's the evidence." |

**A fundable set of answers contains:**
- numbers from real conversations;
- a specific reason practices switch;
- measured nurse minutes;
- a named US clinical operator;
- a one-to-many distribution path to $100M at software margins;
- a signed protocol and bound insurance;
- a clear account of why the closest predecessors stalled.

## 7. Better wedges

| Wedge | Time to first revenue [A] | Gross margin [A] | Competition | Team fit | Path to scale |
|---|---|---|---|---|---|
| **A. Current: done-for-you CCM/APCM for small independent practices** | 6–9 months (sales, setup and ramp; you need a nurse, insurance and a medical director first) | 0–25% | Crowded: ChartSpan, TelliHealth, TimeDoc, Prevounce, HealthArc, Medsien, CareHarmony, ACO enablement firms | Worst: in-person sales, clinical ops, patient data | Capped (§4) |
| **B. AI APCM operations layer, sold as software to care-management operators** (CCM/APCM vendors, managed-service arms, ACO enablement firms and MSOs, health-system care-management teams) | 2–4 months to a paid pilot, because they already have consented patients, EHR access, nurses and BAAs | 70–80% (about $1 of AI per patient-month against a $3–6 price) | In-house builds, generic voice-AI platforms, Hippocratic (enterprise), Innovaccer | **Best:** software, sellable remotely, no nurses, licensure or malpractice; needs one US engineer for production access | Small alone: if 1.5–2M patients are in CCM/APCM, $5 × 12 is about $90–120M even with all of them. Needs E. |
| **C. FQHCs/RHCs with a high dual-eligible share** | 6–12 months (boards, primary care associations) | Better per patient (G0558 is $117.24); multilingual AI is a visible edge | Few vendors; their own staff; Medsien | Poor: relationship-driven safety-net sales | Moderate |
| **D. Specialists** (nephrology, cardiology) | 4–8 months | Services margin | RPM vendors (being restricted), value-based kidney-care companies | Poor: needs clinical depth | Limited |
| **E. Risk-bearing ACOs, MSOs and MA groups: a monthly touch for attributed patients** | 6–12 months | Software or per-member-per-month | Very crowded and well funded: Hippocratic, Ellipsis ($45M Series A), Cadence, Pelica, Beacon, Innovaccer | Moderate: needs healthcare credibility | Large, and not limited to traditional Medicare or to billing codes |
| **F. The CMS ACCESS model** (tech-enabled organizations paid directly for outcomes) | Depends on application windows [NV] | Unknown | Tech-enabled chronic-care companies | Poor today: needs Medicare enrollment and a physician clinical director | Potentially large [NV] |

**Recommendation: B as the entry point, E as the expansion.** Sell the efficiency to whoever pays for the humans.
- **Why operators feel this pain.** APCM pays $53.78, against CCM's $66.13, for non-QMB patients, and it has no time rule. Operators built on 20-minute CCM labor must therefore cut cost per patient-month. They track nurse caseloads, so for them "fewer humans" is visible.
- **They already buy AI and need audit trails.** TimeDoc and CareHarmony market AI [V]. The RPM staffing proposal and the care-management RFI are pushing operators toward records of what humans did and when. That is the strongest part of your prototype: the event log, the billing holds and the nurse queue.
- **Speed:** pilots in weeks, not quarters.
- **Margin:** software margins.
- **Team fit:** the founders never employ a nurse, and the CEO can sell remotely.
- **Risks:** operators building in-house, price pressure from voice-AI platforms, customer concentration. The TAM also stays small until you reach E, where one contract covers a whole attributed population, Medicare Advantage included.
- **C is the best second segment.** G0558 economics and multilingual calls make the AI visible to the buyer.
- **F may be the most important policy development for AI-native chronic care.** But I couldn't verify its terms this session, and it needs clinical leadership you don't have.

**If you insist on A,** this is the only version I'd re-read:
- APCM only;
- one compact state (Texas, where your prototype already lives);
- one channel: a billing company or IPA serving 100+ small practices;
- EHR access accepted;
- a US clinical co-founder;
- three paid pilots before raising.

## 8. "Are we checking all the boxes?"

"Done" means the brief gives evidence. "In progress" means partial evidence. "Missing" means none.

**(a) Before applying to YC**

| Area | Item | Status |
|---|---|---|
| Business | Product specs | **Done** (brief: specs written) |
| Business | One-sentence wedge and why-now, backed by customer quotes | In progress (specs exist, no quotes) |
| Business | Unit-economics model with CAC, ramp, churn and working capital | In progress (model lacks all four) |
| Business | Competitor map with a defensible difference | In progress (list exists; difference unproven) |
| Customer evidence | At least 20 completed conversations with practice owners or managers | **Missing** (0 completed) |
| Customer evidence | At least 10 conversations with working CCM/APCM nurses | **Missing** (outreach just started) |
| Customer evidence | At least 3 LOIs or design partners | **Missing** |
| Clinical | Named physician or nurse advisor | **Missing** |
| Legal | Preliminary regulatory and pricing review | **Done (preliminary)** (flat-fee and offshore-data advice) |
| Legal | Delaware C-corp, founder vesting, IP assignment | Missing (no evidence) |
| Operations | Workflow prototype | In progress (repo: one fake practice, one simulated month) |
| Hiring | Both founders full-time, roles split | Missing (not stated) |
| Hiring | Immigration plan for both founders, from counsel | **Missing** |
| Fundraising | Application, video, demo | Missing (planned for November) |

**(b) Before the first paying practice**

| Area | Item | Status |
|---|---|---|
| Customer | Signed MSA and BAA, pricing approved by counsel | Missing |
| Clinical | Medical director under contract | Missing |
| Clinical | Signed escalation protocol; CCM/APCM nurse procedures | Missing |
| Clinical | RN hired, licensed where the patients are | Missing |
| Legal | Counsel review of TCPA/AI-disclosure consent language and call-recording disclosure | In progress (consent design in spec and prototype; no sign-off) |
| Legal | Compliance program: eligibility, QMB and MA verification; billing audit process | Missing |
| Operations | Roster → EHR review → note → attestation flow tested at a real practice | In progress (simulated only) |
| Operations | 24/7 access arrangement defined | Missing |
| Operations | Branded caller ID, 10DLC registration, real telephony and voice | Missing (parked in the prototype) |
| Data/security | HIPAA risk assessment, policies, US-only production access, BAAs with all subprocessors | Missing |
| Insurance | Professional liability, tech E&O including AI, cyber, general liability | Missing |
| Hiring | A US-based person with production access | Missing |
| Finance | Invoicing, collections, working-capital line | Missing |

**(c) Before a seed round**

| Area | Item | Status |
|---|---|---|
| Customer evidence | At least 3 paying practices live for 90+ days, with references willing to take investor calls | Missing |
| Business | Measured cost per patient-month by program; gross margin; CAC; payback | Missing |
| Business | Pipeline: at least 20 qualified practices or 1 signed channel partner | Missing |
| Clinical | Clinical-operations co-founder or executive; quality metrics | Missing |
| Legal | Compliance officer (fractional is fine); external billing audit with no material findings | Missing |
| Policy | CY2027 final-rule impact analysis | Missing (rule due about 1 November) |
| Data/security | SOC 2 Type I done or under way | Missing |
| Insurance | All policies bound and priced into cost of service | Missing |
| Team | A founder in the US with work authorization | Missing |
| Fundraising | Data room: model, contracts, legal opinions, cap table | Missing |

## 9. Next 30 days

Ranked by how much each would move my decision. Items 1 and 2 run in parallel.

1. **Test the operator wedge (CEO).**
   - *Action:* hold 12 conversations with heads of operations at care-management operators: TelliHealth, TimeDoc, Prevounce's managed service, HealthArc, Medsien, CareHarmony, 3–4 ACO enablement firms or MSOs, and 2 health-system care-management teams.
   - *Result:* **at least 2 signed LOIs for a paid 90-day pilot of AI APCM check-ins plus a nurse exception queue, at ≥$4 PPPM, on at least 500 patients each.**
   - *Why first:* it is the one result that tests software margins, one-to-many distribution and fit with where the team sits, all at once. It can be done from India.
2. **Test practice demand in one compact state (technical founder in person; CEO by phone).**
   - *Action:* the technical founder goes to Texas on an ESTA business trip (confirm with counsel). Between you, complete 30 conversations: at least 15 in person, and at least 15 with practices that were previously pitched CCM/APCM.
   - *Result:* **at least 3 signed LOIs at $27 PPPM for APCM, with a start date**, plus a written tally of why the rest said no.
   - *Why second:* even a yes leaves the CCM loss and the caseload question open.
3. **Recruit a US clinical operator and a medical director (CEO).**
   - *Result:* a signed offer or term sheet with a US-based RN or operations leader who has run a CCM/APCM or home-health program of at least 1,000 patients (≥10% equity). Plus a physician who agrees in writing to serve as medical director and sign the protocol.
   - *Why third:* no pilot in either wedge can launch without it. It ranks below demand because a co-founder without customers is only a cost.
4. **Test whether seniors accept AI calls, without patient data (technical founder).**
   - *Action:* run a consented, scripted check-in with 150 adults aged 70+, recruited through senior centers or a paid panel, from both a branded and an unbranded number.
   - *Result:* pickup rate; at least 65% completion within three attempts; no more than 15% asking for a human; comprehension.
   - *Why fourth:* it tests the APCM thesis without a customer. Simulated patients rank below real ones.
5. **Measure nurse time (technical founder).**
   - *Action:* pay 5 working CCM/APCM nurses to run 3-hour sessions on the prototype, with 40 realistic cases each, including EHR review and note filing.
   - *Result:* measured minutes per patient-month for each program. Go/no-go: APCM at 850+ patients per nurse.
   - *Why fifth:* the work is simulated.
6. **Test one channel (CEO).**
   - *Action:* talk to 5 billing companies or IPAs that each serve at least 100 small practices.
   - *Result:* one partner agrees to introduce 10 practices, on written referral terms.
   - *Why sixth:* channels follow proof.
7. **Get immigration advice for both founders (CEO).**
   - *Result:* a written path and dates from counsel. For the technical founder: trips now, then an E-2 or O-1 filing. For the CEO: O-1A eligibility and timeline.
   - *Why seventh:* it produces a document, even though it gates the batch.
8. **Rebuild the model (both founders).**
   - *Action:* rebuild it with the measured inputs from items 1–5 and the CY2027 final rule (about 1 November).
   - *Result:* separate CCM and APCM P&Ls with CAC, ramp, churn and working capital, plus a one-page wedge decision.
   - *Why last:* it produces a document.

**On YC:** apply if you like, but the application will be judged on what items 1–3 produce. With zero conversations it is close to a certain reject. Coming back with 3 LOIs and a US co-founder makes a far stronger reapplication.

## 10. Facts verified or corrected, with sources

"Verified" means confirmed in search-result extracts of the linked pages, not full-page reads.

| Your claim | Status | What I found | Sources |
|---|---|---|---|
| About two-thirds of beneficiaries have 2+ chronic conditions | **Verified** (fee-for-service, older data) | 67.6% of FFS beneficiaries 65+ (2017 data); 69% (CMS, 2017). | [CDC](https://stacks.cdc.gov/view/cdc/110381/cdc_110381_DS1.pdf), [CMS MMS Hub](https://mmshub.cms.gov/about-quality/types/multiple-chronic-conditions) |
| CCM reached about 4% of eligible beneficiaries in 2019 | **Verified** | 4% (Mathematica, "steady through 2023"); 3.4% in a peer-reviewed 5% sample. | [KFF Health News, Apr 2024](https://kffhealthnews.org/news/article/medicare-chronic-care-management-monitoring-business/), [J Am Geriatr Soc 2024](https://agsjournals.onlinelibrary.wiley.com/doi/10.1111/jgs.19066) |
| About 1.3M received CCM in 2023, up 23% | **Verified** | Up 23.4% to "nearly 1.3 million" (all FFS claims). That is about 5.8% of roughly 22.5M eligible, so "4–6%" is the honest range. | [Avalere](https://avalerehealth.com/thought-leadership/chronic-care-management-in-medicare-optimizing-utilization/) |
| 2026 care-management rates rose about 8–11% | **Verified, slightly narrower** | 99490 $66.13 (+9.3%), G0556 $16.37 (+7.7%), G0557 $53.78 (+10.1%), G0558 $117.24 (+9.5%). Non-QP conversion factor $33.4009. Care-management codes were exempt from the −2.5% efficiency adjustment. | [CMS CY2026 final rule fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2026-medicare-physician-fee-schedule-final-rule-cms-1832-f), [ChartSpan](https://www.chartspan.com/blog/chronic-care-management-billing-rules/), [ThoroughCare](https://www.thoroughcare.net/blog/chronic-care-management-2026-cpt-codes), [Holland & Knight](https://www.hklaw.com/en/insights/publications/2025/11/cms-releases-cy-2026-medicare-physician-fee-schedule-final-rule) |
| *(new)* 2027 rates | **Correction to your model** | CY2027 proposed non-QP conversion factor is $32.8409 (−1.68%) as the one-year 2.5% bump for 2026 expires. With RVUs unchanged: 99490 $65.02, G0557 $52.88, G0558 $115.27. | [AMA summary](https://www.ama-assn.org/system/files/ama-2027-mpfs-proposed-rule-summary.pdf), [Holland & Knight, Jul 2026](https://www.hklaw.com/en/insights/publications/2026/07/cms-issues-cy-2027-medicare-physician-fee-schedule-proposed-rule) |
| 55% in MA in 2026; CBO projects 63% by 2034 | **Verified** | 35.2M of 64.2M = 55%. CBO's February 2026 baseline says 63% (the prior baseline said 64%). About 29.0M remain in traditional Medicare. | [KFF, Jun 2026](https://www.kff.org/medicare/medicare-advantage-in-2026-enrollment-update-and-key-trends/), [CBO](https://www.cbo.gov/system/files/2026-02/51302-2026-02-medicare.pdf) |
| "The codes apply to traditional Medicare only" | **Correction** [NV, confident recollection] | MA plans must cover Part B services, so CCM and APCM are covered benefits. Payment depends on each plan's contract. | 42 CFR 422.101 (not re-checked) |
| 47.4% of physicians in practices of ≤10 in 2024, vs 61.4% in 2012 | **Verified** | Also: 42.2% in private practice. PAI-Avalere: 82.0% of physicians employed by hospitals or corporates (January 2026), and about 13,900 practices acquired from 2024 to January 2026. | [AMA](https://www.ama-assn.org/system/files/2024-prp-pp-characteristics.pdf), [PAI-Avalere](https://www.physiciansadvocacyinstitute.org/PAI-Research/PAI-Avalere-Health-Report-on-Physician-Employment-Trends-and-Practice-Acquisitions-2018-2026) |
| HHS-OIG opened a multi-year CCM eligibility audit in March 2026 | **Verified** | OAS-26-09-007, announced 16 March 2026, due FY2028. It tests whether patients met the 2+ chronic-condition risk standard. Earlier OIG reports found CCM overpayments in 2019 and 2021. | [OIG Work Plan](https://oig.hhs.gov/reports/work-plan/browse-work-plan-projects/audit-of-medicare-payments-for-chronic-care-management-services-at-risk-of-noncompliance/), [Goodwin](https://www.goodwinlaw.com/en/insights/publications/2026/03/alerts-otherindustries-hltc-hhs-oig-announces-an-audit-of-medicare-payments), [OIG 2021](https://oig.hhs.gov/reports/all/2021/medicare-continues-to-make-overpayments-for-chronic-care-management-services-costing-the-program-and-its-beneficiaries-millions-of-dollars) |
| A bill to waive the coinsurance is pending | **Verified** | H.R. 8261, the Chronic Care Management Improvement Act of 2026, introduced 14 April 2026 (DelBene/Kelly). Referred to committee, no markup. It would apply from 1 January 2027 if enacted. | [Congress.gov](https://www.congress.gov/bill/119th-congress/house-bill/8261) |
| The CY2027 proposal restricts outsourced staffing for RPM, not CCM/APCM | **Verified, with a warning** | CMS-1848-P (released 14 July, published 16 July 2026; comments closed 14 September). RPM/RTM would be paid only for direct employees, with an initiating visit and lower values. CCM, PCM and APCM are excluded as proposed. But the care-management RFI covers supervision, initiating visits and fraud, and CMS says year-one APCM uptake was below expectations. | [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2027-medicare-physician-fee-schedule-proposed-rule), [Federal Register](https://www.federalregister.gov/documents/2026/07/16/2026-14327/medicare-and-medicaid-programs-cy-2027-payment-policies-under-the-physician-fee-schedule-and-other), [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/2026/07/medicare-proposes-significant-restrictions-on-and-lower-device-reimbursement-for-rpm-and-rtm), [Prevounce](https://blog.prevounce.com/7-key-rpm-takeaways-from-prevounces-pfs-2027-proposed-rule-webinar), [Nixon Law Group](https://www.nixonlawgroup.com/resources/the-cy-2027-mpfs-proposed-rule-is-here-whats-at-stake-for-rpm-rtm-and-care-management), [TimeDoc](https://timedochealth.com/cy-2027-proposed-rule-turning-point-for-care-management/) |
| CY2027 final rule | **Not out** as of 16 October in available coverage; expected about 1 November | Lawmakers are pressing CMS to soften the RPM staffing limit. | [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/lawmakers-press-cms-roll-back-proposed-restrictions-remote-patient-monitoring) |
| APCM requires MVP quality reporting | **Verified** | Described as a current safeguard in the CY2027 proposal. The other APCM elements, the absence of a monthly contact requirement and the permission for contracted staff are [NV, confident recollection]. | [Federal Register](https://www.federalregister.gov/documents/2026/07/16/2026-14327/medicare-and-medicaid-programs-cy-2027-payment-policies-under-the-physician-fee-schedule-and-other) |
| ChartSpan reports about 45% enrollment | **Verified as ChartSpan's claim** | 45% (35% on its specialty page; about 10% for in-house programs). APCM launched June 2025. 175+ practices, hospitals and systems. Bought Validic in June 2026. Advertises "$100K+ with 300 enrolled." | [ChartSpan CCM](https://chartspan.com/chronic-care-management/), [APCM launch](https://www.chartspan.com/blog/chartspan-launches-comprehensive-advanced-primary-care-management-program/), [Validic deal](https://hitconsultant.net/2026/06/22/chartspan-acquires-validic-remote-patient-monitoring/), [Pulse 2.0](https://pulse2.com/chartspan/) |
| Signallamp is a competitor | **Correction** | Merged with Accuhealth (July 2024) and rebranded as TelliHealth (December 2024). | [MobiHealthNews](https://www.mobihealthnews.com/news/accuhealth-signallamp-rebrands-tellihealth-appoints-ceo) |
| TimeDoc and CareHarmony are competitors | **Verified** | TimeDoc: about $55M raised, CEO changes since 2023, markets "AI-enhanced" engagement. CareHarmony: $15M Series A (2022), markets "AI-powered" coordination, no later round found. | [Fierce](https://www.fiercehealthcare.com/finance/virtual-care-manager-timedoc-raises-49m), [BusinessWire](https://www.businesswire.com/news/home/20220815005595/en/CareHarmony-Secures-$15-million-in-Series-A-Funding-Led-by-Maverick-Ventures) |
| CCM software vendors | **Verified** | ThoroughCare: about 700 organizations, about $1–8 PPPM (third-party estimate). ChronicCareIQ: $2–5 PPPM or $500 per provider per month. Prevounce and HealthArc also sell managed services. | [ThoroughCare](https://www.businesswire.com/news/home/20241119563128/en/ThoroughCare-Secures-5-Million-in-Series-A-Funding-from-Empactful-Capital), [pricing estimate](https://circle.healthcare/blogs/thoroughcare-review-pricing-features/), [ChronicCareIQ](https://www.getapp.com/all-software/a/chroniccareiq/), [Prevounce](https://www.prevounce.com/services/care-management) |
| Hippocratic AI costs about $9 per agent-hour | **Verified as a 2024 claim** | No current public rate card. $404M raised at a $3.5B valuation (November 2025). Sells CCM agents to payers. | [Advisory Board, Mar 2024](https://www.advisory.com/daily-briefing/2024/03/28/ai-nurses), [Hippocratic AI](https://hippocraticai.com/hippocratic-ai-announces-series-c-funding-126-million/) |
| Kaigo Health (YC F25) | **Verified, with a caveat** | Its YC profile matches your description. Its site appears to have pivoted to SNF revenue recovery by September 2026 (unconfirmed). | [YC](https://www.ycombinator.com/companies/kaigo-health), [kaigohealth.ai](https://www.kaigohealth.ai/) |
| Beacon Health (YC W26) | **Verified** | "AI employees for primary care": screen-based EHR automation for value-based practices. | [YC](https://www.ycombinator.com/companies/beacon-health) |
| *(new)* Other AI entrants | **Verified** | Cadence: $100M Series C at $1.23B (June 2026). Ellipsis Health: $45M Series A (June 2025). Medsien. Innovaccer markets AI voice for CCM. | [STAT](https://www.statnews.com/2026/06/23/cadence-100-million-raise-automate-chronic-care-ai/), [Fierce](https://www.fiercehealthcare.com/ai-and-machine-learning/ellipsis-health-banks-45m-ai-care-manager-backed-salesforce-khosla-ventures), [Medsien](https://www.vcbacked.co/company/medsien), [Innovaccer](https://innovaccer.com/blogs/best-ai-voice-agent-chronic-care-management-follow-up) |
| *(new)* Enforcement actions | **Verified** | Bluestone $14.9M (June 2024). WNY Medical $251k. BioTelemetry $44.9M over offshore review (December 2022). Piedmont $4.8M. Sunshine Care Partners: 10-year exclusions (OIG enforcement page). | [DOJ Bluestone](https://www.justice.gov/usao-mn/pr/chronic-disease-management-provider-pay-149m-resolve-alleged-false-claims), [DOJ WNY](https://www.justice.gov/usao-wdny/pr/wny-medical-agrees-pay-250000-resolve-allegations-improper-medicare-billing-chronic), [DOJ BioTelemetry](https://www.justice.gov/usao-edpa/pr/cardiac-monitoring-companies-pay-more-448-million-resolve-false-claims-act-liability), [OIG enforcement](https://oig.hhs.gov/fraud/enforcement/) |
| *(new)* TCPA | **Verified** | FCC 24-17 (February 2024): AI voices are "artificial." FCC 26-67 (30 September 2026) rewrote consent revocation. | [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2024/02/fcc-declares-authority-and-intent-to-regulate-ai-generated-calls-under-the-tcpa), [Crowell](https://www.crowell.com/en/insights/client-alerts/fcc-officially-adopts-amendments-to-tcpa-rules) |
| Industry median enrollment is about 24% | **No source found** | ChartSpan says in-house programs average about 10%. | — |

**Not verified this session.** The search budget ran out and no page fetch got through, so these remain open:
- BLS wages ($93.6k RN, $62.3k LPN, $44.2k MA are from memory);
- supplemental-coverage and QMB shares;
- Nurse Licensure Compact membership;
- B1/B2 wait times;
- current status of the H-1B $100k fee, and E-2 rules;
- YC batch dates;
- state AI-disclosure laws;
- seniors' acceptance of AI calls;
- CCM caseload benchmarks;
- the full list of APCM service elements;
- ACCESS model terms;
- whether MA plans actually pay these codes;
- 2025 APCM claim counts;
- EHR vendors' offerings.
