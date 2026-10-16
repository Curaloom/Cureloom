import { useState } from 'react';
import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { AppToast } from '@/components/app/app-toast';
import { EmptyState } from '@/components/app/empty-state';
import { HOME, pageTitle } from '@/components/app/nav';
import { SimulationPanel } from '@/components/app/simulation-panel';
import { UrgentAlerts } from '@/components/app/urgent-alerts';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRoute } from './router';
import { Attestation } from './screens/Attestation';
import { Billing } from './screens/Billing';
import { Enroll } from './screens/Enroll';
import { Events } from './screens/Events';
import { MonthEnd } from './screens/MonthEnd';
import { NurseCall } from './screens/NurseCall';
import { Outbox } from './screens/Outbox';
import { PatientMonth } from './screens/PatientMonth';
import { Patients } from './screens/Patients';
import { Queue } from './screens/Queue';
import { Roster } from './screens/Roster';
import { Simulator } from './screens/Simulator';
import { useStore, useStoreMaybe } from './store';

export function App() {
  const store = useStoreMaybe();
  if (!store?.state) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }
  return <Shell />;
}

/** The sidebar remembers being collapsed (sidebar.tsx writes the cookie). */
function sidebarStartsOpen(): boolean {
  return !document.cookie.split('; ').includes('sidebar_state=false');
}

function Shell() {
  const { role } = useStore();
  const route = useRoute();
  const [simOpen, setSimOpen] = useState(false);
  const [screen, ...rest] = route.path;
  const current = screen ?? HOME[role];
  let body;
  switch (current) {
    case 'queue':
      body = <Queue />;
      break;
    case 'roster':
      body = <Roster />;
      break;
    case 'enroll':
      body = <Enroll />;
      break;
    case 'patients':
      body = <Patients />;
      break;
    case 'patient':
      body = <PatientMonth id={Number(rest[0])} />;
      break;
    case 'call':
      body = <NurseCall callId={Number(rest[0])} />;
      break;
    case 'simulator':
      body = <Simulator />;
      break;
    case 'month-end':
      body = <MonthEnd selected={rest[0] ? Number(rest[0]) : null} />;
      break;
    case 'attestation':
      body = <Attestation />;
      break;
    case 'billing':
      body = <Billing />;
      break;
    case 'events':
      body = <Events patientId={route.query.get('patient') ? Number(route.query.get('patient')) : null} />;
      break;
    case 'outbox':
      body = <Outbox />;
      break;
    default:
      body = <EmptyState title="Page not found" />;
  }
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarStartsOpen()}>
        <AppSidebar current={current} />
        {/* min-w-0 lets wide content (tables, one-row alerts) shrink or scroll instead of widening the page. */}
        <SidebarInset className="min-w-0">
          <AppHeader
            title={pageTitle(current)}
            timerHideFor={current === 'patient' ? Number(rest[0]) : current === 'call' ? -1 : null}
            onOpenSimulation={() => setSimOpen(true)}
          />
          <div className="flex-1 p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
              <UrgentAlerts />
              {body}
            </div>
          </div>
        </SidebarInset>
        <SimulationPanel open={simOpen} onOpenChange={setSimOpen} />
        <AppToast />
      </SidebarProvider>
    </TooltipProvider>
  );
}
