import { useState, useEffect } from 'react';
import { Home, Egg, Bird, Coins, BarChart3, Settings, LogOut, Package, Syringe, Baby, ClipboardCheck, Crown, Shield, Feather, Bot, PieChart, Upload, CalendarDays, Users, ReceiptText, Newspaper, CloudSun, Sparkles } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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

const dailyNav = [
  { title: 'Dashboard', url: '/app', icon: Home },
  { title: 'Smart rapport', url: '/app/smart-report', icon: Sparkles, premium: true },
  { title: 'Logga ägg', url: '/app/eggs', icon: Egg },
  { title: 'Uppgifter', url: '/app/tasks', icon: ClipboardCheck },
  { title: 'Påminnelser', url: '/app/reminders', icon: Syringe },
];

const flockNav = [
  { title: 'Hönor', url: '/app/hens', icon: Bird },
  { title: 'Kläckning', url: '/app/hatching', icon: Baby, premium: true },
  { title: 'Kalender', url: '/app/calendar', icon: CalendarDays },
  { title: 'Väder & råd', url: '/app/weather', icon: CloudSun, premium: true },
  { title: 'Översikt', url: '/app/overview', icon: PieChart, premium: true },
];

const financeNav = [
  { title: 'Foder', url: '/app/feed', icon: Package, premium: true },
  { title: 'Ekonomi', url: '/app/finance', icon: Coins, premium: true },
  { title: 'Agdas Bod', url: '/app/egg-sales', icon: ReceiptText, premium: true },
  { title: 'Statistik', url: '/app/statistics', icon: BarChart3, premium: true },
];

const moreNav = [
  { title: 'Nyheter', url: '/app/news', icon: Newspaper },
  { title: 'Agda AI', url: '/app/agda', icon: Bot, premium: true },
  { title: 'Community', url: '/app/community', icon: Users },
  { title: 'Premium', url: '/app/premium', icon: Crown },
  { title: 'Importera data', url: '/app/import', icon: Upload },
  { title: 'Inställningar', url: '/app/settings', icon: Settings },
  { title: 'Admin', url: '/app/admin', icon: Shield, adminOnly: true },
];

function NavGroup({ label, items, collapsed, isPremium, isAdmin }: { label: string; items: any[]; collapsed: boolean; isPremium: boolean; isAdmin: boolean }) {
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em] px-5 mt-3 mb-1 font-medium">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.filter(item => !item.adminOnly || isAdmin).map((item) => (
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
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

        <NavGroup label="Dagligt" items={dailyNav} collapsed={collapsed} isPremium={!!isPremium} isAdmin={isAdmin} />
        <NavGroup label="Flocken" items={flockNav} collapsed={collapsed} isPremium={!!isPremium} isAdmin={isAdmin} />
        <NavGroup label="Ekonomi" items={financeNav} collapsed={collapsed} isPremium={!!isPremium} isAdmin={isAdmin} />
        <NavGroup label="Mer" items={moreNav} collapsed={collapsed} isPremium={!!isPremium} isAdmin={isAdmin} />
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2 border-t border-sidebar-border">
        {!collapsed && (
          <>
            <div className="px-1">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Användare'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
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
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
