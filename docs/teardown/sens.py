"""Sensitivity tables for the investor rebuild. Imports ue_model from this directory."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataclasses import replace
from ue_model import (Staff, RN, LPN, cost_per_patient, Scenario, PROD_H, apcm_minutes_per_enrolled,
                      fmt_money, solve_enrol)

NET_FEE = 27 * 0.96
MA = Staff(44_200)

print("== CCM gross margin at $27 x 0.96, by staffing and capacity ==")
print(f"{'':10}" + "".join(f"{c:>10}" for c in (250, 300, 380)))
for label, st in (("RN $90k", RN), ("LPN $62k", LPN), ("MA $44k", MA)):
    row = []
    for cap in (250, 300, 380):
        c = cost_per_patient("ccm", st, cap)["total"]
        row.append(f"{(NET_FEE - c) / NET_FEE * 100:9.0f}%")
    print(f"{label:10}" + "".join(row))

print("\nCCM fee needed for 40% gross margin (after 4% credits), and what the practice keeps at that fee:")
per_enrolled_practice = (0.8 * 66.13 * 0.98 + 0.2 * 66.13 * 0.85) * 0.80 * 0.94  # after biller
for label, st, cap in (("RN 300", RN, 300), ("LPN 300", LPN, 300), ("MA 300", MA, 300), ("LPN 380", LPN, 380)):
    c = cost_per_patient("ccm", st, cap)["total"]
    fee = c / 0.6 / 0.96
    print(f"  {label:8} cost {c:6.2f} -> fee {fee:6.2f}; practice keeps {per_enrolled_practice - fee:6.2f} per enrolled patient-month (of {per_enrolled_practice:.2f})")

print("\n== APCM gross margin at $27 x 0.96, by RN salary and capacity ==")
caps = (450, 600, 750, 900, 1100, 1400)
print(f"{'':12}" + "".join(f"{c:>8}" for c in caps))
for base in (75_000, 90_000):
    st = Staff(base)
    row = []
    for cap in caps:
        c = cost_per_patient("apcm", st, cap)["total"]
        row.append(f"{(NET_FEE - c) / NET_FEE * 100:7.0f}%")
    print(f"RN ${base//1000}k     " + "".join(row))
for base in (75_000, 90_000):
    st = Staff(base)
    for cap in range(300, 3000, 10):
        c = cost_per_patient("apcm", st, cap)["total"]
        if (NET_FEE - c) / NET_FEE >= 0.40:
            print(f"APCM capacity needed for 40% GM with RN ${base//1000}k: {cap} patients/nurse "
                  f"= {PROD_H*60/cap:.1f} nurse-minutes per patient-month")
            break

print("\nAPCM nurse minutes per patient-month by scenario:")
print(f"  base {apcm_minutes_per_enrolled():.1f} min; 25% refuse AI instead of 15%: {apcm_minutes_per_enrolled(human_pref=0.25):.1f} min "
      f"-> capacity {PROD_H*60/apcm_minutes_per_enrolled():.0f} vs {PROD_H*60/apcm_minutes_per_enrolled(human_pref=0.25):.0f}")
print(f"  exception-only review (no routine call review, care plan 1 min): {apcm_minutes_per_enrolled(review=0, careplan=1.0):.1f} min "
      f"-> capacity {PROD_H*60/apcm_minutes_per_enrolled(review=0, careplan=1.0):.0f}")

print("\n== APCM-only, RN $90k: payback months (from signing) / break-even practices, by capacity x enrolment ==")
enrols = (0.15, 0.20, 0.25, 0.30, 0.35, 0.45)
print(f"{'cap':>6}" + "".join(f"{int(e*100):>14}%" for e in enrols))
for cap in (600, 750, 900, 1100, 1400):
    c = cost_per_patient("apcm", RN, cap)["total"]
    row = []
    for e in enrols:
        s = Scenario("x", cogs_pp=c, enrol=e)
        pb = s.payback_month()
        be = s.breakeven_practices()
        row.append(f"{('never' if pb is None else str(pb)):>6}/{('never' if be is None else f'{be:,.0f}'):>7} ")
    print(f"{cap:>6} " + "".join(row))

print("\n== Base scenario variants ==")
apcm600 = cost_per_patient("apcm", RN, 600)["total"]
apcm900 = cost_per_patient("apcm", RN, 900)["total"]
for name, s in (
    ("APCM 900, practices pay only for billable months (95%)", Scenario("a", cogs_pp=apcm900, collect=0.96 * 0.95)),
    ("APCM 900, practice churn 2.5%/mo", Scenario("b", cogs_pp=apcm900, practice_churn=0.025)),
    ("APCM 900, CAC $6k via channel, fee net of 15% channel cut", Scenario("c", cogs_pp=apcm900, cac=6_000, fee=27 * 0.85)),
    ("APCM 900, opex $3M", Scenario("d", cogs_pp=apcm900, fixed_opex=3_000_000)),
):
    pb = s.payback_month(); be = s.breakeven_practices()
    print(f"  {name:<58} GM {s.gm_ss*100:5.1f}% contrib/pr-mo {fmt_money(s.contrib_ss):>7} payback {pb} mo, break-even {('never' if be is None else f'{be:,.0f}')} practices")

print("\n== Cash: months from first sales touch (4-month cycle) to payback ==")
for name, c, e in (("Founders' costs, 25%", 0.54 * 18.91 + 0.46 * 7.84, 0.25), ("APCM 900, 25%", apcm900, 0.25), ("APCM 600, 25%", apcm600, 0.25)):
    s = Scenario("x", cogs_pp=c, enrol=e)
    pb = s.payback_month()
    print(f"  {name:<24} payback from signing {pb} mo -> from first touch {pb + 4 if pb else 'never'} mo")

print("\n== Working capital at 50 practices (APCM 900, 25%) ==")
s = Scenario("wc", cogs_pp=apcm900)
rev = 50 * s.revenue_pm_ss
cogs = 50 * s.enrolled * s.cogs_pp
print(f"  monthly revenue {fmt_money(rev)}; COGS {fmt_money(cogs)}; ~2.0 months of COGS financed = {fmt_money(2 * cogs)}; AR at 60 days = {fmt_money(2 * rev)}")

print("\n== TAM sketch (assumptions) ==")
tm = 64.2e6 - 35.2e6
for share_small, enrol, fee in ((0.25, 0.25, 27), (0.25, 0.45, 27)):
    elig = tm * 0.67
    pool = elig * share_small * enrol * fee * 12
    print(f"  traditional Medicare {tm/1e6:.1f}M x 67% x {share_small:.0%} in small independent practices x {enrol:.0%} enrolled x ${fee} x 12 = {fmt_money(pool)} per year if you had EVERY such practice")
