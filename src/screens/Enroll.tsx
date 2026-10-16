import { useState, type ReactElement } from 'react';
import { UserPlus } from 'lucide-react';
import type { EnrollBucket, PatientView } from '../../shared/api';
import { fmtDate } from '../../shared/time';
import { StatusBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '../store';
import { ConsentModal } from './ConsentModal';
import { SetupModal } from './SetupModal';

const SECTIONS: { bucket: EnrollBucket; title: string }[] = [
  { bucket: 'awaiting_confirmation', title: 'Awaiting confirmation' },
  { bucket: 'needs_consent', title: 'Needs consent' },
  { bucket: 'needs_setup', title: 'Needs call setup' },
  { bucket: 'not_eligible', title: 'Not eligible' },
  { bucket: 'stopped', title: 'Paused or opted out' },
];

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

/** A disabled control with a tooltip naming why; renders the control as is when `reason` is null. */
function Gate({ reason, children }: { reason: string | null; children: ReactElement }) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function Enroll() {
  const { state, role, act } = useStore();
  const [consentFor, setConsentFor] = useState<number | null>(null);
  const [setupFor, setSetupFor] = useState<number | null>(null);
  const by = (b: EnrollBucket) => state.patients.filter((p) => p.enrollBucket === b);
  const [tab, setTab] = useState<string>(() => (SECTIONS.find((s) => by(s.bucket).length) ?? SECTIONS[0]).bucket);
  const nurseOnly = role === 'nurse' ? null : 'Nurse only';

  function action(p: PatientView) {
    switch (p.enrollBucket) {
      case 'awaiting_confirmation':
        return (
          <Gate reason={role === 'manager' ? null : 'Practice manager only'}>
            <Button size="sm" disabled={role !== 'manager'} onClick={() => act('confirmEligibility', { patientId: p.id })}>
              Confirm eligibility
            </Button>
          </Gate>
        );
      case 'needs_consent':
        return (
          <Gate reason={nurseOnly}>
            <Button size="sm" disabled={role !== 'nurse'} onClick={() => setConsentFor(p.id)}>
              Open consent script
            </Button>
          </Gate>
        );
      case 'needs_setup':
        return (
          <Gate reason={nurseOnly}>
            <Button size="sm" disabled={role !== 'nurse'} onClick={() => setSetupFor(p.id)}>
              Fill call setup
            </Button>
          </Gate>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Enroll" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.bucket} value={s.bucket} className="px-3 py-1">
              {s.title}
              <ToneBadge tone="neutral" className="h-5 min-w-5 px-1.5 tabular-nums">
                {by(s.bucket).length}
              </ToneBadge>
            </TabsTrigger>
          ))}
        </TabsList>
        {SECTIONS.map((s) => {
          const list = by(s.bucket);
          const actionable = s.bucket === 'awaiting_confirmation' || s.bucket === 'needs_consent' || s.bucket === 'needs_setup';
          return (
            <TabsContent key={s.bucket} value={s.bucket}>
              <Card className="gap-0 overflow-hidden py-0">
                <CardContent className="p-0">
                  {!list.length ? (
                    <EmptyState icon={<UserPlus />} title="Nobody here" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className={EDGE}>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-muted-foreground">Patient</TableHead>
                            <TableHead className="text-muted-foreground">Conditions</TableHead>
                            <TableHead className="text-muted-foreground">Coverage</TableHead>
                            <TableHead className="text-muted-foreground">Last visit</TableHead>
                            <TableHead className="text-muted-foreground">
                              {s.bucket === 'needs_setup' ? (
                                'Consent'
                              ) : s.bucket === 'awaiting_confirmation' ? (
                                <span className="inline-flex items-center gap-1.5">
                                  Status
                                  <InfoTip>Flagged: 2+ qualifying codes, traditional Medicare, visit within 12 months</InfoTip>
                                </span>
                              ) : (
                                'Status'
                              )}
                            </TableHead>
                            {actionable && (
                              <TableHead>
                                <span className="sr-only">Action</span>
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <a href={`#/patient/${p.id}`} className="font-medium hover:underline">
                                  {p.name}
                                </a>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-mono">{p.mrn}</span> · {p.age}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{p.codes.map((c) => c.code).join(', ') || '—'}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1.5">
                                  {p.coverage === 'traditional' ? 'Traditional' : 'Medicare Advantage'}
                                  {p.is_qmb && <ToneBadge tone="info">QMB</ToneBadge>}
                                </span>
                              </TableCell>
                              <TableCell className="tabular-nums">{fmtDate(p.last_visit_date)}</TableCell>
                              <TableCell>
                                {s.bucket === 'needs_setup' && p.consent ? (
                                  <>
                                    {p.consent.method === 'at_visit' ? 'At visit' : 'Nurse phone'}, {fmtDate(p.consent.consent_date)}
                                    <div className="text-xs text-muted-foreground">Automated calls {p.consent.automated_calls_ok ? 'OK' : 'not OK'}</div>
                                  </>
                                ) : (
                                  <>
                                    <StatusBadge status={p.status} />
                                    {!actionable && p.ineligible_reason && <div className="mt-1 text-xs text-muted-foreground">{p.ineligible_reason}</div>}
                                  </>
                                )}
                              </TableCell>
                              {actionable && <TableCell className="text-right">{action(p)}</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
      {consentFor != null && <ConsentModal patientId={consentFor} onClose={() => setConsentFor(null)} />}
      {setupFor != null && <SetupModal patientId={setupFor} onClose={() => setSetupFor(null)} />}
    </div>
  );
}
