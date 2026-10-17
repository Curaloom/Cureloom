import type { CarePlanContent } from '../../../shared/model';

/** A care plan version as the physician reviews it: program, problems and goals, monitoring, contact and team. */
export function PlanDoc({ c }: { c: CarePlanContent }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{c.tier}</span>
        {c.code && <span className="font-mono text-xs text-muted-foreground">{c.code}</span>}
      </div>
      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground uppercase">Problems and goals</h4>
        <ul className="flex flex-col gap-2">
          {c.problems.map((p) => (
            <li key={p.code}>
              <div className="font-medium">
                <span className="font-mono text-xs">{p.code}</span> {p.name}
              </div>
              <div className="text-xs text-muted-foreground">{p.goals.join(' · ')}</div>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground uppercase">Monitoring</h4>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Readings</dt>
          <dd>{c.monitoring.readings.join(', ') || 'None'}</dd>
          {c.monitoring.targets.length > 0 && (
            <>
              <dt className="text-muted-foreground">Targets</dt>
              <dd>{c.monitoring.targets.join(' · ')}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Symptoms</dt>
          <dd>{c.monitoring.symptoms.join(' · ') || 'None'}</dd>
        </dl>
      </section>
      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground uppercase">Contact and team</h4>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Contact</dt>
          <dd>{c.contact}</dd>
          <dt className="text-muted-foreground">Consent</dt>
          <dd>{c.consent}</dd>
          {c.caregiver && (
            <>
              <dt className="text-muted-foreground">Caregiver</dt>
              <dd>{c.caregiver}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Team</dt>
          <dd>{c.team.join(' · ')}</dd>
        </dl>
      </section>
    </div>
  );
}
