import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Loader2, Egg, ArrowLeft, Tag } from 'lucide-react';
import VisitorWelcomePopup from '@/components/VisitorWelcomePopup';

const categoryLabels: Record<string, string> = {
  guide: 'Guide', recension: 'Recension', tips: 'Tips & tricks', halsa: 'Hälsa',
  nyborjare: 'Nybörjare', raser: 'Raser', tradgard: 'Trädgård & odling', hem: 'Hem & hållbarhet', friluftsliv: 'Friluftsliv & natur',
};

export default function BlogTag() {
  const { tag } = useParams<{ tag: string }>();
  const decodedTag = decodeURIComponent(tag || '');
  const displayTag = decodedTag.charAt(0).toUpperCase() + decodedTag.slice(1);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts-tag', tag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, feature_image_url, category, tags, published_at, reading_time_minutes')
        .eq('is_published', true)
        .contains('tags', [decodedTag])
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tag,
  });

  // Noindex om taggen saknar artiklar (när laddningen är klar) eller är tom
  const isEmpty = !isLoading && posts.length === 0;
  const shouldNoindex = !decodedTag || isEmpty;

  useSeo({
    title: `${displayTag} – Artiklar om ${decodedTag} | Hönsgården`,
    description: `Läs alla artiklar om ${decodedTag}. Tips, guider och information från Hönsgården – Sveriges bästa resurs för hönsägare.`,
    path: `/blogg/tagg/${tag}`,
    ogImage: '/blog-images/hens-garden.jpg',
    ogImageAlt: displayTag,
    noindex: shouldNoindex,
    jsonLd: shouldNoindex ? undefined : [
      {
        '@type': 'CollectionPage',
        '@id': `https://honsgarden.se/blogg/tagg/${tag}`,
        name: displayTag,
        description: `Artiklar taggade med ${decodedTag}`,
        url: `https://honsgarden.se/blogg/tagg/${tag}`,
        isPartOf: { '@id': 'https://honsgarden.se/#website' },
        inLanguage: 'sv-SE',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se' },
          { '@type': 'ListItem', position: 2, name: 'Blogg', item: 'https://honsgarden.se/blogg' },
          { '@type': 'ListItem', position: 3, name: displayTag, item: `https://honsgarden.se/blogg/tagg/${tag}` },
        ],
      },
    ],
  });

  // Fetch all unique tags for navigation
  const { data: allTags = [] } = useQuery({
    queryKey: ['all-blog-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('tags')
        .eq('is_published', true);
      if (error) throw error;
      const tagSet = new Set<string>();
      data?.forEach(p => p.tags?.forEach((t: string) => tagSet.add(t)));
      return Array.from(tagSet).sort();
    },
  });

  return (
    <div className="min-h-dvh bg-background">
      <VisitorWelcomePopup />

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
        <div className="text-center mb-8">
          <Link to="/blogg" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-3 w-3" /> Tillbaka till bloggen
          </Link>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Tag className="h-5 w-5 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-serif text-foreground">{displayTag}</h1>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            {posts.length} {posts.length === 1 ? 'artikel' : 'artiklar'} taggade med "{decodedTag}"
          </p>
        </div>

        {/* Tag cloud navigation */}
        {allTags.length > 0 && (
          <nav aria-label="Taggar" className="flex flex-wrap justify-center gap-2 mb-10">
            {allTags.slice(0, 30).map(t => (
              <Link key={t} to={`/blogg/tagg/${encodeURIComponent(t)}`}>
                <Badge variant={t === decodedTag ? 'default' : 'secondary'} className="cursor-pointer text-xs">
                  {t}
                </Badge>
              </Link>
            ))}
          </nav>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !posts.length ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Inga artiklar med denna tagg ännu.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link key={post.id} to={`/blogg/${post.slug}`} className="group">
                <Card className="border-border/50 overflow-hidden hover:shadow-md transition-all duration-300 h-full">
                  {(post.feature_image_url || post.cover_image_url) ? (
                    <div className="aspect-video overflow-hidden">
                      <img src={post.feature_image_url || post.cover_image_url || ''} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
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
                    <h2 className="font-serif text-lg text-foreground leading-snug group-hover:text-primary transition-colors">{post.title}</h2>
                    {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>}
                    <span className="inline-flex items-center text-xs font-medium text-primary gap-1 pt-1">
                      Läs mer <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-16 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-8 sm:p-12 border border-border/30">
          <span className="text-3xl mb-3 block">🥚</span>
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">Håll koll på dina höns – helt gratis</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">Med Hönsgården loggar du ägg, hälsa och foder på ett ställe.</p>
          <Link to="/login"><Button size="lg" className="rounded-xl gap-2"><Egg className="h-4 w-4" /> Skapa ett konto</Button></Link>
        </div>
      </main>

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
