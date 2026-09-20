import { useState } from 'react';
import { Bot, ExternalLink, Loader2, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Recommendation = {
  id: string;
  external_id: string | null;
  name: string;
  category: string | null;
  description: string | null;
  price: string | null;
  currency: string;
  in_stock: boolean | null;
  image_url: string | null;
  url: string | null;
};

type AdvisorResult = {
  answer: string;
  recommendations: Recommendation[];
  reasons: string[];
  missing_facts: string[];
  safety_blocked: boolean;
};

const examples = [
  'Jag har en liten flock och vill spara tid i vardagen. Vad kan vara praktiskt?',
  'Vad kan vara bra inför kläckningssäsongen?',
  'Jag vill hitta något för utfodring eller vatten. Vad finns i katalogen?',
];

export default function CommerceAdvisorPilot() {
  const [question, setQuestion] = useState(examples[0]);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || loading) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('commerce-advisor', {
        body: { question: trimmed },
      });
      if (invokeError) throw invokeError;
      if (!data?.answer) throw new Error('Commerce Agent gav inget svar.');
      setResult(data as AdvisorResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Commerce Agent kunde inte svara just nu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-serif text-xl">Commerce Agent-pilot</CardTitle>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Testa hur en shoppingassistent skulle svara med Hönsgårdens riktiga affiliate-katalog som enda källa.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-success">
              <ShieldCheck className="h-3.5 w-3.5" /> Groundad och admin-only
            </div>
            Agenten får inte hitta på produkt, pris eller lager. Hälso-, läkemedels- och behandlingsfrågor blockeras.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void ask();
              }}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              placeholder="Vad letar kunden efter?"
              aria-label="Testfråga till Commerce Agent"
            />
            <Button onClick={() => void ask()} disabled={loading || question.trim().length < 2} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Testa
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => {
                  setQuestion(example);
                  void ask(example);
                }}
                className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm leading-relaxed">{result.answer}</p>
              </div>
              {result.missing_facts.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Saknad fakta: {result.missing_facts.join(' · ')}
                </p>
              ) : null}
              {result.reasons.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Evidens: {result.reasons.join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Validerade rekommendationer</CardTitle>
          <p className="text-xs text-muted-foreground">
            Bara produkt-ID:n som finns i databasen och inte är markerade som slut kan komma igenom.
          </p>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Kör en testfråga för att se rekommendationerna.
            </div>
          ) : result.recommendations.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Inga produkter rekommenderades för den här frågan.
            </div>
          ) : (
            <div className="space-y-2">
              {result.recommendations.map((product) => (
                <a
                  key={product.id}
                  href={product.url || undefined}
                  target={product.url ? '_blank' : undefined}
                  rel={product.url ? 'noopener noreferrer sponsored nofollow' : undefined}
                  className="flex gap-3 rounded-xl border border-border p-3 transition hover:border-primary/30 hover:bg-primary/[0.02]"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-14 w-14 rounded-lg object-contain bg-muted/30" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted/50 text-xl">🐔</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{product.name}</p>
                      {product.url ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {product.price ? `${product.price} ${product.currency || 'SEK'}` : 'Pris saknas'}
                      {' · '}
                      {product.in_stock === true ? 'I lager' : product.in_stock === false ? 'Ej i lager' : 'Lagerstatus okänd'}
                    </p>
                    {product.category ? <p className="mt-1 text-[10px] text-muted-foreground">{product.category}</p> : null}
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
