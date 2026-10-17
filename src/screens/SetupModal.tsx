import { useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { defaultSetupFor, READING_ORDER, RULE_ORDER } from '../../shared/codes';
import { DEFAULT_TARGETS, READINGS, RULES } from '../../shared/rules';
import type { Program, ReadingType, RuleCode, Targets } from '../../shared/types';
import { ToneBadge } from '@/components/app/badges';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '../store';

/** A checkbox with its label, plus an optional small suffix. */
function CheckRow({ id, checked, onToggle, children, suffix }: { id: string; checked: boolean; onToggle: () => void; children: ReactNode; suffix?: ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <span>{children}</span>
      {suffix}
    </label>
  );
}

/** One inline row of target inputs under a ticked reading. */
function TargetRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 pb-1 pl-6 text-xs text-muted-foreground">{children}</div>;
}

const NUM = 'h-7 w-16 px-2 text-sm text-foreground tabular-nums md:text-sm';

/** Focus the dialog itself on open, so the first code chip's tooltip does not pop up. */
function focusDialog(e: Event) {
  e.preventDefault();
  (e.currentTarget as HTMLElement | null)?.focus();
}

export function SetupModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { state, act } = useStore();
  const p = state.patients.find((x) => x.id === patientId)!;
  const defaults = defaultSetupFor(p.qualifying_codes);
  const s = p.setup;
  const firstAllowed = p.programOptions.find((o) => !o.block)?.program ?? null;
  const start = p.program && !p.programOptions.find((o) => o.program === p.program)?.block ? p.program : (p.proposed_program ?? firstAllowed);
  const [program, setProgram] = useState<Program | null>(start);
  const [readings, setReadings] = useState<ReadingType[]>(s?.readings ?? defaults.readings);
  const [symptoms, setSymptoms] = useState<RuleCode[]>(s?.symptoms_to_watch ?? defaults.rules);
  const [targets, setTargets] = useState<Targets>(s?.targets ?? DEFAULT_TARGETS);
  const [planDate, setPlanDate] = useState(s?.ehr_plan_reviewed_on ?? p.last_visit_date ?? '');
  const autoOk = !!p.consent?.automated_calls_ok;

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (v: string) => (v === '' ? null : Number(v));

  async function save() {
    if (!program) return;
    const r = await act('saveCallSetup', {
      patientId,
      program,
      readings: READING_ORDER.filter((x) => readings.includes(x)),
      symptoms: RULE_ORDER.filter((x) => symptoms.includes(x)),
      targets,
      ehrPlanReviewedOn: planDate || null,
    });
    if (r.ok) onClose();
  }

  const target = (r: ReadingType) => {
    switch (r) {
      case 'bp':
        return (
          <TargetRow>
            Target below
            <Input
              type="number"
              aria-label="Systolic target"
              className={NUM}
              value={targets.bp.sysMax}
              onChange={(e) => setTargets({ ...targets, bp: { ...targets.bp, sysMax: Number(e.target.value) } })}
            />
            /
            <Input
              type="number"
              aria-label="Diastolic target"
              className={NUM}
              value={targets.bp.diaMax}
              onChange={(e) => setTargets({ ...targets, bp: { ...targets.bp, diaMax: Number(e.target.value) } })}
            />
          </TargetRow>
        );
      case 'glucose':
        return (
          <TargetRow>
            Target
            <Input
              type="number"
              aria-label="Glucose minimum"
              className={NUM}
              value={targets.glucose.min}
              onChange={(e) => setTargets({ ...targets, glucose: { ...targets.glucose, min: Number(e.target.value) } })}
            />
            –
            <Input
              type="number"
              aria-label="Glucose maximum"
              className={NUM}
              value={targets.glucose.max}
              onChange={(e) => setTargets({ ...targets, glucose: { ...targets.glucose, max: Number(e.target.value) } })}
            />
            mg/dL
          </TargetRow>
        );
      case 'weight':
        return (
          <TargetRow>
            Dry weight
            <Input
              type="number"
              aria-label="Dry weight"
              className={NUM}
              value={targets.weight.baseline ?? ''}
              onChange={(e) => setTargets({ ...targets, weight: { ...targets.weight, baseline: num(e.target.value) } })}
            />
            lb, flag a gain of
            <Input
              type="number"
              aria-label="Weight gain limit"
              className={NUM}
              value={targets.weight.maxGain}
              onChange={(e) => setTargets({ ...targets, weight: { ...targets.weight, maxGain: Number(e.target.value) } })}
            />
            lb
          </TargetRow>
        );
      case 'oxygen':
        return (
          <TargetRow>
            At least
            <Input
              type="number"
              aria-label="Oxygen minimum"
              className={NUM}
              value={targets.oxygen.min}
              onChange={(e) => setTargets({ ...targets, oxygen: { min: Number(e.target.value) } })}
            />
            %
          </TargetRow>
        );
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl" onOpenAutoFocus={focusDialog}>
        <DialogHeader>
          <DialogTitle>Call setup · {p.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Saving compiles a care plan for {state.staff.physician.name} to approve.{' '}
            {p.status === 'active' ? 'The approved version stays in effect until then.' : 'Calls start once it is approved.'}
          </p>
          <DialogDescription asChild>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {p.codes.map((c) => (
                <Tooltip key={c.code}>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <ToneBadge tone="info" className="font-mono">
                        {c.code}
                      </ToneBadge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{c.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>

        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="mb-1">
            Program{p.proposed_program && <span className="font-normal text-muted-foreground"> · Ops proposed {p.proposed_program.toUpperCase()}</span>}
          </FieldLegend>
          <RadioGroup value={program ?? ''} onValueChange={(v) => setProgram(v as Program)} className="gap-2 sm:grid-cols-2">
            {p.programOptions.map((o) => (
              <label
                key={o.program}
                htmlFor={`program-${o.program}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <RadioGroupItem id={`program-${o.program}`} value={o.program} disabled={!!o.block} className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">
                    {o.tier} · {o.code}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {o.block
                      ? `Not available: ${o.block}`
                      : o.program === 'ccm'
                        ? 'Nurse makes the monthly call · 99490 at 20 counted minutes, 99439 per further 20'
                        : 'AI makes the monthly check-in · needs a completed contact'}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
          {!autoOk && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <TriangleAlert className="size-3.5 shrink-0" />
              No automated-call consent: the monthly call becomes a nurse task
            </p>
          )}
        </FieldSet>

        <div className="grid gap-6 sm:grid-cols-2">
          <FieldSet className="gap-1">
            <FieldLegend variant="label" className="mb-1">
              Readings to ask
            </FieldLegend>
            {(['bp', 'glucose', 'weight', 'oxygen'] as ReadingType[]).map((r) => (
              <div key={r} className="flex flex-col gap-1">
                <CheckRow
                  id={`reading-${r}`}
                  checked={readings.includes(r)}
                  onToggle={() => toggle(readings, r, setReadings)}
                  suffix={defaults.readings.includes(r) && <span className="text-xs text-muted-foreground">condition</span>}
                >
                  {READINGS[r].label}
                </CheckRow>
                {readings.includes(r) && target(r)}
              </div>
            ))}
            <Field className="mt-4 max-w-56 gap-2">
              <FieldLabel htmlFor="plan-reviewed">Last EHR care plan review</FieldLabel>
              <Input id="plan-reviewed" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </Field>
          </FieldSet>
          <FieldSet className="gap-1">
            <FieldLegend variant="label" className="mb-1">
              Symptoms to watch
            </FieldLegend>
            {RULE_ORDER.map((r) => (
              <CheckRow
                key={r}
                id={`rule-${r}`}
                checked={symptoms.includes(r)}
                onToggle={() => toggle(symptoms, r, setSymptoms)}
                suffix={
                  RULES[r].level === 'urgent' ? (
                    <span className="text-xs whitespace-nowrap text-destructive">urgent → {RULES[r].escalation}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">concern</span>
                  )
                }
              >
                {RULES[r].label}
              </CheckRow>
            ))}
          </FieldSet>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!program} onClick={save}>
            {p.status === 'active' ? 'Save call setup' : 'Save and send care plan for approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
