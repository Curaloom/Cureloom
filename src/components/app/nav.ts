import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, FileText, History, ListTodo, PhoneCall, Receipt, Send, Signature, Upload, UserPlus, Users } from 'lucide-react';
import type { Role } from '../../../shared/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ITEM = {
  queue: { to: 'queue', label: 'Today queue', icon: ListTodo },
  enroll: { to: 'enroll', label: 'Enroll', icon: UserPlus },
  patients: { to: 'patients', label: 'All patients', icon: Users },
  monthEnd: { to: 'month-end', label: 'Month end', icon: FileText },
  attestation: { to: 'attestation', label: 'Attestation', icon: Signature },
  billing: { to: 'billing', label: 'Billing reconciliation', icon: Receipt },
  roster: { to: 'roster', label: 'Roster & opportunity', icon: Upload },
  physician: { to: 'physician', label: 'Care plans & escalations', icon: ClipboardCheck },
} satisfies Record<string, NavItem>;

export const NAV: Record<Role, NavItem[]> = {
  nurse: [ITEM.queue, ITEM.enroll, ITEM.patients, ITEM.monthEnd],
  physician: [ITEM.physician, ITEM.attestation, ITEM.patients, ITEM.billing],
  manager: [ITEM.roster, ITEM.billing, ITEM.enroll, ITEM.patients],
};

export const TOOLS: NavItem[] = [
  { to: 'simulator', label: 'Call simulator', icon: PhoneCall },
  { to: 'events', label: 'Audit trail', icon: History },
  { to: 'outbox', label: 'Outbox', icon: Send },
];

export const HOME: Record<Role, string> = { nurse: 'queue', physician: 'physician', manager: 'roster' };

export const ROLES: Role[] = ['nurse', 'physician', 'manager'];

const TITLES: Record<string, string> = {
  ...Object.fromEntries([...Object.values(ITEM), ...TOOLS].map((n) => [n.to, n.label])),
  patient: 'Patient',
  call: 'Call',
};

/** The header title for the first route segment. */
export function pageTitle(screen: string): string {
  return TITLES[screen] ?? '';
}
