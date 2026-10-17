import { useState, type ReactElement } from 'react';
import { Phone } from 'lucide-react';
import { InfoTip } from '@/components/app/info-tip';
import { Duration, LiveDot } from '@/components/app/time';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useServerRealMs, useStore } from '../store';

type ScriptKey =
  | 'explainedAvailability'
  | 'explainedCostSharing'
  | 'explainedOnePractitioner'
  | 'explainedRightToStop'
  | 'automatedCallsOk'
  | 'textsOk';

/** A disabled control with a tooltip naming why; renders the control as is when `reason` is null. */
function Gate({ reason, children }: { reason: string | null; children: ReactElement }) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>button]:w-full">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/** Focus the dialog itself on open, so a tooltip trigger inside it does not pop its tooltip. */
function focusDialog(e: Event) {
  e.preventDefault();
  (e.currentTarget as HTMLElement | null)?.focus();
}

/** One line of the script the nurse reads aloud, ticked as she explains it. */
function ScriptItem({
  id,
  checked,
  onToggle,
  title,
  optional,
  say,
}: {
  id: ScriptKey;
  checked: boolean;
  onToggle: () => void;
  title: string;
  optional?: boolean;
  say: string;
}) {
  return (
    <label
      htmlFor={`consent-${id}`}
      className={cn('flex cursor-pointer gap-3 rounded-md border p-3 transition-colors', checked ? 'border-emerald-200 bg-emerald-50' : 'hover:bg-muted/40')}
    >
      <Checkbox id={`consent-${id}`} checked={checked} onCheckedChange={onToggle} className="mt-0.5 bg-background" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold">
          {title}
          {optional && <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>}
        </span>
        <span className="text-sm text-muted-foreground italic">“{say}”</span>
      </span>
    </label>
  );
}

export function ConsentModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { state, act } = useStore();
  const real = useServerRealMs();
  const p = state.patients.find((x) => x.id === patientId)!;
  const t = state.timer;
  const running = t && t.patientId === patientId && t.activity === 'consent_call';
  const [x, setX] = useState({
    explainedAvailability: false,
    explainedCostSharing: false,
    explainedOnePractitioner: false,
    explainedRightToStop: false,
    automatedCallsOk: false,
    textsOk: false,
  });
  const four = x.explainedAvailability && x.explainedCostSharing && x.explainedOnePractitioner && x.explainedRightToStop;
  const tick = (k: ScriptKey) => setX({ ...x, [k]: !x[k] });

  async function record(outcome: 'agreed' | 'declined' | 'call_back') {
    const r = await act('recordConsent', { patientId, outcome, ...x });
    if (r.ok) onClose();
  }

  const item = (k: ScriptKey, title: string, say: string, optional = false) => (
    <ScriptItem id={k} checked={x[k]} onToggle={() => tick(k)} title={title} optional={optional} say={say} />
  );
  const notStarted = running ? null : 'Start the consent call first';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl" onOpenAutoFocus={focusDialog}>
        <DialogHeader>
          <DialogTitle>Consent call · {p.name}</DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-1.5 sm:justify-start">
            <Phone className="size-4" />
            <span className="tabular-nums">{p.phone}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
          {running ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-800">
              <LiveDot />
              Consent call
              <Duration seconds={((real - t.startedRealMs) / 1000) * t.speed} />
              <InfoTip>Logged, not counted toward care management time</InfoTip>
            </div>
          ) : (
            <>
              <span />
              <Gate reason={t ? `${t.activityLabel} timer running for ${t.patientName}` : null}>
                <Button disabled={!!t} onClick={() => act('startConsentCall', { patientId })}>
                  <Phone />
                  Start consent call
                </Button>
              </Gate>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground italic">
            “Hi {p.first_name}, this is Rachel Okafor, a nurse at {state.practice.name}, Dr. Patel's office. Dr. Patel would like to offer you our care
            management program: a monthly check-in on your health between visits, and help with medicines, appointments and follow-up.”
          </p>
          {item(
            'explainedAvailability',
            '1. Availability',
            'You can reach the practice any time, day or night, through our after-hours line, and we check in with you every month.',
          )}
          {item(
            'explainedCostSharing',
            '2. Cost sharing',
            'Medicare covers this service, but like other services a coinsurance or deductible may apply, usually about 20% of the monthly fee. Supplemental insurance may cover it.',
          )}
          {item(
            'explainedOnePractitioner',
            '3. One practitioner',
            "Only one practitioner can bill for this service each month, so Dr. Patel's office will be the one providing it.",
          )}
          {item('explainedRightToStop', '4. Right to stop', 'You can stop at any time by telling us. Stopping takes effect at the end of the month.')}
          {item(
            'automatedCallsOk',
            'Automated calls',
            `Each month we may check in with an automated, recorded call from ${state.practice.phone}. It asks a few questions about your health. You can ask for a nurse at any time, or say "stop calling me" to end these calls. Is that OK?`,
            true,
          )}
          {item('textsOk', 'Texts', `May we also send you text reminders at ${p.phone}? Reply STOP to end them.`, true)}
          <p className="text-sm text-muted-foreground italic">“Do you agree to join?”</p>
        </div>
        <DialogFooter>
          <Gate reason={notStarted}>
            <Button variant="outline" onClick={() => record('call_back')} disabled={!running}>
              Call back later
            </Button>
          </Gate>
          <Gate reason={notStarted}>
            <Button variant="outline" onClick={() => record('declined')} disabled={!running}>
              Patient declines
            </Button>
          </Gate>
          <Gate reason={notStarted ?? (four ? null : 'Tick the four explained items first')}>
            <Button onClick={() => record('agreed')} disabled={!running || !four}>
              Patient agrees — record consent
            </Button>
          </Gate>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
