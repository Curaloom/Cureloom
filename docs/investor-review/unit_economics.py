"""Independent rebuild of Cureloom unit economics (seed-investor view, 16 Oct 2026).

Everything is an assumption unless marked FOUNDERS. Run from the repo root: python3 -I docs/investor-review/unit_economics.py
Prints markdown tables used in the memo.
"""
from dataclasses import dataclass, replace

# ----------------------------------------------------------------- 2026 fees (national, non-facility)
FEE_99490 = 66.13   # CCM first 20 min clinical staff
FEE_G0557 = 53.78   # APCM, 2+ chronic
FEE_G0558 = 117.24  # APCM, QMB + 2+ chronic
QMB_SHARE = 0.15    # FOUNDERS
CF_2027_CHANGE = -0.0168  # proposed CY2027 non-QP conversion factor change

# ----------------------------------------------------------------- labour
LOAD = 1.40  # BLS ECEC Dec 2025: benefits = 29.9% of compensation (1.43x wages); 1.40 used for lower-paid remote roles
PAID_HOURS = 2080 / 12  # 173.3


def productive_minutes(pto=0.10, admin=0.10, util=0.85):
    """Minutes/month a nurse can spend on patient work."""
    return PAID_HOURS * 60 * (1 - pto) * (1 - admin) * util


PROD_MIN = productive_minutes()  # ~7,160


@dataclass(frozen=True)
class Staff:
    name: str
    base: float

    @property
    def monthly(self):
        return self.base * LOAD / 12

    @property
    def per_min(self):
        return self.monthly / PROD_MIN


RN = Staff("RN", 88_000)   # remote care-management RN; BLS May 2025 RN median wage is $97,550, so this is generous to the founders
LPN = Staff("LPN", 62_000)
MA = Staff("MA", 45_000)
MGR = Staff("Nurse manager", 120_000)   # 1 per 8 nurses
CSM = Staff("CSM/ops", 80_000)          # 1 per 35 practices

# ----------------------------------------------------------------- nurse minutes per ENROLLED patient-month


def ccm_minutes(billable=0.80, counted=22, uncounted=4, unbilled_attempts=8):
    """Billed patients: 20+ counted minutes (you overshoot), plus uncounted dialling,
    EHR login, pasting. Unbilled patients still cost attempts."""
    return billable * (counted + uncounted) + (1 - billable) * unbilled_attempts


def apcm_minutes(review=0.75, concern=0.15 * 12, urgent=0.01 * 30, unreached=0.20 * 8,
                 decliners=0.12 * 12, careplan=1.5, transitions=0.02 * 30, note_paste=1.5,
                 coordination=0.20 * 6):
    return review + concern + urgent + unreached + decliners + careplan + transitions + note_paste + coordination


CCM_MIN = ccm_minutes()
APCM_MIN = apcm_minutes()
CCM_CAP = PROD_MIN / CCM_MIN
APCM_CAP = PROD_MIN / APCM_MIN

# ----------------------------------------------------------------- cost per enrolled patient-month


def cost_pp(program, staff, cap, patient_churn=0.02, consent_min=30, assistant=0.0):
    nurse = staff.monthly / cap
    supervision = MGR.monthly / 8 / cap
    ai = 1.00 if program == "apcm" else 0.75
    infra = 0.50
    after_hours = 0.75 if program == "apcm" else 0.25
    insurance = 0.40
    re_enrol = patient_churn * consent_min * RN.per_min
    total = nurse + supervision + ai + infra + after_hours + insurance + re_enrol + assistant
    return dict(nurse=nurse, supervision=supervision, ai=ai, infra=infra, after_hours=after_hours,
                insurance=insurance, re_enrol=re_enrol, assistant=assistant, total=total)

# ----------------------------------------------------------------- practice-side economics


def practice_net(program, fee=27.0, biller=0.06, coins_uncollected=0.15):
    if program == "apcm":
        gross = (1 - QMB_SHARE) * FEE_G0557 + QMB_SHARE * FEE_G0558
        billable = 0.93
        coins_loss = (1 - QMB_SHARE) * billable * 0.20 * FEE_G0557 * coins_uncollected
    else:
        gross = FEE_99490
        billable = 0.80
        coins_loss = billable * 0.20 * FEE_99490 * coins_uncollected
    collected = (gross * billable - coins_loss) * (1 - biller)
    return dict(gross=gross, billable=billable, collected=collected, net=collected - fee)

# ----------------------------------------------------------------- per-practice model


@dataclass(frozen=True)
class Scenario:
    name: str
    eligible: float = 470          # FOUNDERS (3 physicians)
    enrol: float = 0.25
    fee: float = 27.0              # FOUNDERS
    collect: float = 0.95          # credits for unbillable months + bad debt
    cogs: float = 20.0             # blended cost per enrolled patient-month
    am_pm: float = CSM.monthly / 35 + 100  # account mgmt + monthly CSV/attestation/billing ops
    cac: float = 12_000
    onboard_fixed: float = 2_500
    phone_consent_share: float = 0.5
    consent_min: float = 35
    ramp_start: int = 3
    ramp_full: int = 12
    churn: float = 0.015           # monthly practice churn
    fixed_opex: float = 2_000_000  # annual, excluding sales (CAC) and CS (am_pm)
    new_per_month: float = 4       # growth rate used for "growth break-even"

    @property
    def enrolled(self):
        return self.eligible * self.enrol

    @property
    def onboarding(self):
        return self.onboard_fixed + self.phone_consent_share * self.enrolled * self.consent_min * RN.per_min

    @property
    def acquisition(self):
        return self.cac + self.onboarding

    def enrolled_in(self, m):
        if m < self.ramp_start:
            return 0.0
        frac = min(1.0, (m - self.ramp_start + 1) / (self.ramp_full - self.ramp_start + 1))
        return self.enrolled * frac

    def contrib_in(self, m):
        return self.enrolled_in(m) * (self.fee * self.collect - self.cogs) - self.am_pm

    @property
    def revenue_ss(self):
        return self.enrolled * self.fee * self.collect

    @property
    def gm_ss(self):
        return (self.revenue_ss - self.enrolled * self.cogs) / self.revenue_ss

    @property
    def contrib_ss(self):
        return self.contrib_in(10_000)

    def payback(self, horizon=240):
        cum = -self.acquisition
        for m in range(1, horizon + 1):
            cum += self.contrib_in(m)
            if cum >= 0:
                return m
        return None

    def ltv(self, horizon=240):
        s, tot = 1.0, 0.0
        for m in range(1, horizon + 1):
            tot += s * self.contrib_in(m)
            s *= 1 - self.churn
        return tot

    @property
    def breakeven_practices(self):
        c = self.contrib_ss
        return None if c <= 0 else self.fixed_opex / (12 * c)

    @property
    def growth_breakeven(self):
        c = self.contrib_ss
        if c <= 0:
            return None
        return (self.fixed_opex + 12 * self.new_per_month * self.acquisition) / (12 * c)


def fmt_m(x):
    return "never" if x is None else f"{x}"


def fmt_n(x):
    return "never" if x is None else f"{x:,.0f}"


def main():
    print("# Cureloom unit economics rebuild\n")
    print(f"Productive minutes per nurse-month: {PROD_MIN:,.0f} (of {PAID_HOURS*60:,.0f} paid)")
    print(f"RN loaded ${RN.monthly:,.0f}/mo (${RN.per_min:.2f}/productive min); LPN ${LPN.monthly:,.0f}; MA ${MA.monthly:,.0f}")
    print(f"CCM nurse minutes per enrolled patient-month: {CCM_MIN:.1f} -> capacity {CCM_CAP:.0f}/RN (founders: 380)")
    print(f"APCM nurse minutes per enrolled patient-month: {APCM_MIN:.1f} -> capacity {APCM_CAP:.0f}/RN (founders: 1,400)")
    print(f"Founders' 380 CCM: counted minutes alone = {380*0.8*20:,.0f} = {380*0.8*20/PROD_MIN:.0%} of productive minutes, "
          f"{380*0.8*20/(PAID_HOURS*60):.0%} of paid minutes, before any uncounted work")
    print(f"Founders' 1,400 APCM: {PROD_MIN/1400:.1f} productive min per patient-month ({PAID_HOURS*60/1400:.1f} paid)\n")

    # founders' model reproduced
    print("## Founders' model reproduced (FOUNDERS numbers)")
    enrolled = 470 * 0.45
    print(f"- Enrolled: 470 x 45% = {enrolled:.0f}")
    print(f"- Practice collects CCM: {enrolled:.0f} x $66.13 = ${enrolled*66.13:,.0f}/mo ; APCM: {enrolled:.0f} x (0.85x53.78+0.15x117.24=${0.85*53.78+0.15*117.24:.2f}) = ${enrolled*(0.85*53.78+0.15*117.24):,.0f}/mo")
    print(f"- Cureloom revenue per practice: {enrolled:.0f} x $27 = ${enrolled*27:,.0f}/mo = ${enrolled*27*12:,.0f}/yr")
    print(f"- Implied nurse cost CCM: $18.91 x 380 = ${18.91*380:,.0f}/mo = ${18.91*380*12:,.0f}/yr all-in (nurse dominates)")
    print(f"- Implied non-nurse APCM cost: $7.84 - (nurse ${18.91*380/1400:.2f} at 1,400) = ${7.84-18.91*380/1400:.2f}")
    print(f"- 50 practices x {enrolled:.0f} x $27 x 12 = ${50*enrolled*27*12/1e6:.2f}M run-rate (founders: $3.3M)")
    print(f"- 200 practices = ${200*enrolled*27*12/1e6:.1f}M (founders: $13M); $100M needs {100e6/(enrolled*27*12):,.0f} practices\n")

    # cost table
    print("## Cost per enrolled patient-month (mine)")
    rows = [
        ("CCM, RN, 320/nurse", cost_pp("ccm", RN, 320)),
        ("CCM, RN, 380 (founders' caseload)", cost_pp("ccm", RN, 380)),
        ("CCM, LPN, 320", cost_pp("ccm", LPN, 320)),
        ("CCM, MA, 380", cost_pp("ccm", MA, 380)),
        ("APCM, RN, 500", cost_pp("apcm", RN, 500)),
        ("APCM, RN, 650 (my base)", cost_pp("apcm", RN, 650)),
        ("APCM, RN, 900 + ops assistant", cost_pp("apcm", RN, 900, assistant=0.90)),
        ("APCM, RN, 1,400 (founders' caseload)", cost_pp("apcm", RN, 1400)),
        ("APCM, LPN, 650", cost_pp("apcm", LPN, 650)),
    ]
    net_fee = 27 * 0.95
    print(f"Net fee after 5% credits/bad debt: ${net_fee:.2f}\n")
    print("| Configuration | Nurse | Supervision | AI/telephony | Other | Total | Gross margin |")
    print("|---|---|---|---|---|---|---|")
    for name, c in rows:
        other = c["infra"] + c["after_hours"] + c["insurance"] + c["re_enrol"] + c["assistant"]
        gm = (net_fee - c["total"]) / net_fee
        print(f"| {name} | {c['nurse']:.2f} | {c['supervision']:.2f} | {c['ai']:.2f} | {other:.2f} | **{c['total']:.2f}** | {gm:+.0%} |")
    print()

    # price needed for 40% GM
    for name, c in rows:
        need = c["total"] / 0.60 / 0.95
        print(f"- {name}: fee for 40% gross margin = ${need:.2f}")
    print()

    # practice side
    print("## Practice-side economics per enrolled patient-month")
    for prog in ("ccm", "apcm"):
        p = practice_net(prog)
        print(f"- {prog.upper()}: gross ${p['gross']:.2f}, billable {p['billable']:.0%}, collected after coinsurance loss and 6% biller ${p['collected']:.2f}, "
              f"minus $27 fee = **${p['net']:.2f}** net to practice")
    pa = practice_net("apcm")
    print(f"- APCM, 3-physician practice, 25% enrolment ({470*0.25:.0f} patients): ${pa['net']*470*0.25*12:,.0f}/yr net, "
          f"${pa['net']*470*0.25*12/3:,.0f}/physician/yr, before ~2 h/month of physician attestation time")
    print(f"- Same at founders' 45%: ${pa['net']*470*0.45*12:,.0f}/yr")
    print(f"- Cureloom's take of practice collections: CCM {27/practice_net('ccm')['collected']:.0%}, APCM {27/pa['collected']:.0%}")
    print(f"- 2027 proposed CF change {CF_2027_CHANGE:+.2%}: practice APCM net falls to ${(pa['collected']*(1+CF_2027_CHANGE))-27:.2f}\n")

    # scenarios
    cogs = {k: cost_pp(*v)["total"] for k, v in {
        "ccm_rn_320": ("ccm", RN, 320), "ccm_lpn_320": ("ccm", LPN, 320),
        "apcm_500": ("apcm", RN, 500), "apcm_650": ("apcm", RN, 650), "apcm_1400": ("apcm", RN, 1400),
    }.items()}
    cogs["apcm_900"] = cost_pp("apcm", RN, 900, assistant=0.90)["total"]
    founders_cogs = 0.5 * 18.91 + 0.5 * 7.84

    scenarios = [
        Scenario("Founders: 45%, their costs, no CAC/ramp/churn (their claim)", enrol=0.45, cogs=founders_cogs, am_pm=0, cac=0, onboard_fixed=0, phone_consent_share=0, ramp_start=1, ramp_full=1, fixed_opex=1_660_000),
        Scenario("Founders' costs + my CAC, ramp, churn, AM, opex, 45%", enrol=0.45, cogs=founders_cogs),
        Scenario("Founders' costs, my everything else, 25%", enrol=0.25, cogs=founders_cogs),
        Scenario("My base: 25%, 50/50 CCM(RN 320)/APCM(650)", enrol=0.25, cogs=0.5 * cogs["ccm_rn_320"] + 0.5 * cogs["apcm_650"]),
        Scenario("CCM only, RN 320, 25%", enrol=0.25, cogs=cogs["ccm_rn_320"]),
        Scenario("CCM only, LPN 320, 25%", enrol=0.25, cogs=cogs["ccm_lpn_320"]),
        Scenario("APCM only, 500/RN, 25%", enrol=0.25, cogs=cogs["apcm_500"]),
        Scenario("APCM only, 650/RN, 25%", enrol=0.25, cogs=cogs["apcm_650"]),
        Scenario("APCM only, 900/RN, 25%", enrol=0.25, cogs=cogs["apcm_900"]),
        Scenario("APCM only, 1,400/RN (founders), 25%", enrol=0.25, cogs=cogs["apcm_1400"]),
        Scenario("APCM only, 650/RN, 45%", enrol=0.45, cogs=cogs["apcm_650"]),
        Scenario("APCM only, 900/RN, 35%", enrol=0.35, cogs=cogs["apcm_900"]),
        Scenario("APCM only, 900/RN, 25%, 2-physician practice", eligible=313, enrol=0.25, cogs=cogs["apcm_900"]),
        Scenario("APCM only, 900/RN, 25%, channel: $6k CAC, 15% to channel", enrol=0.25, cogs=cogs["apcm_900"], cac=6_000, fee=27 * 0.85),
        Scenario("APCM only, 900/RN, 25%, fee $22 (price pressure)", enrol=0.25, cogs=cogs["apcm_900"], fee=22),
    ]
    print("## Per-practice and company results")
    print("| Scenario | Enrolled | Rev/practice/yr | GM | Contribution/mo | Payback (months from signing) | LTV/CAC | Break-even practices (steady) | Break-even while adding 4/mo |")
    print("|---|---|---|---|---|---|---|---|---|")
    for s in scenarios:
        ltvcac = s.ltv() / s.acquisition if s.acquisition else float("inf")
        print(f"| {s.name} | {s.enrolled:.0f} | ${s.revenue_ss*12:,.0f} | {s.gm_ss:.0%} | ${s.contrib_ss:,.0f} | {fmt_m(s.payback())} | {ltvcac:.1f} | {fmt_n(s.breakeven_practices)} | {fmt_n(s.growth_breakeven)} |")
    print()

    # grid
    print("## APCM only: payback months / steady-state break-even practices, by caseload and enrolment")
    caps = [500, 650, 800, 900, 1100, 1400]
    enrols = [0.15, 0.20, 0.25, 0.30, 0.35, 0.45]
    print("| Patients per RN | " + " | ".join(f"{e:.0%}" for e in enrols) + " |")
    print("|---|" + "---|" * len(enrols))
    for cap in caps:
        c = cost_pp("apcm", RN, cap, assistant=0.90 if cap >= 800 else 0.0)["total"]
        cells = []
        for e in enrols:
            s = Scenario("g", enrol=e, cogs=c)
            cells.append(f"{fmt_m(s.payback())} / {fmt_n(s.breakeven_practices)}")
        print(f"| {cap:,} (cost ${c:.2f}) | " + " | ".join(cells) + " |")
    print()

    # enrolment floor
    print("## Enrolment floor (APCM only): lowest enrolment with payback <= 24 months, and with positive contribution")
    for cap in (650, 900, 1400):
        c = cost_pp("apcm", RN, cap, assistant=0.90 if cap >= 800 else 0.0)["total"]
        floor24 = floor_pos = None
        for e100 in range(5, 101):
            e = e100 / 100
            s = Scenario("f", enrol=e, cogs=c)
            if floor_pos is None and s.contrib_ss > 0:
                floor_pos = e
            pb = s.payback()
            if floor24 is None and pb is not None and pb <= 24:
                floor24 = e
        print(f"- {cap:,}/RN: contribution turns positive at {floor_pos:.0%} enrolment; payback <= 24 months needs {floor24 if floor24 is None else f'{floor24:.0%}'}")
    print()

    # working capital
    print("## Working capital at 50 practices (APCM 650, 25%)")
    n = 50
    enrolled = 470 * 0.25 * n
    cogs_m = enrolled * cogs["apcm_650"] + n * Scenario("w").am_pm
    rev_m = enrolled * 27
    print(f"- Monthly cost of service + AM: ${cogs_m:,.0f}; monthly billings: ${rev_m:,.0f}")
    print(f"- Cash lag ~2.5 months (service -> practice claims -> Medicare pays -> practice pays net-30): financed cost ${cogs_m*2.5:,.0f}; receivables ${rev_m*1.5:,.0f}")
    print(f"- Nurses needed: {enrolled/650:.0f} RNs + {enrolled/650/8:.1f} managers\n")

    # market pool
    print("## Revenue pool for this exact wedge")
    benef = 64.2e6; trad = 0.45; multi = 0.667; small_indep_share = 0.30
    eligible = benef * trad * multi * small_indep_share
    for e in (0.25, 0.45):
        print(f"- {benef/1e6:.1f}M beneficiaries x {trad:.0%} traditional x {multi:.1%} with 2+ conditions x {small_indep_share:.0%} in small independent primary care = {eligible/1e6:.1f}M eligible; "
              f"x {e:.0%} enrolment x $27 x 12 = ${eligible*e*27*12/1e9:.2f}B/yr at 100% share; 5% share = ${eligible*e*27*12*0.05/1e6:.0f}M")
    print(f"- Practices needed for $100M at 25% enrolment: {100e6/(470*0.25*27*12):,.0f}; at 45%: {100e6/(470*0.45*27*12):,.0f}")


if __name__ == "__main__":
    main()
