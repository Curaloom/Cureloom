import { ChevronsUpDown, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { initials } from '@/lib/format';
import { go } from '@/router';
import { useStore } from '@/store';
import { HOME, NAV, ROLES, TOOLS, type NavItem } from './nav';

export function AppSidebar({ current }: { current: string }) {
  const { state, role } = useStore();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  const items = (list: NavItem[]) =>
    list.map((n) => (
      <SidebarMenuItem key={n.to}>
        <SidebarMenuButton asChild isActive={current === n.to} tooltip={n.label}>
          <a href={`#/${n.to}`} onClick={closeOnMobile}>
            <n.icon />
            <span>{n.label}</span>
          </a>
        </SidebarMenuButton>
        {n.to === 'outbox' && state.counts.outbox > 0 && <SidebarMenuBadge>{state.counts.outbox}</SidebarMenuBadge>}
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={`#/${HOME[role]}`} onClick={closeOnMobile}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Plus className="size-5" strokeWidth={3} />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Cureloom</span>
                  <span className="truncate text-xs text-muted-foreground">{state.practice.name}</span>
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{items(NAV[role])}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{items(TOOLS)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserMenu() {
  const { state, role, setRole } = useStore();
  const { isMobile } = useSidebar();
  const me = state.staff[role];

  const switchTo = (value: string) => {
    const r = ROLES.find((x) => x === value);
    if (!r || r === role) return;
    setRole(r);
    go(`/${HOME[r]}`);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <StaffAvatar name={me.name} />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">{me.name}</span>
                <span className="truncate text-xs text-muted-foreground">{me.title}</span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
          >
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch role</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role} onValueChange={switchTo}>
              {ROLES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r} className="gap-2 py-1.5">
                  <StaffAvatar name={state.staff[r].name} small />
                  <span className="grid leading-tight">
                    <span className="truncate">{state.staff[r].name}</span>
                    <span className="truncate text-xs text-muted-foreground">{state.staff[r].title}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function StaffAvatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <Avatar size={small ? 'sm' : 'default'} className="rounded-lg">
      <AvatarFallback className="rounded-lg bg-primary/10 font-medium text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
