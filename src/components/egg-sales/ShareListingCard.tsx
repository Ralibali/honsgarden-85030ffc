import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Share2, QrCode, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface ShareListingCardProps {
  slug: string;
  title: string;
  publicBaseUrl: string;
}

/**
 * Dela-kort för Agdas äggbod: QR-koden och länken direkt i flödet –
 * säljaren behöver inte ladda ner en PDF för att visa koden för en kund.
 */
export default function ShareListingCard({ slug, title, publicBaseUrl }: ShareListingCardProps) {
  const url = `${publicBaseUrl}/s/${encodeURIComponent(slug)}`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('qrcode');
        const QRCode = (mod as any).default ?? mod;
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 480,
          errorCorrectionLevel: 'M',
          color: { dark: '#1f2a1f', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        /* QR visas inte – länk + knappar fungerar ändå */
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Länken kopierad! 🔗' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Kunde inte kopiera', description: 'Markera länken och kopiera manuellt.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Köp färska ägg: ${title}`, url });
      } catch {
        /* användaren avbröt – helt ok */
      }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <QrCode className="h-4 w-4 text-primary" />
            </span>
            <div>
              <h2 className="font-serif text-base text-foreground leading-tight">Dela din äggbod</h2>
              <p className="text-xs text-muted-foreground">Visa QR-koden för kunder – eller skicka länken direkt.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-sm border border-border/60">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR-kod till ${title}`} className="h-32 w-32" />
              ) : (
                <div className="h-32 w-32 rounded-xl bg-muted/40 animate-pulse" />
              )}
            </div>

            <div className="flex-1 w-full space-y-2.5">
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                {url}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleShare}>
                  <Share2 className="h-3.5 w-3.5" /> Dela
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Kopierad!' : 'Kopiera länk'}
                </Button>
                <Button asChild size="sm" variant="ghost" className="rounded-xl gap-1.5 text-xs">
                  <Link to={`/s/${encodeURIComponent(slug)}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5" /> Förhandsvisa
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
