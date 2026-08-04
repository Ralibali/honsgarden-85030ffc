import BlogConversionPopup from '@/components/blog/BlogConversionPopup';
import NewsletterSignup from '@/components/NewsletterSignup';
import { useSeo } from '@/hooks/useSeo';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Loader2, Egg } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  guide: 'Guide',
  recension: 'Recension',
  tips: 'Tips & tricks',
  halsa: 'Hälsa',
  nyborjare: 'Nybörjare',
  raser: 'Raser',
  tradgard: 'Trädgård & odling',
  hem: 'Hem & hållbarhet',
  friluftsliv: 'Friluftsliv & natur',
};

export default function Guides() {
  useSeo({
    title: 'Blogg om höns – Guider, recensioner & tips | Hönsgården',
    description: 'Expertguider, produktrecensioner och tips om höns, hönshus, foder och hälsa. Allt du behöver veta som hönsägare – testat och granskat av Hönsgården.',
    path: '/blogg',
    ogImage: '/blog-images/hens-garden.jpg',
    ogImageAlt: 'Höns i en vacker trädgård – Hönsgårdens blogg',
    jsonLd: [
      {
        '@type': 'CollectionPage',
        '@id': 'https://honsgarden.se/blogg',
        name: 'Bloggen – Guider, recensioner & tips om höns',
        description: 'Expertguider, produktrecensioner och tips om höns, hönshus, foder och hälsa.',
        url: 'https://honsgarden.se/blogg',
        isPartOf: { '@id': 'https://honsgarden.se/#website' },
        inLanguage: 'sv-SE',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se' },
          { '@type': 'ListItem', position: 2, name: 'Blogg', item: 'https://honsgarden.se/blogg' },
        ],
      },
    ],
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['public-blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, feature_image_url, category, tags, published_at, reading_time_minutes')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-dvh bg-background">
      <BlogConversionPopup />

      {/* ItemList JSON-LD for blog listing */}
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
          <Link to="/login">
            <Button size="sm" className="rounded-xl text-xs gap-1">
              <Egg className="h-3 w-3" /> Kom igång
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
            <BookOpen className="h-3.5 w-3.5" /> Bloggen
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-foreground mb-3">
            Höns, hem, trädgård & friluftsliv
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Guider, recensioner och tips för dig som älskar höns, hemmet, trädgården och livet utomhus. Vi testar produkter och delar med oss av vår kunskap.
          </p>
        </div>

        {/* Category navigation */}
        <nav aria-label="Kategorier" className="flex flex-wrap justify-center gap-2 mb-10">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <Link key={key} to={`/blogg/kategori/${key}`}>
              <Badge variant="secondary" className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-colors">
                {label}
              </Badge>
            </Link>
          ))}
        </nav>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !posts.length ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Inga guider publicerade ännu. Kom tillbaka snart!</p>
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
                        width={600}
                        height={338}
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
                      {post.category && (
                        <Badge variant="secondary" className="text-[9px]">
                          {categoryLabels[post.category] || post.category}
                        </Badge>
                      )}
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

        {/* Newsletter */}
        <div className="mt-16">
          <NewsletterSignup
            title="Hönstips i inkorgen — en gång i månaden"
            description="Säsongsråd, nya guider och smarta tips för dig med höns. Inget spam, avsluta när du vill."
          />
        </div>

        {/* CTA */}
        <div className="mt-8 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-8 sm:p-12 border border-border/30">
          <span className="text-3xl mb-3 block">🥚</span>
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
            Håll koll på dina höns – helt gratis
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Med Hönsgården loggar du ägg, hälsa och foder på ett ställe. Perfekt för dig som vill ha full koll på din hönsgård.
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
            <Link to="/om-oss" className="hover:text-foreground transition-colors">Om oss</Link>
            <Link to="/verktyg/aggkalkylator" className="hover:text-foreground transition-colors">Äggkalkylator</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Villkor</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Logga in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
