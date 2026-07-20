import { useState, useEffect } from 'react';
import {
  Home, Egg, Bird, Coins, BarChart3, Settings, LogOut, Package, Syringe,
  ClipboardCheck, Crown, Shield, Feather, Bot, CalendarDays, Users,
  ReceiptText, Newspaper, CloudSun, Stethoscope, Heart, Boxes, FileText, Tag,
  ChevronDown, Sun, Moon, PieChart, ShoppingBag,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { brandName } from '@/lib/brand';
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

type NavItem = { titleKey: string; url: string; icon: any; premium?: boolean; adminOnly?: boolean };
type NavGroup = { labelKey: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    labelKey: 'groups.daily',
    items: [
      { titleKey: 'dashboard', url: '/app', icon: Home },
      { titleKey: 'log_eggs', url: '/app/eggs', icon: Egg },
      { titleKey: 'tasks', url: '/app/tasks', icon: ClipboardCheck },
      { titleKey: 'reminders', url: '/app/reminders', icon: Syringe },
      { titleKey: 'calendar', url: '/app/calendar', icon: CalendarDays },
    ],
  },
  {
    labelKey: 'groups.flock',
    items: [
      { titleKey: 'hens', url: '/app/hens', icon: Bird },
      { titleKey: 'health_log', url: '/app/halsa', icon: Stethoscope },
      { titleKey: 'breeding', url: '/app/avel', icon: Heart, premium: true },
      { titleKey: 'weather', url: '/app/weather', icon: CloudSun, premium: true },
    ],
  },
  {
    labelKey: 'groups.economy',
    items: [
      { titleKey: 'feed', url: '/app/feed', icon: Package, premium: true },
      { titleKey: 'inventory', url: '/app/lager', icon: Boxes, premium: true },
      { titleKey: 'finance', url: '/app/finance', icon: Coins, premium: true },
      { titleKey: 'marketplace', url: '/app/marknad/mina', icon: Tag },
      { titleKey: 'agda_shop', url: '/app/egg-sales', icon: ReceiptText, premium: true },
    ],
  },
  {
    labelKey: 'groups.insights',
    items: [
      { titleKey: 'overview', url: '/app/overview', icon: PieChart },
      { titleKey: 'statistics', url: '/app/statistics', icon: BarChart3, premium: true },
      { titleKey: 'reports', url: '/app/rapporter', icon: FileText, premium: true },
      { titleKey: 'agda_ai', url: '/app/agda', icon: Bot, premium: true },
      { titleKey: 'news', url: '/app/news', icon: Newspaper },
    ],
  },
  {
    labelKey: 'groups.other',
    items: [
      { titleKey: 'community', url: '/app/community', icon: Users },
      { titleKey: 'premium', url: '/app/premium', icon: Crown },
      { titleKey: 'settings', url: '/app/settings', icon: Settings },
      { titleKey: 'butik', url: '/app/butik', icon: ShoppingBag, adminOnly: true },
      { titleKey: 'admin', url: '/app/admin', icon: Shield, adminOnly: true },
    ],
  },
];


function groupKey(label: string) {
  return `sidebar_group_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

const MIGRATION_FLAG = 'sidebar_groups_migrated_v2';

// One-time reset: tidigare användare kan ha "Insikter" kollapsad och tro
// att Statistik försvunnit. Återställ till öppen en gång.
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG) !== '1') {
      if (window.localStorage.getItem('sidebar_group_insikter') === '0') {
        window.localStorage.removeItem('sidebar_group_insikter');
      }
      window.localStorage.setItem(MIGRATION_FLAG, '1');
    }
  } catch {
    /* ignore */
  }
}

function NavGroupCollapsible({
  labelKey, label, items, collapsed, isPremium, isAdmin, forceOpen,
}: { labelKey: string; label: string; items: NavItem[]; collapsed: boolean; isPremium: boolean; isAdmin: boolean; forceOpen: boolean }) {
  const { t } = useTranslation('nav');
  const storageKey = groupKey(labelKey);
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
        <SidebarMenuItem key={item.titleKey}>
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
                  {t(item.titleKey)}
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
            aria-expanded={open}
            title={open ? t('sidebar.hide_group', { label }) : t('sidebar.show_group', { label, count: visible.length })}
          >
            <SidebarGroupLabel className="p-0 m-0 h-auto text-inherit tracking-inherit">
              {label}
            </SidebarGroupLabel>
            <span className="flex items-center gap-1.5">
              {!open && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold leading-none"
                  aria-label={t('sidebar.hidden_count', { count: visible.length })}
                >
                  {visible.length}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
            </span>
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
  const { t } = useTranslation('nav');
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
              <h1 className="font-serif text-lg text-foreground leading-none">{brandName()}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('sidebar.tagline')}</p>
            </div>
          )}
        </div>

        {groups.map((g) => {
          const groupActive = g.items.some(
            (item) => item.url === pathname || (item.url !== '/app' && pathname.startsWith(item.url)),
          );
          return (
            <NavGroupCollapsible
              key={g.labelKey}
              labelKey={g.labelKey}
              label={t(g.labelKey)}
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
                <p className="text-sm font-medium text-foreground truncate">{user?.name || t('sidebar.user_fallback')}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? t('sidebar.theme_light') : t('sidebar.theme_dark')}
                title={theme === 'dark' ? t('sidebar.theme_light_short') : t('sidebar.theme_dark_short')}
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
              {t('sign_out')}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 mx-auto rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t('sidebar.theme_light') : t('sidebar.theme_dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

        )}
      </SidebarFooter>
    </Sidebar>
  );
}
