import {
  Home,
  Egg,
  Bird,
  BarChart3,
  MoreHorizontal,
  Package,
  Syringe,
  Coins,
  Settings,
  Shield,
  Bot,
  ClipboardCheck,
  CalendarDays,
  ReceiptText,
  Users,
  Newspaper,
  CloudSun,
  Stethoscope,
  Heart,
  Boxes,
  FileText,
  Tag,
  Sun,
  Moon,
  PieChart,
  ShoppingBag,
  Sparkles,
  X,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';

const primaryItems = [
  { title: 'Idag', url: '/app', icon: Home },
  { title: 'Ägg', url: '/app/eggs', icon: Egg },
  { title: 'Flock', url: '/app/hens', icon: Bird },
  { title: 'Gården', url: '/app/tasks', icon: ClipboardCheck },
  { title: 'Mer', url: '#more', icon: MoreHorizontal },
];

const quickItems = [
  { title: 'Dagbok', subtitle: 'Minnen från gården', url: '/app/dagbok', icon: BookOpen },
  { title: 'Agda', subtitle: 'Fråga om flocken', url: '/app/agda', icon: Bot, premium: true },
  { title: 'Insikter', subtitle: 'Förstå värpningen', url: '/app/statistics', icon: Sparkles, premium: true },
  { title: 'Hälsa', subtitle: 'Din hälsojournal', url: '/app/halsa', icon: Stethoscope },
];

const moreGroups = [
  {
    label: 'Vardagen på gården',
    description: 'Sånt du använder när något händer.',
    items: [
      { title: 'Foder', url: '/app/feed', icon: Package, premium: true },
      { title: 'Påminnelser', url: '/app/reminders', icon: Syringe },
      { title: 'Kalender', url: '/app/calendar', icon: CalendarDays },
      { title: 'Väder & råd', url: '/app/weather', icon: CloudSun, premium: true },
      { title: 'Avel & kläckning', url: '/app/avel', icon: Heart, premium: true },
    ],
  },
  {
    label: 'Sälja & hålla ordning',
    description: 'För äggboden, ekonomin och lagret.',
    items: [
      { title: 'Äggboden', url: '/app/egg-sales', icon: ReceiptText, premium: true },
      { title: 'Ekonomi', url: '/app/finance', icon: Coins, premium: true },
      { title: 'Lager', url: '/app/lager', icon: Boxes, premium: true },
      { title: 'Marknad', url: '/app/marknad/mina', icon: Tag },
    ],
  },
  {
    label: 'När du vill fördjupa dig',
    description: 'Historik, rapporter och längre perspektiv.',
    items: [
      { title: 'Översikt', url: '/app/overview', icon: PieChart },
      { title: 'Rapporter', url: '/app/rapporter', icon: FileText, premium: true },
      { title: 'Nyheter', url: '/app/news', icon: Newspaper },
      { title: 'Community', url: '/app/community', icon: Users },
    ],
  },
  {
    label: 'Din Hönsgården',
    description: 'Konto, Plus och hur appen känns.',
    items: [
      { title: 'Hönsgården Plus', url: '/app/premium', icon: Sparkles },
      { title: 'Inställningar', url: '/app/settings', icon: Settings },
    ],
  },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const isPremium = user?.subscription_status === 'premium';

  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!showMore) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showMore]);

  const groups = isAdmin
    ? [...moreGroups, {
        label: 'Admin',
        description: 'Verktyg för administration.',
        items: [
          { title: 'Butik', url: '/app/butik', icon: ShoppingBag },
          { title: 'Admin', url: '/app/admin', icon: Shield },
        ],
      }]
    : moreGroups;

  return (
    <>
      {showMore && (
        <div className="hg-more-overlay fixed inset-0 z-[70] md:hidden" onClick={() => setShowMore(false)}>
          <div className="hg-more-overlay__backdrop absolute inset-0" />
          <section
            className="hg-more-sheet absolute left-2 right-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-5.5rem)] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            aria-label="Mer i Hönsgården"
          >
            <header className="hg-more-sheet__header">
              <div>
                <p className="hg-more-sheet__eyebrow">Din digitala hönsgård</p>
                <h2 className="font-serif text-2xl text-foreground leading-tight mt-1">Vad vill du göra?</h2>
                <p className="text-xs text-muted-foreground mt-1">Allt finns kvar – bara lite lugnare organiserat.</p>
              </div>
              <button
                type="button"
                className="hg-more-sheet__close"
                onClick={() => setShowMore(false)}
                aria-label="Stäng menyn"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="hg-more-quick grid grid-cols-2 gap-2">
              {quickItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  className="hg-more-quick__item"
                  activeClassName="is-active"
                  onClick={() => setShowMore(false)}
                >
                  <span className="hg-more-quick__icon"><item.icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  {(item as any).premium && !isPremium && <span className="hg-more-plus">Plus</span>}
                </NavLink>
              ))}
            </div>

            <div className="hg-more-groups">
              {groups.map((group) => (
                <section key={group.label} className="hg-more-group">
                  <div className="hg-more-group__heading">
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.description}</p>
                    </div>
                  </div>
                  <div className="hg-more-group__items">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.url}
                        to={item.url}
                        className="hg-more-row"
                        activeClassName="is-active"
                        onClick={() => setShowMore(false)}
                      >
                        <span className="hg-more-row__icon"><item.icon className="h-4 w-4" /></span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-foreground">{item.title}</span>
                        {(item as any).premium && !isPremium && <span className="hg-more-plus">Plus</span>}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/55" />
                      </NavLink>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="hg-more-theme">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="hg-more-theme__button"
              >
                <span className="hg-more-row__icon">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </span>
                <span className="flex-1 text-left">
                  <strong className="block text-sm text-foreground">{theme === 'dark' ? 'Ljust utseende' : 'Mörkt utseende'}</strong>
                  <small className="text-[11px] text-muted-foreground">Byt hur Hönsgården känns på skärmen</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      <nav className="hg-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe-bottom" aria-label="Huvudmeny">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => (
            item.url === '#more' ? (
              <button
                key="more"
                onClick={() => setShowMore(!showMore)}
                className={`hg-bottom-nav__item ${showMore ? 'is-active' : ''}`}
                aria-expanded={showMore}
                aria-label="Visa fler delar av Hönsgården"
              >
                <span className="hg-bottom-nav__icon"><item.icon className="h-5 w-5" /></span>
                <span>{item.title}</span>
              </button>
            ) : (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === '/app'}
                className="hg-bottom-nav__item"
                activeClassName="is-active"
                onClick={() => setShowMore(false)}
              >
                <span className="hg-bottom-nav__icon"><item.icon className="h-5 w-5" /></span>
                <span>{item.title}</span>
              </NavLink>
            )
          ))}
        </div>
      </nav>
    </>
  );
}
