"""Investor rebuild of Cureloom unit economics.

Everything here is an assumption unless labelled as the founders' number.
Run from the repo root: python3 docs/teardown/ue_model.py  (sensitivity tables: python3 docs/teardown/sens.py)
"""
from dataclasses import dataclass, replace

HOURS_PER_MONTH = 2080 / 12  # 173.3 paid hours


# ---------------------------------------------------------------- staffing
@dataclass(frozen=True)
class Staff:
    base: float
    load: float = 1.27  # payroll tax, benefits, PTO cover, licences, equipment

    @property
    def monthly(self) -> float:
        return self.base * self.load / 12


RN = Staff(90_000)
LPN = Staff(62_000)
NURSE_MGR = Staff(115_000)  # 1 per 10 nurses
CSM = Staff(80_000)  # 1 per 40 practices


def productive_hours(occupancy=0.80, pto=0.08, admin=0.10) -> float:
    return HOURS_PER_MONTH * (1 - pto) * (1 - admin) * occupancy


def ccm_minutes_per_enrolled(billable=0.80, counted=24, uncounted=3, unbilled=10) -> float:
    """Nurse minutes per ENROLLED CCM patient-month.
    Billed patients: ~24 counted minutes (you cannot stop at exactly 20) + 3
    uncounted (failed dials, EHR login, paste). Unbilled patients still eat
    ~10 minutes of attempts and partial work."""
    return billable * (counted + uncounted) + (1 - billable) * unbilled


def apcm_minutes_per_enrolled(review=1.0, concern_rate=0.15, concern_min=15, urgent_rate=0.01,
                              urgent_min=30, unreached=0.25, unreached_min=6, human_pref=0.15,
                              human_min=10, transitions=0.67, careplan=2.0, note=1.5,
                              ehr_admin=1.0) -> float:
    return (review + concern_rate * concern_min + urgent_rate * urgent_min
            + unreached * unreached_min + human_pref * human_min + transitions
            + careplan + note + ehr_admin)


PROD_H = productive_hours()
CCM_CAP_COMPUTED = PROD_H * 60 / ccm_minutes_per_enrolled()
APCM_CAP_COMPUTED = PROD_H * 60 / apcm_minutes_per_enrolled()


def cost_per_patient(program: str, staff: Staff, capacity: float, patient_churn=0.02,
                     consent_min=35) -> dict:
    nurse = staff.monthly / capacity
    supervision = NURSE_MGR.monthly / 10 / capacity
    ai = 0.75 if program == "ccm" else 1.00
    infra = 0.40
    after_hours = 0.50
    per_min = staff.monthly / (PROD_H * 60)
    re_enrol = patient_churn * consent_min * per_min
    total = nurse + supervision + ai + infra + after_hours + re_enrol
    return dict(nurse=nurse, supervision=supervision, ai=ai, infra=infra,
                after_hours=after_hours, re_enrol=re_enrol, total=total)


# ---------------------------------------------------------------- scenario
@dataclass(frozen=True)
class Scenario:
    name: str
    eligible: float = 470
    enrol: float = 0.25
    fee: float = 27.0
    collect: float = 0.96  # bad debt, credits for unbillable months
    cogs_pp: float = 20.0  # blended cost per enrolled patient-month
    am_pm: float = CSM.monthly / 40  # account management per practice-month
    cac: float = 12_000
    onboard_fixed: float = 3_000
    phone_consent_share: float = 0.5
    consent_min: float = 35
    consent_cost_per_min: float = RN.monthly / (PROD_H * 60)
    ramp_start: int = 3  # first month with enrolled patients
    ramp_full: int = 12  # month steady state is reached
    practice_churn: float = 0.015  # monthly logo churn
    fixed_opex: float = 2_000_000  # annual, excl. sales (CAC) and CS (AM)

    @property
    def enrolled(self) -> float:
        return self.eligible * self.enrol

    @property
    def onboarding(self) -> float:
        return self.onboard_fixed + self.phone_consent_share * self.enrolled * self.consent_min * self.consent_cost_per_min

    @property
    def acquisition(self) -> float:
        return self.cac + self.onboarding

    def enrolled_in(self, m: int) -> float:
        if m < self.ramp_start:
            return 0.0
        frac = min(1.0, (m - self.ramp_start + 1) / (self.ramp_full - self.ramp_start + 1))
        return self.enrolled * frac

    def contrib_in(self, m: int) -> float:
        n = self.enrolled_in(m)
        return n * (self.fee * self.collect - self.cogs_pp) - self.am_pm

    @property
    def revenue_pm_ss(self) -> float:
        return self.enrolled * self.fee * self.collect

    @property
    def gm_ss(self) -> float:
        rev = self.revenue_pm_ss
        return (rev - self.enrolled * self.cogs_pp) / rev

    @property
    def contrib_ss(self) -> float:
        return self.contrib_in(10_000)

    def payback_month(self, horizon=240):
        cum = -self.acquisition
        for m in range(1, horizon + 1):
            cum += self.contrib_in(m)
            if cum >= 0:
                return m
        return None

    def ltv(self, horizon=240) -> float:
        """Survival-weighted lifetime contribution (no discounting)."""
        s, total = 1.0, 0.0
        for m in range(1, horizon + 1):
            total += s * self.contrib_in(m)
            s *= 1 - self.practice_churn
        return total

    @property
    def annual_churn(self) -> float:
        return 1 - (1 - self.practice_churn) ** 12

    def breakeven_practices(self):
        """Steady-state practices needed to cover fixed opex plus the CAC
        needed just to replace churned practices (no growth spend)."""
        per_practice = 12 * self.contrib_ss - self.annual_churn * self.acquisition
        if per_practice <= 0:
            return None
        return self.fixed_opex / per_practice


def fmt_money(x):
    return f"${x:,.0f}"


def describe(s: Scenario) -> str:
    pb = s.payback_month()
    be = s.breakeven_practices()
    return (f"{s.name:<44} enrolled {s.enrolled:6.1f} | rev/pr-mo {fmt_money(s.revenue_pm_ss):>7} | "
            f"GM {s.gm_ss*100:6.1f}% | contrib/pr-mo {fmt_money(s.contrib_ss):>7} | "
            f"acq {fmt_money(s.acquisition):>7} | payback {('never' if pb is None else str(pb)+' mo'):>8} | "
            f"LTV/acq {('n/a' if s.acquisition==0 else f'{s.ltv()/s.acquisition:5.2f}'):>5} | break-even practices {('never' if be is None else f'{be:,.0f}'):>7}")


def solve_enrol(s: Scenario, test, lo=0.01, hi=1.0):
    """Smallest enrolment rate in [lo, hi] for which test(scenario) is true (scan)."""
    r = lo
    while r <= hi + 1e-9:
        if test(replace(s, enrol=r)):
            return r
        r += 0.005
    return None


if __name__ == "__main__":
    print("== Staffing assumptions ==")
    print(f"RN loaded monthly {fmt_money(RN.monthly)} | LPN {fmt_money(LPN.monthly)} | nurse mgr {fmt_money(NURSE_MGR.monthly)} | CSM {fmt_money(CSM.monthly)}")
    print(f"Productive hours per nurse-month: {PROD_H:.1f} (of {HOURS_PER_MONTH:.1f} paid)")
    print(f"CCM minutes per enrolled patient-month: {ccm_minutes_per_enrolled():.1f} -> capacity {CCM_CAP_COMPUTED:.0f}")
    print(f"APCM minutes per enrolled patient-month: {apcm_minutes_per_enrolled():.1f} -> capacity {APCM_CAP_COMPUTED:.0f}")
    print(f"Founders' implied loaded nurse cost: $18.91 x 380 = {fmt_money(18.91*380)}/mo = {fmt_money(18.91*380*12)}/yr")
    print(f"Founders' APCM: nurse at 1,400 = {fmt_money(18.91*380/1400)} -> implied non-nurse cost {7.84-18.91*380/1400:.2f}")
    print(f"Founders' APCM nurse minutes per patient-month at 1,400: {PROD_H*60/1400:.1f} (at my productive hours); "
          f"{HOURS_PER_MONTH*60/1400:.1f} (at 100% of paid hours)")

    print("\n== Cost per enrolled patient-month ==")
    costs = {
        "CCM, RN, 300/nurse": cost_per_patient("ccm", RN, 300),
        "CCM, LPN, 300/nurse": cost_per_patient("ccm", LPN, 300),
        "CCM, RN, 380/nurse (founders' capacity)": cost_per_patient("ccm", RN, 380),
        "APCM, RN, 450/nurse": cost_per_patient("apcm", RN, 450),
        "APCM, RN, 600/nurse": cost_per_patient("apcm", RN, 600),
        "APCM, RN, 900/nurse": cost_per_patient("apcm", RN, 900),
        "APCM, RN, 1400/nurse (founders' capacity)": cost_per_patient("apcm", RN, 1400),
    }
    for k, v in costs.items():
        parts = ", ".join(f"{p} {v[p]:.2f}" for p in ["nurse", "supervision", "ai", "infra", "after_hours", "re_enrol"])
        print(f"{k:<44} total {v['total']:6.2f}  ({parts})  GM at $27x0.96: {(25.92-v['total'])/25.92*100:6.1f}%")

    ccm_lpn = costs["CCM, LPN, 300/nurse"]["total"]
    ccm_rn = costs["CCM, RN, 300/nurse"]["total"]
    apcm600 = costs["APCM, RN, 600/nurse"]["total"]
    apcm450 = costs["APCM, RN, 450/nurse"]["total"]
    apcm900 = costs["APCM, RN, 900/nurse"]["total"]
    blended = 0.5 * ccm_lpn + 0.5 * apcm600

    print("\n== Founders' model, reproduced ==")
    f_blend = 0.54 * 18.91 + 0.46 * 7.84
    print(f"Blended cost at 54/46 CCM/APCM: {f_blend:.2f}; GM {(27-f_blend)/27*100:.1f}%")
    f_pr = 210 * (27 - f_blend)
    print(f"Per-practice gross profit/mo {fmt_money(f_pr)}; x50 practices x12 = {fmt_money(f_pr*50*12)} (= implied opex at break-even)")
    print(f"Nurses at 50 practices: CCM {50*210*0.54/380:.1f} + APCM {50*210*0.46/1400:.1f}")

    founders = Scenario("Founders (45%, their costs, no CAC/churn/AM)", enrol=0.45, cogs_pp=f_blend, collect=1.0,
                        am_pm=0, cac=0, onboard_fixed=0, phone_consent_share=0, ramp_start=1, ramp_full=1,
                        practice_churn=0.0, fixed_opex=f_pr * 50 * 12)
    base = Scenario("Investor base: 25%, 50/50 mix (LPN CCM)", cogs_pp=blended)
    scen = [
        founders,
        replace(founders, name="Founders' costs + my enrol/CAC/churn/opex", enrol=0.25, collect=0.96,
                am_pm=Scenario.am_pm, cac=12_000, onboard_fixed=3_000, phone_consent_share=0.5,
                ramp_start=3, ramp_full=12, practice_churn=0.015, fixed_opex=2_000_000),
        base,
        replace(base, name="CCM only, LPN, 300/nurse", cogs_pp=ccm_lpn),
        replace(base, name="CCM only, RN, 300/nurse", cogs_pp=ccm_rn),
        replace(base, name="APCM only, RN, 450/nurse", cogs_pp=apcm450),
        replace(base, name="APCM only, RN, 600/nurse", cogs_pp=apcm600),
        replace(base, name="APCM only, RN, 900/nurse", cogs_pp=apcm900),
        replace(base, name="APCM only, RN, 600/nurse, 45% enrol", cogs_pp=apcm600, enrol=0.45),
        replace(base, name="APCM only, RN, 900/nurse, 35% enrol", cogs_pp=apcm900, enrol=0.35),
        replace(base, name="Base but 2-physician practice (313 eligible)", eligible=313),
    ]
    print("\n== Per-practice and company economics ==")
    for s in scen:
        print(describe(s))

    print("\n== Enrolment thresholds (share of eligible traditional-Medicare patients) ==")
    tests = {
        "contribution > 0": lambda s: s.contrib_ss > 0,
        "payback <= 24 mo": lambda s: (s.payback_month() or 999) <= 24,
        "break-even <= 300 practices": lambda s: (s.breakeven_practices() or 1e9) <= 300,
    }
    for s in scen[2:8]:
        res = []
        for label, t in tests.items():
            r = solve_enrol(s, t)
            res.append(f"{label}: {'none <=100%' if r is None else f'{r*100:.1f}%'}")
        print(f"{s.name:<44} " + " | ".join(res))

    print("\n== Revenue per practice and practices needed for $100M ==")
    for s in [founders, base]:
        rev_y = s.revenue_pm_ss * 12
        print(f"{s.name:<44} revenue/practice/yr {fmt_money(rev_y)} -> practices for $100M: {100e6/rev_y:,.0f}")

    print("\n== Practice-side net value (3 physicians, per month) ==")
    # Medicare pays 80% of allowed less 2% sequestration; 20% coinsurance collected at the rate given.
    def ccm_practice(enrolled, billable=0.80, coins_collect=0.85, biller=0.06, fee=27):
        allowed = 66.13
        per_billed = 0.8 * allowed * 0.98 + 0.2 * allowed * coins_collect
        gross = enrolled * billable * per_billed
        return gross, gross * (1 - biller) - enrolled * fee

    def apcm_practice(enrolled, qmb=0.15, billable=0.95, coins_collect=0.85, qmb_coins_collect=0.30, biller=0.06, fee=27):
        g7 = 0.8 * 53.78 * 0.98 + 0.2 * 53.78 * coins_collect
        g8 = 0.8 * 117.24 * 0.98 + 0.2 * 117.24 * qmb_coins_collect
        per = (1 - qmb) * g7 + qmb * g8
        gross = enrolled * billable * per
        return gross, gross * (1 - biller) - enrolled * fee

    for enrolled in (117.5, 211.5):
        g, n = ccm_practice(enrolled)
        g2, n2 = apcm_practice(enrolled)
        print(f"enrolled {enrolled:5.1f}: CCM collected {fmt_money(g)}/mo, net after biller+fee {fmt_money(n)}/mo ({fmt_money(n*12)}/yr) | "
              f"APCM collected {fmt_money(g2)}/mo, net {fmt_money(n2)}/mo ({fmt_money(n2*12)}/yr)")

    print("\n== Revenue per nurse vs cost ==")
    for label, cap, staff in [("CCM LPN 300", 300, LPN), ("CCM RN 300", 300, RN), ("CCM founders 380", 380, None),
                              ("APCM RN 600", 600, RN), ("APCM founders 1400", 1400, None)]:
        rev = cap * 27 * 0.96
        cost = staff.monthly if staff else 18.91 * 380
        print(f"{label:<20} revenue/nurse-mo {fmt_money(rev):>8} vs loaded nurse {fmt_money(cost):>7} -> ratio {rev/cost:4.2f}")
