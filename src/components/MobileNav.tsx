import {
  Home,
  Egg,
  Bird,
  BarChart3,
  MoreHorizontal,
  Package,
  Syringe,
  Baby,
  Coins,
  Settings,
  Crown,
  Shield,
  Bot,
  PieChart,
  ClipboardCheck,
  CalendarDays,
  Upload,
  ReceiptText,
  Users,
  Newspaper,
  CloudSun,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const primaryItems = [
  { title: 'Hem', url: '/app', icon: Home },
  { title: 'Logga', url: '/app/eggs', icon: Egg },
  { title: 'Hönor', url: '/app/hens', icon: Bird },
  { title: 'Statistik', url: '/app/statistics', icon: BarChart3 },
  { title: 'Mer', url: '#more', icon: MoreHorizontal },
];

const moreGroups = [
  {
    label: 'Dagligt',
    items: [
      { title: 'Dashboard', url: '/app', icon: Home },
      { title: 'Smart rapport', url: '/app/smart-report', icon: Sparkles, premium: true },
      { title: 'Logga ägg', url: '/app/eggs', icon: Egg },
      { title: 'Uppgifter', url: '/app/tasks', icon: ClipboardCheck },
      { title: 'Påminnelser', url: '/app/reminders', icon: Syringe },
    ],
  },
  {
    label: 'Flocken',
    items: [
      { title: 'Hönor', url: '/app/hens', icon: Bird },
      { title: 'Kläckning', url: '/app/hatching', icon: Baby, premium: true },
      { title: 'Kalender', url: '/app/calendar', icon: CalendarDays },
      { title: 'Väder & råd', url: '/app/weather', icon: CloudSun, premium: true },
      { title: 'Översikt', url: '/app/overview', icon: PieChart, premium: true },
    ],
  },
  {
    label: 'Ekonomi',
    items: [
      { title: 'Foder', url: '/app/feed', icon: Package, premium: true },
      { title: 'Ekonomi', url: '/app/finance', icon: Coins, premium: true },
      { title: 'Agdas Bod', url: '/app/egg-sales', icon: ReceiptText, premium: true },
      { title: 'Statistik', url: '/app/statistics', icon: BarChart3, premium: true },
    ],
  },
  {
    label: 'Mer',
    items: [
      { title: 'Nyheter', url: '/app/news', icon: Newspaper },
      { title: 'Agda AI', url: '/app/agda', icon: Bot, premium: true },
      { title: 'Community', url: '/app/community', icon: Users },
      { title: 'Premium', url: '/app/premium', icon: Crown },
      { title: 'Importera data', url: '/app/import', icon: Upload },
      { title: 'Feedback', url: '/app/feedback', icon: MessageCircle },
      { title: 'Inställningar', url: '/app/settings', icon: Settings },
    ],
  },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const isPremium = user?.subscription_status === 'premium';

  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user?.id]);

  const groups = isAdmin
    ? [...moreGroups, { label: 'Admin', items: [{ title: 'Admin', url: '/app/admin', icon: Shield }] }]
    : moreGroups;

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-foreground/15 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-2 right-2 bg-card border border-border/60 rounded-2xl p-3 pb-safe-bottom-4 shadow-xl animate-fade-in-scale max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium">{group.label}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.url}
                        to={item.url}
                        end={item.url === '/app'}
                        className="relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-[0.95]"
                        activeClassName="text-primary bg-primary/8"
                        onClick={() => setShowMore(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center leading-tight">{item.title}</span>
                        {item.premium && !isPremium && <Crown className="absolute top-2 right-2 h-3 w-3 text-warning/70" />}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-xl border-t border-border/50 pb-safe-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => (
            item.url === '#more' ? (
              <button
                key="more"
                onClick={() => setShowMore(!showMore)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-0 ${showMore ? 'text-primary bg-primary/8' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium truncate">{item.title}</span>
              </button>
            ) : (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === '/app'}
                className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl text-muted-foreground hover:text-foreground transition-all min-w-0"
                activeClassName="text-primary"
                onClick={() => setShowMore(false)}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium truncate">{item.title}</span>
              </NavLink>
            )
          ))}
        </div>
      </nav>
    </>
  );
}
