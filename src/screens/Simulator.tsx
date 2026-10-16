import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import type { RunItem } from '../../shared/api';
import { aiAnswer, aiPrompt, aiStart, type AiContext, type AiInput, type AiState } from '../../shared/aiCall';
import { toIso } from '../../shared/time';
import { ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useDemoNowMs, useStore } from '../store';
import { RunSummary } from './RunSummary';
import { Transcript } from './Transcript';

export function Simulator() {
  const { state, act, busy } = useStore();
  const nowMs = useDemoNowMs();
  const apcm = state.patients.filter((p) => p.program === 'apcm' && (p.status === 'active' || p.status === 'opted_out'));
  const [pid, setPid] = useState<number | null>(null);
  const [inputs, setInputs] = useState<AiInput[]>([]);
  const [sim, setSim] = useState<AiState | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<RunItem | null>(null);
  const p = apcm.find((x) => x.id === pid) ?? null;

  const [ctx, setCtx] = useState<AiContext | null>(null);

  function start() {
    if (!p || !p.setup) return;
    const c: AiContext = {
      firstName: p.first_name,
      lastName: p.last_name,
      phone: p.phone,
      caregiverName: p.caregiver_name,
      readings: p.setup.readings,
      symptoms: p.setup.symptoms_to_watch,
      callAt: toIso(nowMs),
    };
    setCtx(c);
    setSim(aiStart(c));
    setInputs([]);
    setSaved(null);
  }

  async function answer(input: AiInput) {
    if (!sim || !ctx || !p) return;
    const next = aiAnswer(sim, ctx, input);
    const all = [...inputs, input];
    setSim(next);
    setInputs(all);
    setText('');
    if (next.done) {
      const r = await act<RunItem>('simulateAiCall', { patientId: p.id, inputs: all });
      if (r.ok && r.result) setSaved(r.result);
    }
  }

  const prompt = sim && ctx ? aiPrompt(sim, ctx) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Call simulator" description="You play the patient." />
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Play a call</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-48 flex-1 [&>[data-slot=native-select-wrapper]]:w-full">
                <NativeSelect
                  aria-label="APCM patient"
                  value={pid ?? ''}
                  onChange={(e) => {
                    setPid(e.target.value ? Number(e.target.value) : null);
                    setSim(null);
                    setSaved(null);
                  }}
                >
                  <NativeSelectOption value="">Pick an APCM patient…</NativeSelectOption>
                  {apcm.map((x) => (
                    <NativeSelectOption key={x.id} value={x.id} disabled={!x.ai.ok}>
                      {x.name} ({x.mrn}){x.ai.ok ? '' : ` — ${x.ai.reason}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Button disabled={!p || !p.ai.ok || busy || (sim !== null && !sim.done)} onClick={start}>
                <PhoneCall />
                {sim?.done ? 'Call again' : 'Start call'}
              </Button>
            </div>
            {!sim ? (
              <div className="rounded-lg border border-dashed">
                <EmptyState title="Pick a patient and start the call" />
              </div>
            ) : (
              <>
                <div className="max-h-[420px] overflow-y-auto">
                  <Transcript lines={sim.transcript} live />
                </div>
                {prompt && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {prompt.options.map((o) => (
                        <Button key={o.id} variant="outline" size="sm" onClick={() => answer({ choice: o.id })} title={o.say ?? ''}>
                          {o.label}
                        </Button>
                      ))}
                    </div>
                    {prompt.textPlaceholder && (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (text.trim()) answer({ text: text.trim() });
                        }}
                      >
                        <Input
                          className="h-8 flex-1"
                          aria-label="What the patient says"
                          placeholder={prompt.textPlaceholder}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Say it
                        </Button>
                      </form>
                    )}
                  </div>
                )}
                {sim.done && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <ToneBadge tone={sim.outcome === 'escalated' ? 'danger' : sim.outcome === 'completed' ? 'ok' : 'warn'} className="capitalize">
                      {sim.outcome?.replace('_', ' ')}
                    </ToneBadge>
                    {saved ? (
                      <span>
                        Saved. {saved.detail}{' '}
                        <a href={`#/patient/${saved.patientId}`} className="font-medium text-primary hover:underline">
                          Open patient
                        </a>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Saving…</span>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              October AI calls
              <InfoTip>Plays the scripted 6–13 Oct calls in date order</InfoTip>
            </CardTitle>
            <CardAction>
              <Button size="sm" disabled={busy} onClick={() => act('runAiCalls')}>
                Run
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {state.lastRun ? (
              <RunSummary run={state.lastRun} />
            ) : (
              <div className="rounded-lg border border-dashed">
                <EmptyState title="Not run yet" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
