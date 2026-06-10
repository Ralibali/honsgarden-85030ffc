import { useState, useEffect } from 'react';
import {
  Home, Egg, Bird, Coins, BarChart3, Settings, LogOut, Package, Syringe,
  ClipboardCheck, Crown, Shield, Feather, Bot, CalendarDays, Users,
  ReceiptText, Newspaper, CloudSun, Stethoscope, Heart, Boxes, FileText, Tag,
  ChevronDown, Sun, Moon,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type NavItem = { title: string; url: string; icon: any; premium?: boolean; adminOnly?: boolean };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Dagligt',
    items: [
      { title: 'Dashboard', url: '/app', icon: Home },
      { title: 'Logga ägg', url: '/app/eggs', icon: Egg },
      { title: 'Uppgifter', url: '/app/tasks', icon: ClipboardCheck },
      { title: 'Påminnelser', url: '/app/reminders', icon: Syringe },
      { title: 'Kalender', url: '/app/calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Flocken',
    items: [
      { title: 'Hönor', url: '/app/hens', icon: Bird },
      { title: 'Hälsologg', url: '/app/halsa', icon: Stethoscope },
      { title: 'Avel & kläckning', url: '/app/avel', icon: Heart, premium: true },
      { title: 'Väder & råd', url: '/app/weather', icon: CloudSun, premium: true },
    ],
  },
  {
    label: 'Ekonomi & försäljning',
    items: [
      { title: 'Foder', url: '/app/feed', icon: Package, premium: true },
      { title: 'Lager', url: '/app/lager', icon: Boxes, premium: true },
      { title: 'Ekonomi', url: '/app/finance', icon: Coins, premium: true },
      { title: 'Marknad', url: '/app/marknad/mina', icon: Tag },
      { title: 'Agdas Bod', url: '/app/egg-sales', icon: ReceiptText, premium: true },
    ],
  },
  {
    label: 'Insikter',
    items: [
      { title: 'Statistik', url: '/app/statistics', icon: BarChart3, premium: true },
      { title: 'Rapporter', url: '/app/rapporter', icon: FileText, premium: true },
      { title: 'Agda AI', url: '/app/agda', icon: Bot, premium: true },
      { title: 'Nyheter', url: '/app/news', icon: Newspaper },
    ],
  },
  {
    label: 'Övrigt',
    items: [
      { title: 'Community', url: '/app/community', icon: Users },
      { title: 'Premium', url: '/app/premium', icon: Crown },
      { title: 'Inställningar', url: '/app/settings', icon: Settings },
      { title: 'Admin', url: '/app/admin', icon: Shield, adminOnly: true },
    ],
  },
];

function groupKey(label: string) {
  return `sidebar_group_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function NavGroupCollapsible({
  label, items, collapsed, isPremium, isAdmin, forceOpen,
}: { label: string; items: NavItem[]; collapsed: boolean; isPremium: boolean; isAdmin: boolean; forceOpen: boolean }) {
  const storageKey = groupKey(label);
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(storageKey);
    return v === null ? true : v === '1';
  });

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const handleChange = (v: boolean) => {
    setOpen(v);
    try { window.localStorage.setItem(storageKey, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const visible = items.filter(item => !item.adminOnly || isAdmin);
  if (visible.length === 0) return null;

  const renderItems = (
    <SidebarMenu>
      {visible.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === '/app'}
              className="flex items-center gap-3 px-5 py-2 mx-2 rounded-xl text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-all duration-200"
              activeClassName="bg-primary/12 text-primary font-medium shadow-sm"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <span className="text-[13px] flex items-center gap-1.5">
                  {item.title}
                  {item.premium && !isPremium && <Crown className="h-3 w-3 text-warning/60" />}
                </span>
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  if (collapsed) {
    // In icon-collapsed sidebar, no label and no toggle — just icons.
    return (
      <SidebarGroup>
        <SidebarGroupContent>{renderItems}</SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={handleChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em] px-5 mt-3 mb-1 font-medium hover:text-muted-foreground"
          >
            <SidebarGroupLabel className="p-0 m-0 h-auto text-inherit tracking-inherit">
              {label}
            </SidebarGroupLabel>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>{renderItems}</SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const isPremium = user?.subscription_status === 'premium';
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="pt-5">
        <div className="px-5 pb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Feather className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-serif text-lg text-foreground leading-none">Hönsgården</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Din gårdsassistent</p>
            </div>
          )}
        </div>

        {groups.map((g) => {
          const groupActive = g.items.some(
            (item) => item.url === pathname || (item.url !== '/app' && pathname.startsWith(item.url)),
          );
          return (
            <NavGroupCollapsible
              key={g.label}
              label={g.label}
              items={g.items}
              collapsed={collapsed}
              isPremium={!!isPremium}
              isAdmin={isAdmin}
              forceOpen={groupActive}
            />
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2 border-t border-sidebar-border">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Användare'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Byt till ljust tema' : 'Byt till mörkt tema'}
                title={theme === 'dark' ? 'Ljust tema' : 'Mörkt tema'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 rounded-xl h-9"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logga ut
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 mx-auto rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Byt till ljust tema' : 'Byt till mörkt tema'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
