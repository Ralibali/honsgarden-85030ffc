import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Loader2, Egg, ArrowLeft } from 'lucide-react';
import VisitorWelcomePopup from '@/components/VisitorWelcomePopup';

const categoryMeta: Record<string, { label: string; title: string; description: string; ogImage: string }> = {
  guide: {
    label: 'Guider',
    title: 'Guider om höns – Allt du behöver veta som hönsägare | Hönsgården',
    description: 'Kompletta guider om höns – från att bygga hönshus till att välja rätt ras. Steg-för-steg-instruktioner för nybörjare och erfarna hönsägare.',
    ogImage: '/blog-images/chicken-coop.jpg',
  },
  recension: {
    label: 'Recensioner',
    title: 'Produktrecensioner för hönsägare – Testat & granskat | Hönsgården',
    description: 'Ärliga recensioner av produkter för hönsägare. Vi testar hönshus, foder, värmelampor, äggkläckare och mer – så du slipper gissa.',
    ogImage: '/blog-images/feed-varieties.jpg',
  },
  tips: {
    label: 'Tips & tricks',
    title: 'Tips & tricks för hönsägare – Smarta knep för hönsgården | Hönsgården',
    description: 'Praktiska tips och smarta knep för att sköta dina höns bättre. Spara tid, pengar och håll flocken frisk.',
    ogImage: '/blog-images/hens-feeding.jpg',
  },
  halsa: {
    label: 'Hälsa',
    title: 'Hönshälsa – Sjukdomar, behandling & förebyggande | Hönsgården',
    description: 'Allt om hönshälsa: vanliga sjukdomar, symptom, behandling och förebyggande åtgärder. Håll din flock frisk och glad.',
    ogImage: '/blog-images/hen-health-check.jpg',
  },
  nyborjare: {
    label: 'Nybörjare',
    title: 'Börja med höns – Komplett nybörjarguide | Hönsgården',
    description: 'Ska du skaffa höns? Här hittar du allt en nybörjare behöver veta – från val av ras till bygge av hönshus och daglig skötsel.',
    ogImage: '/blog-images/baby-chicks.jpg',
  },
  raser: {
    label: 'Raser',
    title: 'Hönsraser i Sverige – Jämförelser & guider | Hönsgården',
    description: 'Jämför hönsraser för svenskt klimat: värpning, temperament, vinterhärdighet och pris för hobbyhönsägare.',
    ogImage: '/blog-images/chicken-breeds.jpg',
  },
  tradgard: {
    label: 'Trädgård & odling',
    title: 'Trädgård & odling – Tips för självhushåll | Hönsgården',
    description: 'Odla grönsaker, kompostera med höns och skapa en produktiv trädgård. Guider för dig som kombinerar höns med odling.',
    ogImage: '/blog-images/spring-garden.jpg',
  },
  hem: {
    label: 'Hem & hållbarhet',
    title: 'Hem & hållbarhet – Hållbart boende med höns | Hönsgården',
    description: 'Tips för ett hållbart hem med höns. Kompostering, självhushåll och smarta lösningar för den miljömedvetna hönsägaren.',
    ogImage: '/blog-images/farm-kitchen.jpg',
  },
  friluftsliv: {
    label: 'Friluftsliv & natur',
    title: 'Friluftsliv & natur – Utomhuslivet med höns | Hönsgården',
    description: 'Friluftsliv, naturupplevelser och livet utomhus. Guider för dig som älskar naturen och lantlivet.',
    ogImage: '/blog-images/sunset-farm.jpg',
  },
};

const categoryLabels: Record<string, string> = {
  guide: 'Guide', recension: 'Recension', tips: 'Tips & tricks', halsa: 'Hälsa',
  nyborjare: 'Nybörjare', raser: 'Raser', tradgard: 'Trädgård & odling', hem: 'Hem & hållbarhet', friluftsliv: 'Friluftsliv & natur',
};

export default function BlogCategory() {
  const { category } = useParams<{ category: string }>();
  const meta = categoryMeta[category || ''];

  useSeo({
    title: meta?.title || `Kategorin hittades inte | Hönsgården`,
    description: meta?.description || 'Den här kategorin finns inte. Återgå till bloggen.',
    path: `/blogg/kategori/${category}`,
    ogImage: meta?.ogImage,
    ogImageAlt: meta?.label,
    noindex: !meta,
    jsonLd: !meta ? undefined : [
      {
        '@type': 'CollectionPage',
        '@id': `https://honsgarden.se/blogg/kategori/${category}`,
        name: meta?.label || category,
        description: meta?.description || '',
        url: `https://honsgarden.se/blogg/kategori/${category}`,
        isPartOf: { '@id': 'https://honsgarden.se/#website' },
        inLanguage: 'sv-SE',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se' },
          { '@type': 'ListItem', position: 2, name: 'Blogg', item: 'https://honsgarden.se/blogg' },
          { '@type': 'ListItem', position: 3, name: meta?.label || category, item: `https://honsgarden.se/blogg/kategori/${category}` },
        ],
      },
    ],
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts-category', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, feature_image_url, category, tags, published_at, reading_time_minutes')
        .eq('is_published', true)
        .eq('category', category!)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!category,
  });

  if (!meta) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-4">
        <BookOpen className="h-10 w-10 text-muted-foreground/30" />
        <h1 className="font-serif text-xl text-foreground">Kategorin hittades inte</h1>
        <Link to="/blogg"><Button variant="outline" className="rounded-xl"><ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka till bloggen</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <VisitorWelcomePopup />

      {/* ItemList JSON-LD */}
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: posts.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `https://honsgarden.se/blogg/${p.slug}`,
                name: p.title,
              })),
            }),
          }}
        />
      )}

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg text-foreground">Hönsgården</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/blogg">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <BookOpen className="h-3 w-3" /> Alla inlägg
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="rounded-xl text-xs gap-1">
                <Egg className="h-3 w-3" /> Kom igång
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-8">
          <Link to="/blogg" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-3 w-3" /> Tillbaka till bloggen
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif text-foreground mb-3">
            {meta.label}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            {meta.description}
          </p>
        </div>

        {/* Category navigation */}
        <nav aria-label="Kategorier" className="flex flex-wrap justify-center gap-2 mb-10">
          {Object.entries(categoryMeta).map(([key, val]) => (
            <Link key={key} to={`/blogg/kategori/${key}`}>
              <Badge
                variant={key === category ? 'default' : 'secondary'}
                className="cursor-pointer text-xs"
              >
                {val.label}
              </Badge>
            </Link>
          ))}
        </nav>

        {/* Posts */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !posts.length ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Inga inlägg i denna kategori ännu.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link key={post.id} to={`/blogg/${post.slug}`} className="group">
                <Card className="border-border/50 overflow-hidden hover:shadow-md transition-all duration-300 h-full">
                  {(post.feature_image_url || post.cover_image_url) ? (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.feature_image_url || post.cover_image_url || ''}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/8 to-accent/8 flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[9px]">
                        {categoryLabels[post.category || ''] || post.category}
                      </Badge>
                      {post.published_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(post.published_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {post.reading_time_minutes && <span className="text-[10px] text-muted-foreground">{post.reading_time_minutes} min</span>}
                    </div>
                    <h2 className="font-serif text-lg text-foreground leading-snug group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    )}
                    <span className="inline-flex items-center text-xs font-medium text-primary gap-1 pt-1">
                      Läs mer <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-8 sm:p-12 border border-border/30">
          <span className="text-3xl mb-3 block">🥚</span>
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
            Håll koll på dina höns – helt gratis
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Med Hönsgården loggar du ägg, hälsa och foder på ett ställe.
          </p>
          <Link to="/login">
            <Button size="lg" className="rounded-xl gap-2">
              <Egg className="h-4 w-4" /> Skapa ett konto
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Hönsgården</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Startsidan</Link>
            <Link to="/blogg" className="hover:text-foreground transition-colors">Blogg</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Villkor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
