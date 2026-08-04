import { Card, CardContent } from '@/components/ui/card';
import { Heart, Leaf, Play, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import type { SaleSection } from '@/lib/eggSaleTheme';

const ICONS = { sparkles: Sparkles, leaf: Leaf, heart: Heart, sun: Sun, shield: ShieldCheck };

function ytEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`;
  } catch { return null; }
  return null;
}

export function CustomSectionsRenderer({ sections, accent }: { sections: SaleSection[]; accent?: string }) {
  if (!sections?.length) return null;
  const accentStyle = accent ? { color: accent } : undefined;

  return (
    <div className="space-y-4">
      {sections.map((s) => {
        switch (s.type) {
          case 'about':
          case 'hens':
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  {s.title && <h2 className="font-serif text-xl" style={accentStyle}>{s.title}</h2>}
                  {s.image && <img src={s.image} alt={s.title || ''} className="w-full max-h-72 object-cover rounded-2xl border" loading="lazy" />}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            );

          case 'rich_text':
            return (
              <Card key={s.id}>
                <CardContent className="p-5 space-y-2">
                  {s.title && <h2 className="font-serif text-lg" style={accentStyle}>{s.title}</h2>}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            );

          case 'gallery':
            if (!s.images?.length) return null;
            return (
              <Card key={s.id}>
                <CardContent className="p-5 space-y-3">
                  {s.title && <h2 className="font-serif text-lg" style={accentStyle}>{s.title}</h2>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {s.images.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl border bg-muted">
                        <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

          case 'faq':
            if (!s.items?.length) return null;
            return (
              <Card key={s.id}>
                <CardContent className="p-5 space-y-3">
                  {s.title && <h2 className="font-serif text-lg" style={accentStyle}>{s.title}</h2>}
                  <div className="divide-y divide-border/60">
                    {s.items.map((it, i) => (
                      <details key={i} className="py-2 group">
                        <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-medium text-foreground">
                          <span>{it.q}</span>
                          <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">{it.a}</p>
                      </details>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

          case 'highlight': {
            const Icon = ICONS[s.icon || 'sparkles'] || Sparkles;
            return (
              <Card key={s.id} className="overflow-hidden border-2" style={accent ? { borderColor: `${accent}55` } : undefined}>
                <CardContent className="p-5 flex gap-3 items-start" style={accent ? { backgroundColor: `${accent}10` } : undefined}>
                  <div className="rounded-xl p-2.5 shrink-0" style={accent ? { backgroundColor: `${accent}20`, color: accent } : undefined}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-serif text-lg" style={accentStyle}>{s.title}</h2>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          case 'video': {
            const embed = ytEmbed(s.url);
            return (
              <Card key={s.id}>
                <CardContent className="p-5 space-y-3">
                  {s.title && <h2 className="font-serif text-lg" style={accentStyle}>{s.title}</h2>}
                  {embed ? (
                    <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-black">
                      <iframe src={embed} title={s.title || 'Video'} className="w-full h-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium" style={accentStyle}>
                      <Play className="h-4 w-4" /> Öppna video
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            );
          }
        }
      })}
    </div>
  );
}
