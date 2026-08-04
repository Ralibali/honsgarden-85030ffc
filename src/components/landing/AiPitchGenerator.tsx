import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Copy, Check, Loader2, ArrowRight, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function AiPitchGenerator() {
  const [price, setPrice] = useState('50');
  const [packs, setPacks] = useState('5');
  const [location, setLocation] = useState('');
  const [extra, setExtra] = useState('');
  const [pitch, setPitch] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contact, setContact] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  const generate = async () => {
    setLoading(true);
    setPitch('');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-egg-pitch`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          price: Number(price) || 50,
          packs: Number(packs) || 5,
          location: location.trim() || 'lokalt i området',
          extra: extra.trim(),
        }),
      });
      const data = await resp.json();
      if (resp.status === 429) {
        toast.error('För många förfrågningar – vänta en stund.');
        return;
      }
      if (data?.pitch) {
        setPitch(data.pitch);
      } else {
        toast.error('Kunde inte generera text just nu.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const copyPitch = async () => {
    if (!pitch) return;
    await navigator.clipboard.writeText(pitch);
    setCopied(true);
    toast.success('Texten är kopierad!');
    setTimeout(() => setCopied(false), 2000);
  };

  const submitLead = async () => {
    const value = contact.trim();
    if (!value) {
      toast.error('Fyll i e-post eller telefon.');
      return;
    }
    const isEmail = value.includes('@');
    const isPhone = /^[+0-9 ()\-]{6,20}$/.test(value);
    if (!isEmail && !isPhone) {
      toast.error('Ange en giltig e-post eller telefonnummer.');
      return;
    }
    setLeadLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-pitch-lead`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          email: isEmail ? value : '',
          phone: !isEmail ? value : '',
          pitch,
          price,
          packs,
          location,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data?.error || 'Kunde inte spara just nu.');
        return;
      }
      setLeadSent(true);
      toast.success('Tack! Vi hör av oss med tips och mallar.');
    } catch (e) {
      console.error(e);
      toast.error('Något gick fel. Försök igen.');
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <section id="ai-pitch" className="py-16 sm:py-24 bg-gradient-to-b from-background via-primary/[0.03] to-background">
      <div className="container max-w-4xl mx-auto px-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" /> Gratis AI-verktyg
          </Badge>
          <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
            Få en färdig säljtext på 5 sekunder
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Vår AI skriver ett säljande Facebook-inlägg åt dig – kopiera och dela direkt. Helt gratis,
            ingen registrering.
          </p>
        </motion.div>

        <Card className="border-border/50 rounded-3xl shadow-lg overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <Label htmlFor="pitch-price" className="text-sm">Pris per karta (kr)</Label>
                <Input
                  id="pitch-price"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="pitch-packs" className="text-sm">Antal kartor till salu</Label>
                <Input
                  id="pitch-packs"
                  inputMode="numeric"
                  value={packs}
                  onChange={(e) => setPacks(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="pitch-loc" className="text-sm">Hämtplats / ort (valfritt)</Label>
                <Input
                  id="pitch-loc"
                  placeholder="t.ex. Karlstad, hämtas på gården"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="pitch-extra" className="text-sm">Något extra att lyfta fram? (valfritt)</Label>
                <Textarea
                  id="pitch-extra"
                  placeholder="t.ex. frigående höns, olika färger på äggen, betalning med Swish"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="mt-1.5 resize-none"
                  rows={2}
                />
              </div>
            </div>

            <Button
              onClick={generate}
              disabled={loading}
              size="lg"
              className="w-full h-12 gap-2 shadow-[0_8px_30px_hsl(var(--primary)/0.25)]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Skriver din säljtext…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Skapa min säljtext gratis
                </>
              )}
            </Button>

            {pitch && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <div className="rounded-2xl bg-muted/40 border border-border/40 p-5 relative">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed pr-10">
                    {pitch}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyPitch}
                    className="absolute top-3 right-3 h-8 w-8 p-0"
                    aria-label="Kopiera text"
                  >
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="mt-6"
                >
                  <Button
                    asChild
                    size="lg"
                    className="w-full h-14 text-base gap-2 shadow-[0_10px_40px_hsl(var(--primary)/0.35)] hover:shadow-[0_14px_50px_hsl(var(--primary)/0.45)] transition-shadow"
                  >
                    <a
                      href={`/login?mode=register&utm_source=ai_pitch&utm_medium=landing&utm_campaign=salja_agg&pitch=${encodeURIComponent(
                        pitch.slice(0, 1500),
                      )}&price=${encodeURIComponent(price)}&packs=${encodeURIComponent(packs)}&location=${encodeURIComponent(location)}`}
                    >
                      <Sparkles className="h-5 w-5" />
                      Skapa min gratis säljsida med denna text
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Vi sparar din text så du kan publicera direkt efter registrering – tar 30 sekunder.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="mt-6 rounded-2xl border border-border/50 bg-background p-5"
                >
                  {leadSent ? (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      Tack! Vi skickar tips, mallar och säljknep till dig.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 mb-3">
                        <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Vill du ha fler säljtexter & tips?
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Lämna e-post eller telefon så skickar vi mallar, prisguider och knep för
                            att sälja slut snabbare. Inga utskick varje dag – lovat.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          type="text"
                          inputMode="email"
                          placeholder="din@epost.se eller 070-123 45 67"
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          className="flex-1"
                          aria-label="E-post eller telefonnummer"
                        />
                        <Button
                          onClick={submitLead}
                          disabled={leadLoading}
                          className="h-10 sm:w-auto w-full"
                        >
                          {leadLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Skicka mig tips'
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Vi delar aldrig dina uppgifter. Avregistrera när du vill.
                      </p>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
