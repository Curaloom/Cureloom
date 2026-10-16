# Cureloom: seed partner teardown, 16 October 2026

**PASS.**

*How to read the labels.* **VERIFIED** means the fact appears in the cited page as returned by a search engine; this environment could not open full pages (every direct fetch to CMS, the Federal Register, OIG, KFF and company sites was refused by the network policy), so "verified" is one notch weaker than a full-page read, and I say so where it matters. **FOUNDERS' CLAIM** is your number, unproven. **ASSUMPTION** is mine, with the basis stated. **[Repo]** means I read it in the prototype on this branch. Sources are collected in Part 10. A separate earlier teardown exists on branch `claude/wizardly-mayer-0pw2mx`; I rebuilt everything independently, and where my numbers differ from it, mine use higher, BLS-based nurse costs and therefore come out worse for you.

## 1. Investment decision

**PASS.**

**The single most important reason.** The only line in this business that can earn a margin rests on a labor-productivity number nobody has measured, and the thing the buyer can actually see is identical to what incumbents have sold since 2016. Under CCM, Medicare pays for 20 human minutes, so your AI cannot remove the cost that matters; at BLS wages a CCM patient costs $31–40 a month to serve against a $25.65 net fee, so you lose money on every one. Under APCM, your 53% gross margin needs one nurse to cover 1,400 patients, which is 5.1 productive minutes per patient per month for reviewing the call, handling the 15% with concerns, chasing the 20% who don't answer, calling the 12% who refuse the robot, maintaining the care plan and filing the note. My bottom-up count is 10.7 minutes, or about 650 patients, at which point gross margin is 14% and a practice never pays back what it cost to win. Meanwhile the practice does not see your headcount. It sees "Medicare revenue with no hiring", ChartSpan's slogan, at ChartSpan's price, from a company with no customers, no clinician, and no founder able to sit in its waiting room. Everything else in this memo (team location, patient-data access, the audit traps in the prototype, the CY2027 rule) compounds the problem, but most of it could be fixed with money and hires. This cannot be fixed without changing what you sell or whom you sell it to.

**What would have to be true to flip this decision** (each testable inside six months):

1. **Paying demand.** Three independent practices signed at $27 PPPM or more for APCM only, one live for 90 days, and one that turned down an incumbent and can say why it chose you.
2. **Enrollment.** At least 30% of eligible traditional-Medicare patients consented within 120 days of go-live, at a consent cost of $25 or less per enrolled patient, with your visit-based process.
3. **Patient acceptance.** Across at least 200 consented patients aged 75 and over, at least 65% complete the monthly AI check-in within three attempts, and no more than 15% ask to stop AI calls or switch to a human.
4. **Nurse capacity.** At least 850–900 APCM patients per RN FTE for two consecutive months, measured, with zero missed urgent escalations and a 95% or better pass rate on an independent chart-and-billing audit.
5. **Economics.** Measured APCM gross margin of 35% or more, CAC of $10k or less per practice, payback of 24 months or less. On my model that requires enrollment near 44% at 900 per nurse, or 26% at your 1,400, so conditions 2 and 4 have to come in at the top of their ranges together.
6. **Team.** One founder physically in the US with a work-authorized path confirmed in writing before the batch; a US-based clinical-operations co-founder with 10% or more equity who has run a CCM, home-health or practice nursing operation; a signed medical director; malpractice, technology E&O and cyber cover bound.
7. **Policy.** The CY2027 final rule, due about 1 November, finalizes nothing that extends the employed-staff requirement beyond RPM/RTM, adds no time or contact requirement to APCM, and the conversion factor cut stays near the proposed −1.68%. Plus counsel's written view that an APCM month built on your element set is defensibly billable.

For the pivot in Part 7, one result alone would get a second meeting: **two paid design-partner pilots with care-management operators at $4 PPPM or more for the software and AI layer alone.**

**Missing information that would change the verdict:**
- The technical founder's location and US work status. If they are in the US with authorization, the team flaw drops from fatal to serious.
- Any warm path into practices (a physician relative, a billing company, an IPA). It would halve CAC and get a pilot live in 60 days.
- 2025 APCM claim volumes by practice size. None are public. If small independent practices already bill APCM at scale, incumbents have taken it; if they barely bill it, the barriers are quality reporting and documentation, which your design does not touch. Either answer hurts the current wedge, but they point to different pivots.
- Measured nurse minutes per APCM patient-month from any real operation.
- Whether both founders are full-time and how many months of runway they have.

**Should you drop it?** Drop the done-for-you services company, keep the insight. APCM pays less than CCM and has no time rule, so whoever employs the nurses must cut minutes per patient-month; your prototype is a decent first draft of that workflow. Sell it as software to the operators who already employ the nurses and own the practice relationships (Part 7). If neither founder can be in the US by mid-2027 and you cannot recruit a US clinical operator within 90 days, drop US care delivery entirely; software sold to US operators is the only version of this company the current team can run from where it sits.

## 2. Fatal flaws, serious flaws, fixable flaws

### FATAL: kills the company unless the business itself changes

**F1. The margin lives in a caseload nobody has measured, and the line you lead with loses money on every patient.**
- *What.* CCM at a $27 flat fee is loss-making under any nurse staffing; APCM is profitable only above about 850–900 patients per RN.
- *Evidence and math.* BLS May 2025 median RN wage is $97,550 (VERIFIED, via secondary citation of OEWS) and benefits add about 43% (BLS ECEC, December 2025, VERIFIED), so a median RN costs about $139k loaded; your $18.91 at 380 patients implies $86k all-in (FOUNDERS' CLAIM), below the median wage before benefits. At 7,160 productive minutes a month, 380 CCM patients at 80% billed consume 6,080 counted minutes, 85% of capacity, before any uncounted work; 320 is the real ceiling. Cost per CCM patient-month: $40.31 with an RN, $30.83 with an LPN, $21.18 with a medical assistant, against $25.65 net (Part 4.3). APCM at 650 per RN costs $22.00 (14% margin); at 900 with an assistant $17.76 (31%); at your 1,400 $12.09 (53%). The AI line is $0.75–1.00; it is 4–5% of cost. CMS's own evaluation found the average CCM biller managing 47 patients a month and the median 10 (Mathematica 2017, VERIFIED via secondary), so there is no public evidence anyone runs the caseloads your model needs.
- *Why fatal.* In a time-based code the human minutes are the product; AI can only trim the uncounted 4. In APCM the margin is a productivity bet with no data behind it, and every 10 points of AI-call non-completion adds about a nurse-minute per enrolled patient and cuts capacity 8–10%.
- *Fix.* Drop done-for-you CCM. Measure the APCM caseload in a live pilot before anyone funds it. Or change the business (Part 7).

**F2. Your advantage is invisible to the buyer, and the buyer segment cannot carry a venture outcome.**
- *What.* "Fewer humans" is your cost structure; the practice buys outcomes it can see, and incumbents already sell them.
- *Evidence.* ChartSpan has sold turnkey CCM since 2016, launched full-service APCM on 4 June 2025, claims 45% enrollment (its pages also say 35% and 60%+), sells through hospital associations, and bought Validic in June 2026 (VERIFIED, company and trade sources). HealthSnap announced "AI-augmented APCM" in 2026 and raised $25M in August; CircleLink markets "agentic APCM"; Medsien sells managed APCM "live in 5 days, no added staff"; TimeDoc, CareHarmony, Tellihealth and CareTrack all sell staffed programs; eClinicalWorks ships a native APCM module with eligibility, consent, QMB flagging and batch claims (all VERIFIED as company claims). Even with all that supply, CCM reaches about 4% of eligible beneficiaries and has held there through 2023 (Mathematica via KFF Health News, VERIFIED); the AAFP's September 2026 letter says CMS "is concerned that uptake of [APCM] has remained lower than expected" and asks CMS to waive copays and drop mandatory MVP reporting (VERIFIED). The barriers are patient cost-sharing, documentation and quality reporting, not vendor labor cost; cheaper vendor labor moves none of them.
- *Scale math.* At 25% enrollment a practice is worth $36k a year to you; $100M needs about 2,600 practices. The whole revenue pool for your exact wedge (29M traditional-Medicare beneficiaries × two-thirds with 2+ conditions × roughly 30% attributed to small independent primary care × 25% enrollment × $27 × 12) is about $0.47B a year at 100% share, $0.84B at your 45% (ASSUMPTION on the 30%). A 5% share is a $23–42M company. Both multipliers shrink every year: MA is 55% now and heading to 63% (KFF, CBO, VERIFIED); physicians in practices of 10 or fewer fell from 61.4% to 47.4% between 2012 and 2024 (AMA, VERIFIED).
- *Why fatal.* You would be selling the incumbents' promise with less trust (a robot calling their patients), no references, and no integration, into a pool that cannot return a fund even if you won it.
- *Fix.* Change the buyer (Part 7). Nothing inside the wedge fixes this.

**F3. Nobody confirmed to be in the company can be where the work is.**
- *What.* The first ten customers, the first nurse, the escalation protocol and the first production incident all need a person in the US with clinical standing or data access, and the plan has none.
- *Evidence.* The CEO is in India; first-time B1/B2 interview waits were reported at 10–12 months in September 2026 (VERIFIED, aggregator citing State Department data; the official appointment system could not be opened), and a visitor visa does not permit work. A presidential proclamation of 18 September 2026 extended the $100,000 fee on consular H-1B petitions through September 2027, with a First Circuit order against collection under appeal (VERIFIED, law-firm alert). Your counsel says no production patient data may be accessed from outside the US at launch (FOUNDERS' CLAIM). No clinician or clinical advisor exists. The technical founder's location and work status are not stated. The YC Fall 2026 batch ran in person in San Francisco (VERIFIED, aggregator), and YC itself has said visa problems stop founders attending.
- *Why fatal.* This buyer is won in the hallway. The first nurse must be hired, credentialed in a practice's EHR and supervised by someone who knows what good telephonic care management is. The AI's 911 script needs a US physician's signature. Your own counsel's rule means the CEO cannot look at a production bug involving a patient record.
- *Fix (within about 90 days, or stop).* The technical founder (UK citizen) moves first: ESTA for meetings now, E-2 or O-1 with counsel. Recruit a US-based clinical-operations co-founder with 10–20% equity. Until a visa lands, the CEO owns only work that touches no patient data: product, fundraising, remote channel sales.

### SERIOUS: kills fundraising or growth unless fixed in 3–6 months

**S1. Under APCM you charge for the one element it doesn't require and skip the ones it does.**
- *Evidence.* APCM has no time threshold and no explicit monthly-contact element; the practice must be able to furnish all elements in any billed month, including 24/7 access to the care team, a comprehensive care plan, care-transition management, population-level analysis and continuity with a designated team member (CMS APCM FAQ and AAFP summary, VERIFIED via secondary). MIPS-eligible clinicians billing APCM must register for and report the Value in Primary Care MIPS Value Pathway (CY2025 QPP rule, still in force for 2026; VERIFIED via secondary). A 3-physician practice with 470 traditional-Medicare patients is almost certainly above the MIPS low-volume threshold, so it must report, and nothing in your product helps it do so. Your prototype makes an APCM month billable once any call reached the patient, the note is pasted and the physician attests [Repo: `server/billing.ts:57-61`]; the required elements appear nowhere in the audit trail you say is your differentiator.
- *Why serious.* You take 50% of APCM collections for the optional part. A program-integrity reviewer reading "billed G0558 at $117.24 because an automated call connected" during an open CCM audit is the risk the practice carries, and the one a sophisticated buyer will ask about first.
- *Fix.* Deliver the elements, including MVP reporting through a registry partner; design deliberate human touchpoints into the month; get counsel's written view of what makes an APCM month defensible with your element set.

**S2. Zero customer evidence, and your enrollment assumption contradicts your own consent design.**
- *Evidence.* No completed practice conversation, no LOI, no pilot (FOUNDERS' CLAIM). 45% is ChartSpan's number from its own outbound enrollment call center; it says in-house programs reach about 10% (VERIFIED as company claims); population-level reach is about 4–6% (VERIFIED); no primary source for a "24% industry median" exists (only an unsourced vendor blog). Your default is consent at the office visit, which ties enrollment to a visit cadence of three or four a year and to a physician remembering to pitch a program that costs the patient about $13 a month under CCM; 13% of traditional-Medicare beneficiaries have no supplemental coverage and Medigap Plans K and L cover only part of coinsurance (KFF, VERIFIED). Phone consent costs about $50 of RN time per enrolled patient and is not in your model.
- *Effect.* At 25% instead of 45%, revenue per practice falls from $68.5k to $36k; even on your own cost numbers break-even moves from 50 practices to 155 (Part 4.5).

**S3. Whether patients aged 75 and over will answer and finish an automated monthly call is untested, and the best public data says a third won't.**
- *Evidence.* The only sizeable study I found (Emory/Guidehealth, AHA 2025, about 2,000 mostly 65+ adults) reached 85% over ten weeks of repeated attempts and 67% of those reached completed, which is 57% completion (VERIFIED, preliminary). 80–86% of unidentified calls go unanswered (Hiya 2025–26) and only 19% of Americans usually answer unknown numbers (Pew 2020), fewer among older adults (VERIFIED). One automated-call study saw 14% fail identity verification. Your prototype has never made a phone call; it has no telephony or language-model dependency [Repo: `package.json`; README "Not built"].
- *Why serious.* Every patient who won't do the AI call moves to the nurse queue at 8–12 minutes a month, and the APCM caseload falls with them.
- *Fix.* Branded caller ID, pre-call text, caregiver routing, and a 100-call test on real seniors before you pitch anyone (Part 9, item 3).

**S4. Go-to-market does not match how this buyer buys.**
- *Evidence.* LinkedIn into practice owners who decide in person; the CEO 9.5–13.5 hours ahead of US time. Channels you name take 10–20% and already have partners: ChartSpan sells through state hospital associations, Elation's marketplace lists CareTrack and ChronicCareIQ, eClinicalWorks ships its own module, Aledade runs its own outreach for 3,000 organizations (VERIFIED). Practice-facing SaaS reports 3–6 month cycles (Phreesia 10-K, VERIFIED) and about 11% gross dollar churn even for stickier products (Weave 10-K, VERIFIED).
- *Effect.* I carry $12k CAC and $5.5k onboarding; through a channel at 15% of fee, payback stretches to 135 months (Part 4.5).

**S5. Your one payer is moving against your structure, and the next decision lands in two weeks.**
- *Evidence.* The CY2027 proposed rule (issued 14 July 2026, comments closed 14 September) would pay RPM and RTM only when clinical staff are direct employees of the billing practitioner, require an initiating visit, and revalue the codes down; CCM, PCM and APCM are exempt as proposed, but the same rule carries a care-management RFI on fraud, supervision and initiating visits that Nixon Law Group reads as the CY2028 proposals in draft and TimeDoc reads as CMS having "questions about fraud, waste, and abuse across care management services broadly" (VERIFIED, law-firm and vendor summaries). The proposed non-APM conversion factor is $32.8409, −1.68%, which takes 99490 to about $65.02 and G0557 to about $52.88 while your $27 does not move (VERIFIED/ASSUMPTION). OIG opened audit OAS-26-09-007 of CCM payments "at risk of noncompliance" with the multiple-chronic-condition rule on 16 March 2026, reporting in FY2028 (VERIFIED). Bluestone paid $14.9M in June 2024 in one of the first CCM False Claims Act settlements, with a corporate integrity agreement; counsel describe CCM as a current DOJ priority (VERIFIED).
- *What to watch on 1 November.* Whether the employed-staff rule is finalized for RPM as proposed (the signal), anything CMS says in response to the care-management RFI, whether APCM gains or loses requirements, and the final conversion factor. Also H.R. 8261, which would waive CCM coinsurance from January 2027; it has been in committee since April with no markup (VERIFIED). If it passes, enrollment gets easier for everyone, incumbents first.
- *Fix.* None within your control. Hedge by making the product usable by staff a practice or operator employs.

**S6. The prototype builds audit exposure in.**
- *Evidence.* Any two ICD-10 codes from a list that includes hyperlipidemia (E78.5), hypothyroidism (E03.9) and unspecified osteoarthritis (M19.90) qualify a patient [Repo: `shared/codes.ts:20-30`]. The OIG audit tests exactly whether patients met the multiple-chronic-condition standard of significant risk of death, decompensation or functional decline. The choice between G0558 ($117.24) and G0557 ($53.78) rests on an `is_qmb` column the practice types into a CSV [Repo: `server/billing.ts:14`, `server/roster.ts:55-72`]; QMB status changes with Medicaid redeterminations and should come from an eligibility check. Coverage type comes from the same CSV. Duplicate same-month billing by a second practitioner was $1.4M of the $1.9M in OIG's 2021 overpayment findings (VERIFIED), and you have no claims visibility to detect a cardiologist's vendor already billing the patient.
- *Fix.* Monthly eligibility and QMB verification through a clearinghouse, clinical-risk criteria with a physician attestation of risk, and a duplicate-billing check in the practice's PM system. Each adds $0.25–0.50 per patient-month.

**S7. Clinical governance, liability and state AI law.**
- *Evidence.* On an urgent answer the AI "jumps straight to the escalation line and ends the call" [Repo: `shared/aiCall.ts:3`]; there is no warm transfer and no agent-initiated EMS call; the nurse's 30-minute acknowledgement starts after the patient has been hung up on. The decision is made by a keyword parser [Repo: `shared/parse.ts:162`] with unmeasured sensitivity. No medical director, no signed protocol, no malpractice, E&O or cyber cover (FOUNDERS' CLAIM). State law now bites: California AB 3030 requires an AI disclaimer at the start and end of audio clinical communications plus instructions to reach a human; California AB 489 (operative 1 January 2026) and Oregon HB 2748 forbid AI from using "nurse" and similar titles; Texas TRAIGA (effective 1 January 2026) requires disclosure of AI use in care by the first date of service, with attorney-general penalties of $10k–$200k per violation, and your demo practice is in Texas; Utah requires disclosure at the start of a verbal interaction; Illinois bars AI from therapeutic communication, which touches your low-mood and self-harm questions (all VERIFIED, law-firm and regulator summaries).
- *Fix.* A medical director who signs the protocol, warm transfer, bound insurance, measured escalation precision and recall, and a state-by-state script review before launch.

**S8. "No integration" is manual integration, and it scales linearly with patients.**
- *Evidence.* The brief says you never view the chart; the prototype's nine-step month includes EHR chart review, EHR medication review and EHR care-plan review, each flagged as EHR work [Repo: `shared/constants.ts:82-103`], and the note is pasted into the EHR by your nurse, so you need credentials in every practice's EHR. The practice uploads a 17-column CSV each month including coverage and QMB [Repo: `server/roster.ts:55`], and the physician attests every patient every month [Repo: `server/billing.ts:61`]. At 50 practices and 25% enrollment that is 50 CSVs, about 5,900 pasted notes and 5,900 attestations a month across 8–12 EHRs (ASSUMPTION). Tellihealth's nurses already work inside the client EHR; eClinicalWorks is native; Beacon Health automates the screen work (VERIFIED).
- *Fix.* Pick the two EHRs your first ten practices use and integrate roster pull and note write-back, or partner with someone who has.

**S9. Fee shape and the half of the panel you zeroed.**
- *Evidence.* A flat $27 per enrolled patient is the right legal direction, but it bills the practice for months it cannot bill Medicare (about 20% of CCM months), it is still 50% of APCM collections, and it needs an FMV opinion you don't have. Your prototype pauses Medicare Advantage patients as ineligible [Repo: `server/roster.ts:215`]; MA plans must cover Part B services and many pay CCM and APCM under contract, so you have designed out 55% of the panel rather than checked each practice's top three MA contracts (ASSUMPTION on MA payment practice; coverage requirement is statutory).
- *Fix.* Price per serviced patient-month or in per-practice tiers, with counsel; check MA contracts practice by practice.

**S10. The expansion story walks into the scrutiny.**
- *Evidence.* RPM is the service CMS proposes to close to contracted staff. The new APCM behavioral-health add-ons (G0568–G0570, VERIFIED) require collaborative-care structures with a psychiatric consultant, not a phone call. "Sell the platform later" means competing with ThoroughCare (about 700 organizations), ChronicCareIQ (from about $5 a month) and Prevounce at $2–25 PPPM (VERIFIED/third-party estimates) from a $27 PPPM services habit.

### FIXABLE: real, but solvable with normal execution

- **X1. Working capital.** About $370k of financed cost and $240k of receivables at 50 practices (Part 4.7). ACH autopay, net-15, a receivables line.
- **X2. TCPA mechanics.** AI voices are "artificial" under the FCC's February 2024 ruling; informational calls to cell phones need prior express consent; the healthcare exemption allows at most one call a day and three a week with no billing content; revocation by any reasonable means has applied since April 2025, with the "revoke-all" rule delayed to 31 January 2027; after McLaughlin v. McKesson (June 2025) courts need not defer to FCC interpretations (all VERIFIED). Your design (automated-call permission inside enrollment consent, "stop calling me" revokes) points the right way; name the vendor in the consent and keep counsel on it.
- **X3. Caller ID.** Unknown numbers get labelled spam; use branded, registered caller ID per practice and 10DLC for texts.
- **X4. Nurse licensure.** About 40 states are in the Nurse Licensure Compact; California, Nevada, Illinois, New York, Michigan, Minnesota, Oregon and others are not (VERIFIED via secondary). Start in compact states; Texas qualifies.
- **X5. HIPAA program.** BAAs with the practice, telephony, speech and LLM vendors; US-only production access; SOC 2 Type I inside 12 months.
- **X6. Insurance.** Professional liability, technology E&O that covers AI, cyber. Quote now; it is a cost-of-service line.
- **X7. Model hygiene.** Separate CCM and APCM P&Ls; add CAC, cycle, ramp, churn, working capital, account management, compliance.
- **X8. 24/7 access.** Name in the contract who covers it: the practice's on-call or a contracted triage line.
- **X9. Make the AI real.** Real telephony and a voice-agent stack, with latency, barge-in and hearing-loss handling measured on seniors.
- **X10. Staffing mix.** CMS allows LPNs and medical assistants as clinical staff under state scope and general supervision (MLN booklet, VERIFIED); use them for non-judgment work and reserve RNs for escalation. Basu (2015) found higher net gain per patient with LPNs and MAs than RNs (VERIFIED).

## 3. Harsh scorecard

10 = best in class; most early companies score 3–5. For the two risk rows, a high score means low risk.

| Dimension | Score | One sentence |
|---|---|---|
| Problem severity | 4 | For the buyer this is unclaimed revenue of roughly $12–13k per physician per year at realistic enrollment, not a pain; a decade of done-for-you vendors and roughly 5% uptake show how little it hurts. |
| Reachable market size | 3 | Traditional Medicare times small independent primary care is a wedge whose entire revenue pool is about $0.5B a year at your price and realistic enrollment, and both multipliers are shrinking. |
| Why now | 5 | APCM's flat fee and cheap voice AI are real catalysts, but they arrived for everyone at once, and CMS's 2027 proposals show the policy wind turning against outsourced care management. |
| Wedge choice | 2 | You picked the slowest, smallest-ticket, most-pitched buyer in US healthcare, reachable only in person, for a team that cannot be in the room. |
| Differentiation | 2 | "Fewer humans" is your cost structure, not the practice's benefit; the practice sees the same "Medicare revenue without hiring" promise ChartSpan has made since 2016, minus the references. |
| Business model and pricing | 3 | A flat $27 is the right legal shape but loses money on every CCM patient and takes half of APCM collections for the one element APCM does not require. |
| Unit-economics realism | 2 | Nurse cost is about a third under market, caseloads are 20–110% above what the minutes allow, enrollment is the leader's best marketing claim, and CAC, ramp, churn and working capital are absent. |
| Services-vs-software risk | 2 | At 650 APCM patients per nurse, the nurse is 72% of cost and the AI is 5%; this is a staffing company with a good queue screen. |
| Go-to-market | 1 | Zero completed conversations, LinkedIn as the channel into an owner who buys in the hallway, run from a time zone 9.5–13.5 hours ahead. |
| Regulatory and policy risk | 3 | One payer that reprices you every November, an open OIG eligibility audit of your core code, a proposed employed-staff rule on your first expansion line, and an RFI on your staffing structure. |
| Clinical and operational risk | 2 | An unsigned escalation protocol that hangs up on a patient reporting chest pain, no medical director, no insurance, and a manual multi-EHR workflow that grows linearly with patients. |
| Team and founder-market fit | 1 | No healthcare operator, no clinician, the CEO 6–12 months from a visitor visa, and counsel saying nobody offshore may touch production patient data. |
| Defensibility | 1 | No data, no relationships, no integrations, no regulatory position, and an "AI" that is today a keyword parser and a state machine. |
| Fundability today | 1 | Pre-customer, services-heavy, no domain operator, no US presence: an automatic pass for any seed fund that has done this category. |
| Fundability with 2–3 paid pilots | 3 | Pilots fix the evidence gap, but not the CCM loss, the scale ceiling or the team; they move you from "pass" to "watch", and only measured APCM caseload above 850 per nurse plus a US clinical co-founder gets to a real conversation. |

## 4. Tear down the numbers

The model is in `docs/investor-review/unit_economics.py` (run `python3 -I docs/investor-review/unit_economics.py`). Every input below is mine unless marked FOUNDERS. The headline answers:

- **On your own numbers, with only CAC, ramp, churn, account management and real opex added, break-even moves from 50 practices to 75 and payback is 17 months.** That is the best case, and it still assumes 45% enrollment and caseloads I show below are not physically available.
- **At 25% enrollment, CCM loses money under every staffing model except medical assistants, and APCM at a measurable caseload (650 per RN) makes about $63 per practice per month after account management, which never pays back a $17k acquisition cost.**
- **The only configuration that works is APCM-only at 900 or more patients per RN with enrollment at 35% or more:** 31% gross margin, payback 30–42 months, company break-even at 180–300 practices.
- **Enrollment floor:** at 900 patients per RN, contribution turns positive at 10% enrollment but payback inside 24 months needs 44%; at your 1,400 it needs 26%. Below about 25% enrollment the business does not work in any configuration you can staff.

### 4.1 Your model, reproduced (FOUNDERS)

| Item | Your figure | Reproduced |
|---|---|---|
| Enrolled per practice | 470 × 45% ≈ 210 | 212 |
| Practice collects | ~$10,800 (CCM) / ~$11,300 (APCM) per month | 212 × $66.13 = $13,986 at 100% billable; your $10,800 implies 77% of months billed. APCM: 212 × $63.30 = $13,388; your $11,300 implies 84% billed |
| Your revenue per practice | n/a | 212 × $27 = $5,710/month = $68.5k/year |
| Nurse cost implied by $18.91 at 380 CCM patients | n/a | $7,186/month = **$86.2k/year fully loaded** |
| Non-nurse cost implied in APCM $7.84 | n/a | $7.84 − $18.91 × 380 ÷ 1,400 = **$2.71** |
| 50 practices | ~$3.3M run-rate | $3.4M; your 50-practice break-even therefore implies total opex of about $1.66M, including all sales, nursing supervision, compliance and founders |
| $100M revenue | ~1,500 practices | 1,459 |

Two inputs fail on contact with public data before any judgment is applied:

- **Nurse cost.** BLS May 2025 median RN wage is $97,550 and benefits add about 43% (BLS Employer Costs for Employee Compensation, December 2025), so a median RN costs about $139k fully loaded. Your $86k all-in is below the median wage before benefits. I use $88k base × 1.40 = $123k, which assumes you hire below-median remote care managers; it is still generous.
- **Caseload.** A nurse has 10,400 paid minutes a month. After 10% PTO and sick leave, 10% meetings, training and administration, and 85% utilization on patient work, about 7,160 minutes are available. At 380 CCM patients with 80% billed, the counted minutes alone are 380 × 0.8 × 20 = 6,080, which is **85% of productive minutes** before a single failed dial, EHR login, pasted note or escalation. At 1,400 APCM patients, each patient gets **5.1 productive minutes a month**, inside which the nurse must review the AI call, handle every concern, chase every unreached patient, call every patient who refused the robot, maintain the care plan and file the note.

### 4.2 My assumptions

| Input | Yours | Mine | Basis |
|---|---|---|---|
| Eligible traditional-Medicare patients per practice | 470 (3 physicians) | 470, and 313 for a 2-physician practice | Kept for comparability; 42% of billers in CMS's CCM evaluation were solo practices |
| Steady-state enrollment | 45% | **25%** | 45% is ChartSpan's marketing figure (its own pages also say 35% and 60%+), achieved with its own outbound enrollment call center; it says in-house programs reach about 10%. Your default is consent at the office visit. No primary source for a 24% industry median exists. |
| Enrollment ramp | None | Months 1–2 zero; linear to steady state by month 12 | Visit-based consent follows visit cadence |
| Share of enrolled months billable | ~77–84% implied | CCM 80%, APCM 93% | Unreached CCM patients don't reach 20 minutes; APCM needs no contact |
| Fee collected by you | $27 | $27 × 95% | Credits for unbillable months and bad debt on a flat fee |
| RN fully loaded | $86k implied | **$123k** ($10,267/month) | $88k × 1.40; BLS median would be $139k |
| LPN / MA fully loaded | n/a | $87k / $63k | Same load |
| CCM patients per nurse | 380 | **320** | 7,160 ÷ 22.4 minutes (80% billed at 22 counted + 4 uncounted; 20% unbilled at 8) |
| APCM patients per nurse | 1,400 | **650** base, **900** with an ops assistant doing pasting and scheduling | 10.7 minutes bottom-up: 0.75 review, 1.8 concerns (15% × 12), 0.3 urgent, 1.6 unreached (20% × 8), 1.4 decliners (12% × 12), 1.5 care plan, 0.6 transitions, 1.5 note and paste, 1.2 coordination |
| Supervision | None | 1 nurse manager ($168k loaded) per 8 nurses | Quality assurance, escalations, audit readiness |
| AI, telephony, speech, LLM | ~$2.71 implied (APCM) | $1.00 APCM / $0.75 CCM | About 8 telephony minutes and 5 connected voice-AI minutes a month; AI is not the cost problem |
| Infrastructure, 24/7 reserve, insurance, re-consent | None | $0.50 + $0.75 (APCM) or $0.25 (CCM) + $0.40 + $0.86 | 2% monthly patient churn (deaths, moves to MA, opt-outs) re-consented by phone at 30 minutes |
| CAC per practice | None | **$12,000** | One AE plus one SDR closing ~1.5 practices a month, with tools and travel; Phreesia reports 3–6 month cycles for practices |
| Onboarding | None | $2,500 + phone consent for half of enrollees at 35 RN-minutes each ≈ **$5,500** | |
| Account management and monthly ops | None | **$344 per practice-month** | One CSM per 35 practices plus the monthly CSV, attestation chase and billing reconciliation |
| Practice churn | None | 1.5% a month (17% a year) | Weave reports 11% gross dollar churn on SMB practices with a far stickier product; practice acquisitions run in the thousands a year |
| Fixed opex excluding sales and CS | $1.66M implied | **$2.0M** | Two founders, three engineers, director of nursing, part-time medical director, compliance, finance, insurance, security, legal |
| Working capital | None | ~2.5 months of cost of service | Service month, then practice bills, Medicare pays in 14+ days, practice pays you net-30 |

### 4.3 Cost per enrolled patient-month

Net fee after credits: $25.65.

| Configuration | Nurse | Supervision | AI/telephony | Other | Total | Gross margin | Fee needed for 40% GM |
|---|---|---|---|---|---|---|---|
| CCM, RN, 320 per nurse | 32.08 | 5.47 | 0.75 | 2.01 | **40.31** | **−57%** | $70.72 (more than Medicare pays) |
| CCM, RN, 380 (your caseload) | 27.02 | 4.61 | 0.75 | 2.01 | 34.38 | −34% | $60.32 |
| CCM, LPN, 320 | 22.60 | 5.47 | 0.75 | 2.01 | 30.83 | −20% | $54.09 |
| CCM, MA, 380 | 13.82 | 4.61 | 0.75 | 2.01 | 21.18 | +17% | $37.16 |
| APCM, RN, 500 | 20.53 | 3.50 | 1.00 | 2.51 | 27.54 | −7% | $48.32 |
| APCM, RN, 650 (my base) | 15.79 | 2.69 | 1.00 | 2.51 | **22.00** | **+14%** | $38.59 |
| APCM, RN, 900 + ops assistant | 11.41 | 1.94 | 1.00 | 3.41 | **17.76** | **+31%** | $31.16 |
| APCM, RN, 1,400 (your caseload) | 7.33 | 1.25 | 1.00 | 2.51 | 12.09 | +53% | $21.22 |
| APCM, LPN, 650 | 11.13 | 2.69 | 1.00 | 2.51 | 17.33 | +32% | $30.40 |
| *Yours* | | | | | *CCM 18.91 / APCM 7.84* | *30% / 71%* | |

Read across: in a time-based code the 20 minutes must be human, so AI only trims the 4 uncounted minutes, and CCM cannot be made profitable at $27 with any nurse. The AI line is 4–5% of APCM cost; the nurse is 65–72%. This is a staffing business.

### 4.4 What the practice actually nets

| | CCM | APCM |
|---|---|---|
| Gross per enrolled patient-month | $66.13 | $63.30 (85% at $53.78, 15% at $117.24) |
| Billable months | 80% | 93% |
| After 15% uncollected coinsurance on non-QMB patients and a 6% biller | $48.24 | $54.14 |
| Minus your $27 | **$21.24** | **$27.14** |
| Your share of what the practice collects | 56% | 50% |
| Per 3-physician practice per year at 25% enrollment | $30k | $38k (about $12.8k per physician) |
| At your 45% | $54k | $69k |
| With the proposed 2027 conversion factor (−1.68%) | $20.43 | $26.23 |

ChartSpan advertises "$100K+ annually with 300 enrolled patients", which is about $27.78 per enrolled patient-month net to the practice (its claim, unaudited). Your offer leaves the practice $21–27. On the leader's own marketing, you are not cheaper. The physician also spends about two hours a month attesting 118 notes.

### 4.5 Per-practice and company results

Payback is counted from signing; add 4–6 months of sales cycle for payback from first contact. LTV is survival-weighted contribution over 20 years, undiscounted.

| Scenario | Enrolled | Revenue per practice per year | GM | Contribution per month | Payback | LTV/CAC | Break-even practices (steady state) | Break-even while adding 4 practices a month |
|---|---|---|---|---|---|---|---|---|
| Yours: 45%, your costs, no CAC, ramp or churn | 212 | $65,100 | 48% | $2,596 | immediate | n/a | 53 | 53 |
| Your costs, my CAC, ramp, churn, AM and opex, 45% | 212 | $65,100 | 48% | $2,229 | 17 | 6.5 | 75 | 110 |
| Your costs, mine otherwise, 25% | 118 | $36,166 | 48% | $1,076 | 25 | 3.5 | 155 | 220 |
| **My base: 25%, half CCM (RN 320), half APCM (650)** | 118 | $36,166 | **−21%** | **−$1,013** | **never** | <0 | **never** | never |
| CCM only, RN 320 | 118 | $36,166 | −57% | −$2,089 | never | <0 | never | never |
| CCM only, LPN 320 | 118 | $36,166 | −20% | −$976 | never | <0 | never | never |
| APCM only, 500 per RN | 118 | $36,166 | −7% | −$589 | never | <0 | never | never |
| APCM only, 650 per RN | 118 | $36,166 | 14% | $63 | never | 0.1 | 2,666 | 3,783 |
| **APCM only, 900 per RN** | 118 | $36,166 | **31%** | **$560** | **42** | 1.8 | **298** | 422 |
| APCM only, 1,400 per RN (yours) | 118 | $36,166 | 53% | $1,226 | 23 | 4.0 | 136 | 193 |
| APCM only, 650, at your 45% | 212 | $65,100 | 14% | $406 | 62 | 1.1 | 411 | 606 |
| APCM only, 900, at 35% | 164 | $50,633 | 31% | $931 | 30 | 2.8 | 179 | 259 |
| APCM only, 900, 2-physician practice | 78 | $24,085 | 31% | $251 | 82 | 0.8 | 665 | 928 |
| APCM only, 900, sold through a channel ($6k CAC, 15% of fee to channel) | 118 | $30,742 | 19% | $108 | 135 | 0.4 | 1,542 | 1,966 |
| APCM only, 900, fee cut to $22 by competition | 118 | $29,469 | 15% | $2 | never | <0 | n/a | n/a |

Worked example, APCM at 900 per RN, 25% enrollment: nurse $10,267 ÷ 900 = $11.41; supervision $14,000 ÷ 8 ÷ 900 = $1.94; AI $1.00; ops assistant $0.90; infrastructure $0.50; after-hours $0.75; insurance $0.40; re-consent $0.86; total $17.76. Margin per patient $25.65 − $17.76 = $7.89. Per practice 117.5 × $7.89 = $927, minus $344 account management = **$583 a month** at steady state (the table shows $560 because ramp months are included in the average). Acquisition $12,000 + $5,500 = $17,500. Recovered over a 2-month setup and a 10-month ramp, payback lands at month 42.

### 4.6 Payback months / break-even practices by caseload and enrollment (APCM only)

| Patients per RN | 15% | 20% | 25% | 30% | 35% | 45% |
|---|---|---|---|---|---|---|
| 500 ($27.54 cost) | never | never | never | never | never | never |
| 650 ($22.00) | never | never | never / 2,666 | 145 / 1,124 | 97 / 712 | 62 / 411 |
| 800 ($19.43) | never / 2,322 | 95 / 765 | 61 / 458 | 47 / 327 | 39 / 254 | 30 / 176 |
| 900 ($17.76) | 105 / 880 | 58 / 445 | 42 / 298 | 34 / 224 | 30 / 179 | 24 / 128 |
| 1,100 ($15.33) | 59 / 462 | 39 / 276 | 30 / 197 | 26 / 153 | 23 / 125 | 19 / 92 |
| 1,400 ($12.99) | 42 / 317 | 30 / 203 | 25 / 149 | 21 / 118 | 19 / 97 | 17 / 72 |

The two swing factors are caseload and enrollment. Churn, opex and AI cost barely move the result. There is no combination at 650 per RN that a seed investor would fund, and 650 is the number my bottom-up minutes produce.

### 4.7 Working capital, collections and compliance overhead

- At 50 APCM practices and 25% enrollment you carry about 5,900 patients, 9 RNs and a manager. Monthly cost of service plus account management is about $148k against $159k of billings. With a 2.5-month cash lag you finance about **$370k of cost** and hold about **$240k of receivables**. On a $500k check, that is the round.
- Collections risk on a flat fee: about 5% of CCM claims are denied (Annals of Family Medicine, 2020); CERT puts the Part B improper-payment rate at 10.35%; duplicate same-month billing by a second practitioner is the largest historical CCM overpayment category, and you have no claims visibility to detect it. The practice eats denials and recoupments while your invoice is unchanged. Expect pressure to move to at-risk pricing within the first renewal.
- Compliance overhead: monthly eligibility and QMB verification, consent records, time-log integrity for CCM, an annual independent audit and a part-time medical director. I carry $0.40–0.90 per patient plus about $250k a year in fixed opex. Your model has none.

### 4.8 The enrollment rate below which this does not work

Defining "works" as positive contribution after account management and payback within 24 months from signing:

- 650 per RN: positive contribution needs 22%; payback within 24 months is not reachable at any enrollment.
- 900 per RN: positive at 10%; payback within 24 months needs **44%**.
- 1,400 per RN (yours): positive at 7%; payback within 24 months needs **26%**.

So even if your caseload claim were true, you need enrollment above the only measured population-level benchmark (about 4–6% of eligible beneficiaries are in CCM nationally) and above ChartSpan's claim for in-house programs (about 10%), with a visit-based consent process and no enrollment call center.

## 5. Competitive kill scenario

### ChartSpan (or TimeDoc, HealthSnap, CircleLink, Medsien) within 12 months

ChartSpan already has the pieces: full-service APCM since June 2025, an enrollment call center that produces the 45% it advertises, nurse-line coverage, an AI quality tool it says screens 100% of calls, distribution through state hospital associations, and, since June 2026, Validic's remote-monitoring platform. HealthSnap announced "AI-augmented APCM" in 2026 and raised $25M in August; CircleLink markets "agentic APCM" with AI voice and text agents supervised by clinicians; Medsien sells managed APCM "live in five days, no added staff". The incumbent's playbook:

1. **Quarter 1: license, don't build.** Sign a voice-agent vendor (Hippocratic AI, which already runs chronic-condition check-ins for WellSpan platform-wide, or any Retell/Vapi-class platform) for the APCM monthly check-in and the CCM scheduling and pre-call work. Keep the human enrollment call center, which is the part that actually produces revenue. Your entire architecture is a procurement decision for them.
2. **Quarter 2: reprice.** Their human cost per APCM patient falls by a third. They can offer practices a lower fee than your $27 or a higher net share, and still expand margin. Your only argument to the practice, "revenue with no hiring", is their decade-old slogan with references attached.
3. **Quarter 3: bundle.** APCM plus RPM (Validic) plus annual wellness visit plus MIPS reporting, sold through the hospital association the practice already trusts. You sell one SKU, with no integration, and ask the practice to upload a CSV.
4. **Quarter 4: hold the account.** Any practice you win gets a ChartSpan rep within 30 days offering a free enrollment campaign. Your practice has no switching cost toward them, because you hold nothing: no EHR integration, no device fleet, no care plans in their system.

Net effect: "fewer humans" becomes ChartSpan's margin expansion and never becomes your market share.

### Kaigo Health, Hippocratic AI, and the EHRs

- **Kaigo Health (YC F25)** is three US-based founders with YC's $500k, building AI check-in calls for Medicare-age patients, nine months ahead of you, in the batch you want to join. If it is still on this problem, YC already has this company. If it has pivoted (one directory now describes it as skilled-nursing revenue-recovery software, which I could not resolve), that is a data point about the wedge, not an opening.
- **Hippocratic AI** ($404M raised, $3.5B valuation, 30+ agentic orchestrators, 8M+ calls a month by its own claim) sells to health systems and payers, not to 3-physician practices. It does not need to. It only needs one distribution partner that already owns small practices: an EHR, an ACO enabler, or a CCM vendor. eClinicalWorks already ships a native APCM module (eligibility, consent, QMB flagging, batch claims) and an AI contact center; athenahealth has announced voice agents for the second half of 2026; Pearl Health is building care-orchestration agents for its 10,000 providers; Aledade runs outreach itself for 3,000 organizations. The day an EHR turns on an APCM check-in agent inside the chart, a vendor that "never views the chart" and asks for a monthly CSV is obsolete for that EHR's customers.
- **Beacon Health (YC W26)** automates EHR work through the screen for value-based practices. It attacks the one piece of work you push back onto the practice: pulling the roster and filing the attestation. It is not a competitor for the call; it is a competitor for the reason a practice would tolerate your workflow.

### Do the founders have a credible defense today?

No. There is no proprietary data, no integration, no enrollment engine, no clinical brand, no regulatory position, no distribution partner, and the "AI" in the repository is a keyword parser driving a state machine with no telephony or language-model dependency. The only defensible asset this company could build is measured clinical performance of its escalation and engagement logic across thousands of patient-months, and nothing in the plan produces that before an incumbent licenses the same capability.

## 6. The interview

Ten questions a skeptical YC partner asks in ten minutes, the answer this team would give today, why it fails, and what a fundable answer contains.

**1. "Who is your first customer, and what did they tell you?"**
- *Today:* "We've started LinkedIn outreach to practice managers and nurses; the ones we've spoken to informally find it interesting."
- *Why it fails:* No practice conversation has been completed. Interest from nurses on LinkedIn is not a buying signal from a practice owner. The partner now assumes every other number is invented, because it is.
- *Fundable:* Three named practices, what each said in the first five minutes, two LOIs at $27 PPPM with a start date, and one practice that turned down ChartSpan or TimeDoc and can say why it chose you.

**2. "ChartSpan has sold 'Medicare revenue with no hiring' to small practices for a decade and claims 45% enrollment. Why does a practice pick you?"**
- *Today:* "We run the whole program with far fewer humans using AI, we're built around APCM's flat fee, and we need no EHR integration."
- *Why it fails:* The practice cannot see your headcount. ChartSpan already sells APCM. "No integration" means the practice uploads a CSV every month, the physician attests every patient every month, and your nurse logs into their EHR to paste notes, which is more practice work, not less.
- *Fundable:* A benefit the practice can observe: measured enrollment above the incumbent's, zero monthly practice work because you pull the roster and stage the attestation inside their EHR, or a price at least 40% below the incumbent's net cost with the math shown.

**3. "Walk me through one nurse's month. How many patients does she cover, and how do you know?"**
- *Today:* "About 380 on CCM and about 1,400 on APCM, because AI handles the scheduling, dialing, briefs, notes and logging."
- *Why it fails:* 380 CCM patients at 80% billed means 6,080 counted minutes, which is 85% of a nurse's productive minutes before a single failed dial or pasted note. 1,400 APCM patients leaves 5 productive minutes per patient per month for reviewing the call, handling the 15% with concerns, chasing the 20% unreached, calling the 12% who refuse the robot, maintaining the care plan and filing the note. Nobody has timed any of it.
- *Fundable:* A time study: one US nurse, 60–100 real patients, two months, minutes per patient-month by activity, escalation rates, and the caseload that falls out of it.

**4. "Which of you has run a clinical operation, hired nurses, or sold to physicians?"**
- *Today:* "Neither of us, but we are recruiting a nurse and will add clinical advisors."
- *Why it fails:* The first ten customers in this category are won by someone who has sat in a practice manager's office, and the first nurse must be hired, credentialed and supervised by someone who knows what good telephonic care management looks like. An advisor does not do either.
- *Fundable:* A US-based clinical operations co-founder or first hire with meaningful equity, already signed, who has run a CCM, home-health or practice nursing operation and brings two or three warm practices.

**5. "Where will each of you physically be during the batch, and when can you legally work in the US?"**
- *Today:* "The CEO is applying for a visa and plans to relocate; the technical founder can travel from the UK."
- *Why it fails:* First-time B1/B2 interviews in India are running 6–12 months, a B1/B2 does not allow work, the $100k H-1B surcharge on consular petitions was extended in September 2026, your counsel says nobody outside the US may touch production patient data, and the batch is in person in San Francisco. The plan as stated puts nobody in the country.
- *Fundable:* One founder in the US today with a work-authorized path confirmed by immigration counsel in writing, a US entity and bank account, and a named US-based person who holds production access.

**6. "APCM doesn't require a monthly call. Why does the practice pay you half its APCM revenue for one?"**
- *Today:* "The call is how we build the audit trail, catch problems early and keep patients engaged; the practice has nobody to do this work."
- *Why it fails:* What APCM does require, and what a zero-staff practice cannot do alone, is 24/7 access to someone with the chart, a care plan in the EHR, care-transition management with hospital data, population gap analysis and MIPS Value Pathway quality reporting. Your no-integration design does none of it. You charge for the optional part and skip the mandatory parts.
- *Fundable:* A service that delivers the required elements, including the quality reporting, with the AI call as the engagement layer, priced against the practice's real alternative, which is hiring a medical assistant at about $45k.

**7. "A 78-year-old tells your AI agent she has chest pain. Exactly what happens in the next ten minutes?"**
- *Today:* "The agent tells her to call 911, ends the call, and alerts the nurse and the practice; the nurse acknowledges within 30 minutes."
- *Why it fails:* You hang up on a patient with chest pain. There is no warm transfer, no agent-initiated EMS call for a patient who cannot dial, no medical director who signed the protocol, no malpractice or technology E&O cover, and no measured sensitivity for the keyword rules that decide who gets the 911 line.
- *Fundable:* A protocol signed by a medical director, warm transfer to a nurse or an agent-initiated three-way call to EMS, bound insurance, and measured escalation precision and recall from real calls.

**8. "Your model has no customer acquisition cost, sales cycle or churn. What does it cost you to win a practice and how long does it take?"**
- *Today:* "Founder-led sales through LinkedIn and practice managers keeps CAC low; later we add channels."
- *Why it fails:* You cannot visit. Channels take 10–20% and often have an incumbent partner. My estimate is $12k per practice plus about $5k of onboarding and consent work, a 4–6 month cycle, and a payback of 42 months even in your best realistic configuration.
- *Fundable:* Measured time-to-sign and cost for the first five practices, and one channel partner signed with its economics in writing.

**9. "CMS just proposed that RPM staff must be employed by the billing practice and opened an RFI on the rest of care management. What happens to you if that reaches CCM and APCM in 2028?"**
- *Today:* "CMS exempted CCM and APCM in the proposal; we'll adapt if that changes."
- *Why it fails:* Every dollar of your revenue depends on contracted staff under general supervision. There is no hedge, no software line usable by practice-employed staff, and no voice in the comment process.
- *Fundable:* A product that practice-employed or operator-employed staff can run, a software revenue line that survives the rule, and a view on the final rule due about 1 November.

**10. "How does this become a $100M-a-year company?"**
- *Today:* "200 practices is about $13M; then RPM, transitional care, behavioral health and caregiver support; later we sell the platform to groups and ACO enablement companies."
- *Why it fails:* At realistic enrollment $100M is about 2,600 practices, roughly fifteen times the incumbent's footprint after a decade. RPM is the service CMS proposes to close to vendors. Selling the platform later means competing with $2–8 PPPM software from a position of a $27 PPPM services habit.
- *Fundable:* A buyer with larger contracts (operators, networks, dual-heavy clinics), per-patient economics 2–3× today's, and a data or workflow asset a competitor cannot buy in a quarter.

## 7. Better wedges

The current wedge is the worst available fit for this specific team: it needs in-person selling, US nurse supervision and production patient-data access, and none of the three is available to the founders for at least two quarters. Four alternatives, compared on the dimensions that matter at seed:

| Wedge | Speed to first revenue | Gross margin at maturity | Competition | Fit with this team |
|---|---|---|---|---|
| **Current: done-for-you CCM/APCM for 1–10 physician practices** | 6–9 months to a first paid practice (4–6 month cycle after you can meet them); 12 months to steady enrollment | CCM negative; APCM 14–31% at measurable caseloads | ChartSpan, TimeDoc, CareHarmony, TelliHealth, Prevounce, HealthArc, plus EHR vendors and ACO enablers adding APCM | Worst: in-person sales, US clinical supervision, patient data, none available |
| **FQHCs / RHCs and other dual-heavy clinics (APCM at G0558)** | 9–15 months (committee procurement, grants cycle), but contracts of 10–50 providers | Highest in services: G0558 pays $117.24 with no patient coinsurance, so you can charge $35–45 PPPM and the clinic still nets more than today | ChartSpan, CareHarmony and consultants; fewer AI-first entrants; UDS reporting makes MVP quality reporting less alien | Still needs US presence and clinical credibility; procurement is relationship-driven |
| **ACO enablement companies, MSOs, IPAs, mid-size CCM vendors: sell the AI check-in and nurse workflow as software** | 3–6 months to a paid pilot; they already employ nurses and already push APCM | 65–80% software margin at $4–8 PPPM or per completed call | Innovaccer, Hippocratic AI, Cadence, Ellipsis, in-house builds on Retell/Vapi; crowded but evaluated on product, not on references | Best available: the technical founder builds, the CEO sells remotely, the operator holds the patient data and the nurses |
| **Specialists (nephrology, cardiology) with PCM/CCM** | 6–12 months; larger practices but RPM-adjacent and under the same 2027 proposals | Similar to primary care; higher acuity, higher nurse time per patient | Cadence and device-led RPM companies own this ground with $100M+ of funding | Poor: needs clinical depth the team lacks even more acutely |
| **Software to existing full-service CCM vendors** | 4–8 months; few buyers; the large ones build in-house | 70%+ but tiny buyer pool | ChartSpan, TimeDoc and CareHarmony already market "AI-enhanced"; you'd sell to the 2nd and 3rd tier | Fine technically; strategically fragile, since each customer is one acquisition away from becoming a competitor |

**Recommendation: pivot to the third row, and treat the second as the only services wedge worth keeping alive.**

Why the operator-software wedge for this team:
- **It removes the three things the team cannot do.** No nurses to hire or supervise, no in-person practice sales, and no offshore access to production patient data, because the operator's staff work in the operator's systems. The technical founder can build and the CEO can sell remotely, which is the only kind of selling available until someone is in the US.
- **It sells to a buyer that already has the problem APCM creates.** Operators moved panels onto APCM in 2025–2026 and now carry a flat fee per patient with no time rule; whoever employs the nurses must cut minutes per patient-month. "Measured minutes per patient-month down 40%" is a benefit the buyer can see on a spreadsheet, unlike "fewer humans" sold to a physician.
- **It makes the APCM insight the product.** The prototype's real asset is the APCM month as a workflow: eligibility, consent, AI contact, escalation, note, attestation, audit trail. That is worth $4–8 PPPM to someone who pays $25–35 PPPM in labor today.

What it costs: smaller revenue per customer at first, a technical sale against bigger vendors, and the risk the operator builds it on a voice-agent platform in a quarter. The defense has to be measured clinical performance (answer rates, completion, escalation precision and recall, audit pass rate) accumulated across customers, which no voice-platform wrapper has.

Why not the FQHC wedge first: its economics are the best in services (no coinsurance, $117 per patient-month, 40–60% QMB panels), but it needs exactly the US clinical credibility and procurement relationships the team lacks, and the sales cycle is longer than your runway. Keep it as the services wedge to re-enter later, with a clinical co-founder, or as a channel through an FQHC network partner.

If you keep the current wedge anyway: drop CCM, sell APCM only, start in Nurse Licensure Compact states, do your own enrollment calls, and do not raise until you have measured caseload above 850 per nurse. The math in Part 4 says that is the only version that pays back inside four years, and inside two only at the 1,400-patient caseload nobody has measured.

## 8. "Are we checking all the boxes?"

Done only where the brief gives evidence. "In progress" means started with something to show. "Missing" means nothing exists.

### (a) Before applying to YC (application due early November 2026)

| Area | Item | Status |
|---|---|---|
| Business | One-sentence product and buyer that a partner can repeat back | Done (brief) |
| Business | Unit-economics model with CAC, sales cycle, ramp, churn, working capital | Missing (model has none of these) |
| Business | Written answer to "why you over ChartSpan" that a practice has agreed with | Missing |
| Customer evidence | 20+ completed conversations with practice owners or managers | Missing (0 completed) |
| Customer evidence | At least one practice willing to pilot, in writing | Missing |
| Customer evidence | A nurse who has worked a CCM program and reviewed the workflow | In progress (nurse outreach started; no review documented) |
| Clinical | Physician or nurse advisor who has read the escalation design | Missing |
| Clinical | Escalation protocol (911/988, warm transfer, acknowledgement) in a document a clinician could sign | In progress (coded in the prototype, unsigned) |
| Legal | Preliminary view on fee structure (flat PPPM vs revenue share) | Done, preliminary (brief) |
| Legal | Preliminary view on offshore access to patient data | Done, preliminary (brief: none at launch) |
| Legal | Founder equity split, vesting, IP assignment, US entity | Missing (not stated) |
| Operations | Clickable workflow prototype a nurse and manager can walk through | Done (repository README, 15 fake patients) |
| Operations | Real AI voice call demonstrated end to end on a test line | Missing (prototype is a keyword parser; no telephony or LLM dependencies in `package.json`) |
| Data/security | Synthetic-data-only development policy | Done (README: all data fictional) |
| Hiring | Named first US nurse hire or contractor | Missing |
| Insurance | None needed yet | n/a |
| Fundraising | Plan for who attends an in-person batch and on what status | Missing |

### (b) Before the first paying practice

| Area | Item | Status |
|---|---|---|
| Business | Signed service agreement with FMV-supported flat fee and clear billing responsibility | Missing |
| Business | Pricing that handles unbillable months (credits or per-serviced-patient terms) | Missing |
| Customer evidence | Signed LOIs or pilot agreements at $27 PPPM | Missing |
| Customer evidence | Patient-facing materials and coinsurance explanation tested with real patients | Missing |
| Clinical | Medical director (part-time MD) who signs protocols and reviews escalations | Missing |
| Clinical | Written triage and escalation protocol, signed, with warm-transfer path | Missing |
| Clinical | APCM service-element checklist the practice can attest to (24/7 access, care plan, transitions, MVP reporting) | Missing |
| Clinical | Eligibility criteria stricter than "any two codes on a list" (see `shared/codes.ts`) | Missing |
| Legal | BAAs with practice, telephony, speech and LLM vendors | Missing |
| Legal | TCPA consent language for AI/prerecorded calls and texts; state AI-disclosure review for launch states | In progress (consent captures automated-call permission in the roster; no legal sign-off) |
| Legal | Nurse licensure plan (compact states first) | Missing |
| Operations | US nurse hired, credentialed in the practice's EHR, trained | Missing |
| Operations | Real telephony with branded caller ID and 10DLC registration | Missing |
| Operations | Monthly close procedure: roster, QMB and coverage verification, attestation, billing file | In progress (prototype flow exists; no eligibility verification) |
| Data/security | Production environment accessible only from the US; access logging; incident response | Missing |
| Data/security | Vendor security questionnaire answers (practices and channels will ask) | Missing |
| Hiring | Clinical operations lead or co-founder in the US | Missing |
| Insurance | Professional liability, technology E&O covering AI, cyber | Missing |
| Fundraising | Six months of runway for two founders plus one nurse | Not stated |

### (c) Before a seed round

| Area | Item | Status |
|---|---|---|
| Business | Three paying practices, one live 90+ days | Missing |
| Business | Measured CAC, time-to-sign, ramp curve | Missing |
| Customer evidence | Measured enrollment rate and consent cost per enrolled patient | Missing |
| Customer evidence | Measured AI-call answer, completion and opt-out rates on patients 75+ | Missing |
| Clinical | Measured nurse minutes per patient-month and caseload | Missing |
| Clinical | Zero missed urgent escalations, documented; independent chart and billing audit passed | Missing |
| Legal | FMV opinion on the fee; compliance program (policies, training, audit cadence) | Missing |
| Operations | Second EHR supported without new manual work; close process under 2 hours per practice | Missing |
| Data/security | SOC 2 Type I or a credible roadmap with controls in place | Missing |
| Hiring | Director of nursing or clinical ops lead; first account manager | Missing |
| Insurance | All three policies bound, limits sized to contracts | Missing |
| Fundraising | A data room where every number in the model is measured, not assumed | Missing |

## 9. Next 30 days

Ranked by how much each would move my decision. Owner, measurable result, and why it outranks the next one. Items that produce documents rather than customer or operating evidence are last by rule.

1. **Twenty-five completed conversations with practice decision-makers, ending in two signed pilot LOIs.** Owner: CEO. Result: 25 conversations with owners or practice managers of 1–10 physician practices in Nurse Licensure Compact states, logged with the objection each raised; 5 who agree to a pilot call; 2 signed LOIs at $27 PPPM for APCM with a start date. Why first: every other number in the company is downstream of whether anyone will buy; this is also the only item that would change my first line.
2. **A clinical operations co-founder or first hire, in the US, signed.** Owner: CEO (founder-level recruiting), with the technical founder on the interview loop. Result: a signed offer or co-founder agreement with 10–20% equity for someone who has run a CCM, home-health or practice nursing operation, plus a part-time medical director on a signed engagement. Why second: it is the fastest fix to the team flaw and the person brings the warm practices item 1 needs.
3. **A real AI-call acceptance test on people the age of your patients.** Owner: technical founder. Result: 100 completed outbound calls to consenting volunteers aged 70+ (recruited through a senior center, a church or a paid panel; no patient data) using real telephony and a real voice agent; report answer rate, completion rate, requests for a human, and whether the escalation rules fire correctly on scripted chest-pain and self-harm answers. Why third: the APCM margin story collapses if completion is below about 65%, and today the "AI" is a keyword parser with no phone line.
4. **A nurse time study on the APCM month.** Owner: technical founder (builds the measurement), with a contracted US RN. Result: one RN works 60–100 simulated or pilot patients through a full month in the prototype with real pasting into a sandbox EHR, timed by activity; publish minutes per patient-month and the implied caseload. Why fourth: it decides whether the only profitable line exists; it ranks below item 3 because the AI results feed into it.
5. **One founder physically in the US with a legal work path.** Owner: technical founder (UK citizen; the faster path). Result: a US entity and bank account; the technical founder in the US for a 30-day meetings trip under ESTA with immigration counsel's written plan for O-1 or E-2 and dates; the CEO's B1/B2 appointment booked at the consulate with the shortest wait. Why fifth: it unblocks in-person selling and YC attendance, but it does not by itself produce evidence a buyer exists.
6. **Ten operator conversations to test the pivot.** Owner: CEO. Result: 10 calls with ACO enablement companies, MSOs, IPAs, FQHC networks or mid-size CCM vendors; for each, what they pay per patient-month in care-management labor today, whether they bill APCM, and what they would pay for an AI check-in plus nurse workflow layer; 2 willing to run a paid design-partner pilot. Why sixth: it is the fastest route to revenue for this team, but it is a different company, so it ranks below validating the one you say you are building.
7. **Fix the two audit traps in the product before anyone sees it.** Owner: technical founder. Result: eligibility requires conditions that meet the significant-risk standard rather than any two codes from the list; QMB and coverage status come from an eligibility check, not a CSV column; the escalation flow warm-transfers instead of hanging up. Why seventh: these are real liabilities, but fixing them produces no customer evidence.
8. **Rebuild the model and the compliance paperwork.** Owner: CEO (model), technical founder (BAAs, insurance quotes, FMV engagement letter). Result: a model with CAC, sales cycle, ramp, churn, working capital, account management and compliance cost, with CCM and APCM as separate P&Ls; three insurance quotes; a BAA template. Why last: documents, by rule.

## 10. Facts verified or corrected, with sources

Method and limits. The environment's network policy refused every direct page fetch (CMS, Federal Register, OIG, KFF, AMA, BLS, company sites), so "VERIFIED" here means the fact appears in the search engine's extract of the cited page, usually from more than one consistent source. Where only vendor or law-firm summaries were available, the row says so. The search budget ran out before four items could be re-checked; they are flagged.

| Your claim or my input | Status | What I found | Sources |
|---|---|---|---|
| About two-thirds of beneficiaries have 2+ chronic conditions | **VERIFIED (old data)** | 69% of fee-for-service beneficiaries in 2017, per CMS Chronic Conditions Charts; CMS has retired the public-use files, no newer national share found | [CMS MMS Hub](https://mmshub.cms.gov/about-quality/types/multiple-chronic-care-conditions/overview) |
| CCM reached ~4% of eligible beneficiaries in 2019 | **VERIFIED** | Mathematica analysis of 2019 data: 4%, "appears to have held steady through 2023"; peer-reviewed 5% sample: 3.4% in 2019 | [KFF Health News, Apr 2024](https://kffhealthnews.org/news/article/medicare-chronic-care-management-monitoring-business/); [JAGS 2024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10739191/) |
| ~1.3M received CCM in 2023, +23% | **PARTLY VERIFIED, inconsistent** | Attributed to Avalere's analysis of 2019–2023 claims but visible only through secondary sites; PYA puts 2022 at ~970k (which would make 2023 +34%); AAFP/AMGA's April 2026 letter says ~882,000 of a 22.5M pool. Honest range: 0.9–1.3M, 4–6% of eligible | [Avalere](https://advisory.avalerehealth.com/insights/chronic-care-management-in-medicare-optimizing-utilization); [PYA, Mar 2025](https://pyapc.com/wp-content/uploads/2025/03/Providing-and-Billing-Medicare-for-CCM-PYA-020325.pdf); [AAFP/AMGA letter, Apr 2026](https://www.aafp.org/assets/image/upload/v1778217599/LT-Congress-chroniccare-04142026.pdf) |
| APCM adoption since 2025 | **NOT FOUND** | No CMS, MedPAC or analyst counts by practice type. CMS's pre-launch estimate was $100M of allowed charges in 2025. AAFP (Sept 2026) says CMS "is concerned that uptake of these services has remained lower than expected" and asks CMS to waive APCM copays and drop mandatory MVP reporting | [AMA 2025 MPFS summary](https://www.ama-assn.org/system/files/ama-2025-mpfs-summary.pdf); [AAFP letter, Sept 2026](https://www.aafp.org/assets/image/upload/v1789152230/pdf_lt_cms_mpfsfy27_091126.pdf) |
| 2026 rates: 99490 $66.13, G0557 $53.78, G0558 $117.24; +8–11% | **VERIFIED (vendor consensus)** | Multiple 2026 fee guides agree; G0556 $16.37; conversion factor $33.4009 non-APM (+3.26%) and $33.5675 APM, including a one-year 2.5% increase. One calculator shows $62.46 for 99490, but it uses 2025 RVUs (1.87 × $32.3465 = $60.49 in 2025). Care-management codes were exempt from the −2.5% efficiency adjustment | [Prevounce](https://blog.prevounce.com/apcm-billing-codes-and-requirements-hcpcs-g0556-g0557-and-g0558); [ThoroughCare](https://www.thoroughcare.net/blog/2026-advanced-primary-care-management-cpt-codes); [CircleLink](https://circlelinkhealth.com/chronic-condition-care-raise-final-cms-2026-fee-schedule/); [AUA 2026 summary](https://www.auanet.org/advocacy/get-involved/comment-letters-and-resources/physician-payment-and-coverage-issues/final-rule-cy-2026-medicare-physician-fee-schedule-summary) |
| 2027 rates (new) | **VERIFIED proposal / ASSUMPTION on RVUs** | CY2027 proposed non-APM conversion factor $32.8409 (−1.68%), APM $33.1693 (−1.19%), as the 2.5% expires. With RVUs unchanged: 99490 ≈ $65.02, G0557 ≈ $52.88, G0558 ≈ $115.27 | [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2027-medicare-physician-fee-schedule-proposed-rule); [Holland & Knight, Jul 2026](https://www.hklaw.com/en/insights/publications/2026/07/cms-issues-cy-2027-medicare-physician-fee-schedule-proposed-rule); [AMA](https://www.ama-assn.org/practice-management/medicare-medicaid/2027-proposed-medicare-fee-schedule-what-physicians-need-know) |
| 55% in MA in 2026; CBO 63% by 2034 | **VERIFIED** | 35.2M of 64.2M beneficiaries with Parts A and B (55%); CBO 63% by 2034 and flat through 2036; about 29.0M remain in traditional Medicare | [KFF, Jun 2026](https://www.kff.org/medicare/medicare-advantage-in-2026-enrollment-update-and-key-trends/) |
| "Codes apply to traditional Medicare only" | **CORRECTION (ASSUMPTION on payment practice)** | MA plans must cover Part B benefits; whether and how a plan pays CCM/APCM to a given practice depends on contract. Your prototype pauses MA patients as ineligible | 42 CFR 422.101 (not re-checked); [Repo: `server/roster.ts:215`] |
| 47.4% of physicians in practices of ≤10 in 2024, vs 61.4% in 2012 | **VERIFIED** | AMA Policy Research Perspective, May 2025; private (physician-owned) practice 42.2% in 2024, down from 60.1% | [AMA](https://www.ama-assn.org/practice-management/private-practices/smaller-share-doctors-private-practice-ever) |
| HHS-OIG opened a multi-year CCM eligibility audit in March 2026 | **VERIFIED** | Work Plan item OAS-26-09-007, announced 16 March 2026, expected FY2028: payments "at risk of noncompliance with the Medicare requirement for multiple chronic conditions"; CCM payments "increased substantially" 2019–2024. Prior OIG reports: 2019 ($640k overpayments, 2015–16) and 2021 ($1.92M, 2017–18, mostly duplicate billing). No 2024–2025 OIG CCM reports found | [OIG Work Plan](https://oig.hhs.gov/reports/work-plan/browse-work-plan-projects/audit-of-medicare-payments-for-chronic-care-management-services-at-risk-of-noncompliance/); [Goodwin, Mar 2026](https://www.goodwinlaw.com/en/insights/publications/2026/03/alerts-otherindustries-hltc-hhs-oig-announces-an-audit-of-medicare-payments); [OIG 2021](https://oig.hhs.gov/oas/reports/region7/71905122.asp) |
| A bill to waive the 20% coinsurance is pending | **VERIFIED (pending)** | H.R. 8261, Chronic Care Management Improvement Act of 2026, DelBene/Kelly, introduced 14 April 2026, referred to committee, 8–9 cosponsors, no markup; would pay 100% from 1 January 2027; no Senate companion found | [Congress.gov](https://www.congress.gov/bill/119th-congress/house-bill/8261); [bill text](https://www.govinfo.gov/content/pkg/BILLS-119hr8261ih/xhtml/BILLS-119hr8261ih.html) |
| CY2027 proposal restricts outsourced staffing for RPM, not CCM/APCM | **VERIFIED, with a warning** | Proposed 14 July 2026, published 16 July, comments closed 14 September. RPM/RTM paid only when clinical staff are direct employees of the billing practitioner, plus an initiating visit and lower values; CCM/PCM/APCM exempt as proposed. The same rule's care-management RFI asks about fraud, supervision and initiating visits; Nixon Law Group reads it as CY2028 proposals in draft. Final rule expected about 1 November; not out as of 16 October in available coverage | [Federal Register](https://www.federalregister.gov/documents/2026/07/16/2026-14327/medicare-and-medicaid-programs-cy-2027-payment-policies-under-the-physician-fee-schedule-and-other); [Benesch](https://www.beneschlaw.com/insight/cms-proposes-sweeping-restrictions-on-remote-patient-monitoring-the-outsourcing-ban-reimbursement-revaluation-and-potential-code-consolidation-in-the-cy-2027-physician-fee-schedule-proposed-rule/); [Nixon Law Group](https://www.nixonlawgroup.com/resources/the-cy-2027-mpfs-proposed-rule-is-here-whats-at-stake-for-rpm-rtm-and-care-management); [TimeDoc](https://timedochealth.com/cy-2027-proposed-rule-turning-point-for-care-management/); [Prevounce](https://blog.prevounce.com/newsroom/statement-on-2027-physician-fee-schedule-proposed-rpm-changes) |
| APCM requirements | **VERIFIED via secondary** | No time threshold; billed once per calendar month by one practitioner; all elements must be available in any billed month and furnished as reasonable and necessary; 24/7 access; continuity; consent; initiating visit if not seen in 3 years; monthly contact is not an explicit element; delegation to clinical staff under general supervision allowed. MIPS-eligible billers must register for and report the Value in Primary Care MVP (from the 2025 performance year) unless in an MSSP/REACH ACO or PCF/MCP. CY2026 added optional BHI/CoCM add-ons G0568–G0570 | [CMS APCM FAQ](https://www.cms.gov/files/document/advanced-primary-care-management-apcm-services-faq.pdf); [AAFP](https://www.aafp.org/practice-operations/billing-and-coding/advanced-primary-care-management); [AAFP FPM, 2026 QPP](https://www.aafp.org/pubs/fpm/blogs/gettingpaid/entry/medicare-app-2026-updates.html); [CMS FQHC/RHC news](https://www.cms.gov/fqhc-rhc-news-announcements) |
| CCM staffing rules | **VERIFIED via secondary** | General supervision; clinical staff may be contracted ("individuals outside the practice… subject to incident-to rules"); LPNs/MAs qualify within state scope; only clinical-staff time counts | [CMS MLN909188, Jun 2025](https://www.hhs.gov/guidance/sites/default/files/hhs-guidance-documents/CMS/mln909188_chroniccaremanagement_jun2025.pdf) |
| Industry median enrollment ~24% | **NOT FOUND** | Appears only in one unsourced vendor blog. ChartSpan claims 45% (also 35% and 60%+ on other pages) and ~10% for in-house programs; it says early monthly churn can reach 8% | [Mindbowser](https://www.mindbowser.com/ccm-consent-enrollment-management/); [ChartSpan](https://chartspan.com/chronic-care-management/); [ChartSpan churn](https://www.chartspan.com/news/what-is-net-patient-churn) |
| ChartSpan | **VERIFIED as company claims** | Full-service APCM launched 4 June 2025; "largest CCM managed service provider by active monthly enrolled patients"; ">$100K/yr from 300 enrolled"; AI supports rather than replaces coordinators, AI QA screens 100% of calls; Colorado Hospital Association endorsement May 2025; acquired Validic 22 June 2026; $15M Series A 2019 (BIP Capital). No public pricing | [APCM launch](https://www.chartspan.com/blog/chartspan-launches-comprehensive-advanced-primary-care-management-program/); [FAQ](https://chartspan.com/faq/); [AI post](https://www.chartspan.com/blog/the-role-of-artificial-intelligence-ai-in-chronic-disease-management/); [Validic](https://hlth.com/insights/news/chartspan-acquires-validic-to-expand-remote-patient-monitoring-capabilities) |
| Signallamp is a competitor | **CORRECTION** | Merged with Accuhealth; rebranded Tellihealth (May 2025); Signallamp renamed signalCCM; nurses work inside the client EHR; 300+ client organizations pre-merger | [PR Newswire](https://www.prnewswire.com/news-releases/tellihealth-introduces-new-brand-identity-to-lead-the-future-of-connected-care-302446385.html) |
| TimeDoc, CareHarmony | **VERIFIED** | TimeDoc: $48.5M Series B (2022), AI risk-flagging with human calls, APCM services. CareHarmony: $15M Series A (2022), sells mainly to health systems | [MobiHealthNews](https://www.mobihealthnews.com/news/virtual-patient-management-platform-timedoc-health-scores-485m); [BusinessWire](https://www.businesswire.com/news/home/20220815005595/en/) |
| New entrants you did not list | **VERIFIED** | HealthSnap: "AI-augmented APCM" 2026, $25M facility Aug 2026, 80k active programs. CircleLink: "agentic APCM" with AI voice/text agents. Medsien: managed APCM, Jul 2025. Wellbox merged into C3 HealthcareRx, Jan 2026. Cadence: $100M at $1.23B, Jun 2026. Pearl Health: $110M, Jul 2026, building care-orchestration agents for 10,000 providers | [HealthSnap](https://hitconsultant.net/2026/08/10/healthsnap-secures-25m-financing-eastward-capital-ai-virtual-care/); [Medsien](https://hlth.com/insights/news/medsien-launches-managed-apcm-solution-to-power-next-gen-primary-care-2025-07-07); [C3/Wellbox](https://natlawreview.com/press-releases/c3-healthcarerx-and-wellbox-health-merge-form-comprehensive-value-based-care); [Cadence](https://www.statnews.com/2026/06/23/cadence-100-million-raise-automate-chronic-care-ai/); [Pearl](https://www.cooley.com/news/coverage/2026/2026-07-08-pearl-health-raises-$110-million) |
| EHR vendors | **VERIFIED** | eClinicalWorks: native APCM module (eligibility, consent, QMB flagging, batch claims) and AI contact center. athenahealth: agentic patient-engagement voice agents announced for H2 2026. Elation: APCM through partners (CareTrack, ChronicCareIQ) | [eCW APCM](https://www.eclinicalworks.com/products-services/population-health/apcm/); [athenahealth](https://hlth.com/insights/news/athenahealth-introduces-agentic-ai-tools-to-modernize-patient-communication-across-its-network-2026-02-20); [Elation partners](https://partners.elationhealth.com/partners/caretrack-health) |
| CCM software vendors | **VERIFIED** | ThoroughCare ~700 organizations, $5M Series A (Nov 2024), CareCo AI partnership; Prevounce $7M Series A total; HealthArc $5M (2024); ChronicCareIQ APCM module, "from $5/month". Software PPPM ranges $2–25 | [ThoroughCare](https://www.businesswire.com/news/home/20241119563128/en/); [Prevounce](https://blog.prevounce.com/prevounce-health-extends-series-a); [HealthArc](https://www.healtharc.io/press-release/healtharc-secures-5-million-in-growth-funding-to-revolutionize-healthcare/); [ChronicCareIQ](https://www.chroniccareiq.com/programs/apcm/) |
| Hippocratic AI ~$9 per agent-hour | **VERIFIED as a 2024 claim** | Widely reported from Nvidia GTC 2024; no current rate card. $126M Series C at $3.5B (Nov 2025), $404M total; sells to health systems and payers; WellSpan platform-wide voice agent (Jul 2026); claims 8M+ calls a month | [Hippocratic AI](https://hippocraticai.com/hippocratic-ai-announces-series-c-funding-126-million/); [Sacra](https://sacra.com/c/hippocratic-ai/); [WellSpan](https://hitconsultant.net/2026/07/30/wellspan-health-expands-hippocratic-ai-partnership-platform-wide-voice-agent/) |
| Kaigo Health (YC F25) | **VERIFIED, with a caveat** | YC profile matches: phone-based AI voice agent for older adults, check-ins and post-discharge follow-up, team of three. One directory describes it as skilled-nursing revenue-recovery software, suggesting a pivot; unresolved | [YC](https://www.ycombinator.com/companies/kaigo-health); [directory](https://www.voiceaispace.com/tool/kaigo-health) |
| Beacon Health (YC W26) | **VERIFIED** | "AI employees" working inside Epic, athena and eCW for screenings, prior auth, referrals and risk adjustment; not a calling product | [YC](https://www.ycombinator.com/companies/beacon-health) |
| Nurse cost | **CORRECTION** | BLS OEWS May 2025: RN median $97,550, 75th percentile $112,350 (via secondary citation; bls.gov blocked). BLS ECEC Dec 2025: benefits 29.9% of compensation, so loaded cost ≈ 1.43× wages. Your implied $86k all-in is below the median wage | [ECEC](https://www.bls.gov/news.release/archives/ecec_03202026.htm); [OEWS citation](https://wagedex.com/jobs/registered-nurses) |
| Nurse Licensure Compact | **VERIFIED via secondary** | About 40 states implemented (Pennsylvania Jul 2025, Connecticut Oct 2025); not members: California, Nevada, Illinois, New York, Michigan, Minnesota, Oregon, Alaska, Hawaii, DC | [RegisteredNursing.org](https://www.registerednursing.org/articles/nursing-license-compact/) |
| CCM operating benchmarks | **VERIFIED via secondary** | Mathematica 2017: 684k beneficiaries in two years, average 47 CCM patients per biller per month, median 10, 42% of billers solo, −$74 PBPM at 18 months. Basu 2015: ≥131 enrolled to break even on one RN; higher net with LPN/MA. Surveys: 47% cite insufficient reimbursement, 60% fear new hires | [Mathematica](https://mathematica.org/publications/evaluation-of-the-diffusion-and-impact-of-the-chronic-care-management-ccm-services-final-report); [Basu, Ann Intern Med 2015](https://www.pubmed.ncbi.nlm.nih.gov/26389533/); [Fierce](https://www.fiercehealthcare.com/practices/physician-practices-struggle-to-find-profit-chronic-care-management-survey-finds) |
| Seniors and automated calls | **VERIFIED (preliminary)** | Emory/Guidehealth (AHA 2025, ~2,000 mostly 65+): 85% reached over 10 weeks, 67% of reached completed, cost per reading 88.7% below nurse calls. Emmi: 72% reached, 82% of reached engaged. Pew 2020: 19% usually answer unknown numbers. Hiya: 80–86% of unidentified calls unanswered | [UPI](https://www.upi.com/Health_News/2025/09/08/AI-voice-agent-seniors-high-blood-pressure/4551757339502/); [Pew](https://www.pewresearch.org/short-reads/2020/12/14/most-americans-dont-answer-cellphone-calls-from-unknown-numbers/) |
| TCPA and AI voice | **VERIFIED** | FCC 24-17 (Feb 2024): AI voices are "artificial"; prior express consent for informational calls to cell phones; 2015 healthcare exemption limits (≤1/day, ≤3/week, no billing content, opt-out); revocation by any reasonable means since Apr 2025, "revoke-all" delayed to 31 Jan 2027; McLaughlin v. McKesson (Jun 2025): courts not bound by FCC interpretations; Eleventh Circuit vacated one-to-one consent (Jan 2025) | [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2024/02/fcc-declares-authority-and-intent-to-regulate-ai-generated-calls-under-the-tcpa); [Burr](https://www.burr.com/telephone-consumer-protection-act/the-fcc-delays-effective-date-of-tcpa-revoke-all-rule-until-january-31-2027); [Husch Blackwell](https://www.huschblackwell.com/newsandinsights/supreme-court-clarifies-district-courts-independence-from-fccs-tcpa-interpretations) |
| State AI laws | **VERIFIED** | CA AB 3030 (disclaimers, start and end of audio, path to a human); CA AB 489 (no AI use of "nurse" and similar titles, operative 1 Jan 2026); Oregon HB 2748 (nurse titles); Utah SB 226 (disclose at start of verbal interaction, sunset Jul 2027); Texas TRAIGA (disclosure by first date of service, AG penalties $10k–$200k); Colorado SB 26-189 (effective 1 Jan 2027); Illinois WOPR (no AI therapeutic communication). No state bans automated clinical calls | [Morgan Lewis](https://morganlewis.com/pubs/2024/12/california-law-requiring-disclaimers-by-healthcare-providers-using-genai-will-affect-providers-and-genai-developers); [Hooper Lundy](https://hooperlundy.com/californias-ab-489-signed-into-law-targeting-ai-misrepresentation-in-health-care-communications/); [Norton Rose Fulbright](https://www.nortonrosefulbright.com/en-us/knowledge/publications/c6c60e0c/the-texas-responsible-ai-governance-act); [Holland & Knight on Colorado](https://www.hklaw.com/en/insights/publications/2026/05/colorado-governor-signs-sb-189); [IDFPR](https://idfpr.illinois.gov/content/dam/soi/en/web/idfpr/news/2025/2025-08-04-idfpr-press-release-hb1806.pdf) |
| Enforcement | **VERIFIED** | Bluestone Physician Services: $14.9M FCA settlement, Jun 2024, five-year CIA, among the first CCM FCA settlements; OIG 2021: $1.4M of $1.9M overpayments were duplicate same-month billing | [Sidley](https://fcablog.sidley.com/2024/06/27/doj-reaches-settlement-with-provider-based-on-chronic-care-management-coding/); [OIG](https://oig.hhs.gov/oas/reports/region7/71905122.asp) |
| Collections | **VERIFIED via secondary** | ~5% of CCM claims denied (Annals of Family Medicine 2020); CERT Part B improper rate 10.35%; Medicare pays clean electronic claims from day 14; denials for overlap with TCM, home health, hospice, ESRD and second-practitioner billing | [Annals FM](https://www.annfammed.org/content/18/5/455.full.pdf); [First Coast CERT](https://medicare.fcso.com/claims-review-programs/cert-insiders-guide-part-b-first-quarter-2025); [Noridian](https://med.noridianmedicare.com/web/jddme/claims-appeals/claim-submission/clean) |
| Small-practice sales | **VERIFIED** | Phreesia: sales cycles of three to six months; Weave: 89% gross revenue retention on SMB practices | [Phreesia 10-K](https://www.sec.gov/Archives/edgar/data/1412408/000141240825000010/phr-20250131.htm); [Weave 10-K](https://www.sec.gov/Archives/edgar/data/1609151/000160915126000016/weav-20251231.htm) |
| Supplemental coverage and coinsurance | **VERIFIED** | 87% of traditional-Medicare beneficiaries have supplemental coverage (43% Medigap, 29% employer, 14% Medicaid); 13% none. CCM coinsurance ≈ $13 a month in 2026; Medigap K/L cover only 50–75% of Part B coinsurance | [KFF snapshot](https://www.kff.org/medicare/a-snapshot-of-sources-of-coverage-among-medicare-beneficiaries/) |
| B1/B2 waits in India | **VERIFIED via aggregators** | 10–12 months estimated in September 2026 (Hyderabad 12, Mumbai 11.5, Delhi 10); other trackers 6–12 months by post | [VisaVerge, Sept 2026](https://www.visaverge.com/visa/201-days-32-staff-loss-global-repositioning-exercise-slows-us-visa-waits/) |
| H-1B $100k fee | **VERIFIED (contested)** | Proclamation of 18 September 2026 extends the fee on consular H-1B petitions through 21 September 2027; a First Circuit order barring collection is under appeal | [Mintz, Sept 2026](https://www.mintz.com/insights-center/viewpoints/2806/2026-09-23-presidential-proclamation-extends-100k-h-1b-fee) |
| YC batch format | **VERIFIED via aggregators** | Fall 2026 batch October–December, "mainly in person in San Francisco", Demo Day 2 December 2026; YC has publicly said visa problems stop founders attending | [TechCrunch 2023](https://techcrunch.com/2023/09/19/yc-says-visa-challenges-hampering-participation-of-international-founders) |

**Not re-checked before the search budget ran out:** Avalere's year-by-year CCM table; whether APCM codes were formally on CMS's efficiency-adjustment exclusion list (vendor rate tables imply yes); Congress.gov actions on H.R. 8261 after May 2026; whether Kaigo Health has pivoted; current OMB review status of the CY2027 final rule; Privia and agilon APCM programs; CCM percentage-fee market rates; a telephonic-RN caseload survey.
