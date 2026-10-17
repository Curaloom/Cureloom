import { useState } from 'react';
import { Inbox, Phone, Send } from 'lucide-react';
import type { NurseQueueItem, NurseQueues } from '../../shared/api';
import { fmtDay, toIso } from '../../shared/time';
import { FlagBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { Gate } from '@/components/app/gate';
import { PageHeader } from '@/components/app/page-header';
import { Countdown } from '@/components/app/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { go } from '../router';
import { useDemoNowMs, useStore } from '../store';
import { ConsentModal } from './ConsentModal';

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

type Key = keyof Omit<NurseQueues, 'careOpensOn'>;

const TABS: { key: Key; label: string; help: string }[] = [
  {
    key: 'consent',
    label: 'Consent pending',
    help: 'Approved by Ops, no consent yet. Oldest contact attempt first. Send the consent link, or call with the script on screen; nothing is dialled.',
  },
  {
    key: 'care',
    label: 'Care not yet delivered',
    help: 'Active patients whose monthly care is not complete as the month end nears. Minutes are shown as logged; this list never counts down to a threshold.',
  },
  { key: 'urgency', label: 'Clinical urgency', help: 'Urgent and concern flags from check-in calls, and patients not reached after three tries.' },
  { key: 'pending', label: 'Pending steps', help: 'Missing workflow steps: call setup, care plan approval, calls due, tasks, AI calls to review, month-end notes.' },
];

export function Queue() {
  const { state } = useStore();
  const nowMs = useDemoNowMs();
  const q = state.queues;
  const [tab, setTab] = useState<Key>(() => (q.urgency.length ? 'urgency' : (TABS.find((t) => q[t.key].length)?.key ?? 'urgency')));
  const [consentFor, setConsentFor] = useState<number | null>(null);
  const today = toIso(nowMs).slice(0, 10);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Today"
        meta={
          <>
            <span className="font-medium text-foreground">{fmtDay(toIso(nowMs))}</span>
            <span aria-hidden>·</span>
            <span>Four queues; a patient can sit in more than one</span>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Key)}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                {t.label}
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    t.key === 'urgency' && q.urgency.some((x) => x.level === 'urgent') ? 'font-semibold text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {q[t.key].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t.help}</p>
            <Card className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                {!q[t.key].length ? (
                  <EmptyState
                    icon={<Inbox />}
                    title={t.key === 'care' && today < q.careOpensOn ? `This list opens on ${fmtDay(q.careOpensOn)}` : 'Nobody here right now'}
                  />
                ) : (
                  <QueueTable tab={t.key} list={q[t.key]} nowMs={nowMs} onConsent={setConsentFor} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      {consentFor != null && <ConsentModal patientId={consentFor} onClose={() => setConsentFor(null)} />}
    </div>
  );
}

function QueueTable({ tab, list, nowMs, onConsent }: { tab: Key; list: NurseQueueItem[]; nowMs: number; onConsent: (id: number) => void }) {
  const { role, act, say } = useStore();
  const nurse = role === 'nurse';
  const gate = nurse ? null : 'Nurse only';
  return (
    <div className="overflow-x-auto">
      <Table className={EDGE}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Patient</TableHead>
            <TableHead className="text-muted-foreground">Program</TableHead>
            <TableHead className="text-muted-foreground">Why</TableHead>
            <TableHead className="text-right text-muted-foreground">Minutes logged</TableHead>
            {tab === 'consent' && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => (
            <TableRow
              key={r.patientId}
              className={cn('cursor-pointer hover:bg-muted/50', r.level === 'urgent' && 'bg-destructive/5 hover:bg-destructive/10')}
              onClick={() => go(`/patient/${r.patientId}`)}
            >
              <TableCell className="align-top">
                <div className="flex items-center gap-2">
                  {r.level && r.level !== 'info' && <FlagBadge level={r.level} />}
                  <a href={`#/patient/${r.patientId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {r.name}
                  </a>
                </div>
                <div className="font-mono text-xs text-muted-foreground">{r.mrn}</div>
              </TableCell>
              <TableCell className="align-top text-sm">{r.program}</TableCell>
              <TableCell className="min-w-72 align-top whitespace-normal">
                <ul className="flex flex-col gap-0.5 text-sm">
                  {r.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {r.ackDueAt && (
                  <div className="mt-0.5 text-xs text-destructive">
                    Acknowledge within 30 min · <Countdown dueMs={Date.parse(`${r.ackDueAt}Z`)} nowMs={nowMs} />
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">{r.minutes}</TableCell>
              {tab === 'consent' && (
                <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    <Gate reason={gate}>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={!nurse}
                        onClick={async () => {
                          const res = await act('sendConsentLink', { patientId: r.patientId });
                          if (res.ok) say('Consent link sent (see the outbox).', 'ok');
                        }}
                      >
                        <Send />
                        {r.linkSent ? 'Resend link' : 'Send link'}
                      </Button>
                    </Gate>
                    <Gate reason={gate}>
                      <Button size="xs" disabled={!nurse} onClick={() => onConsent(r.patientId)}>
                        <Phone />
                        Call
                      </Button>
                    </Gate>
                    {r.linkSent && (
                      <Button
                        size="xs"
                        variant="ghost"
                        title="Tester: play the patient opening the link and signing"
                        onClick={() => act('simulateConsentSigned', { patientId: r.patientId, automatedCallsOk: true, textsOk: true })}
                      >
                        <ToneBadge tone="neutral">Tester</ToneBadge>
                        Patient signs
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
