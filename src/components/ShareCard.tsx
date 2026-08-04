import React, { useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Download, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ShareCardProps {
  weekEggs: number;
  totalEggs: number;
  henCount: number;
  streak: number;
  userName?: string;
}

function drawShareCard(canvas: HTMLCanvasElement, props: ShareCardProps) {
  const ctx = canvas.getContext('2d')!;
  const w = 1080;
  const h = 1080;
  canvas.width = w;
  canvas.height = h;

  // Background gradient (warm lantlig tones)
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#f5f0e8');
  grad.addColorStop(0.5, '#f0ebe0');
  grad.addColorStop(1, '#e8e0d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle pattern overlay
  ctx.fillStyle = 'rgba(139, 115, 85, 0.03)';
  for (let i = 0; i < w; i += 40) {
    for (let j = 0; j < h; j += 40) {
      ctx.beginPath();
      ctx.arc(i, j, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top decorative bar
  const barGrad = ctx.createLinearGradient(0, 0, w, 0);
  barGrad.addColorStop(0, '#3d7a4a');
  barGrad.addColorStop(1, '#8b6e3b');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, w, 8);

  // App name
  ctx.fillStyle = '#3d7a4a';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐔 Hönsgården', w / 2, 80);

  // Divider line
  ctx.strokeStyle = 'rgba(139, 115, 85, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, 110);
  ctx.lineTo(w - 100, 110);
  ctx.stroke();

  // Main stat - weekly eggs
  ctx.fillStyle = '#2d1a0e';
  ctx.font = 'bold 180px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${props.weekEggs}`, w / 2, 320);

  ctx.fillStyle = '#6b5a48';
  ctx.font = '36px system-ui, -apple-system, sans-serif';
  ctx.fillText('ägg denna vecka 🥚', w / 2, 380);

  // Stats grid
  const statsY = 480;
  const statsData = [
    { label: 'Totalt', value: `${props.totalEggs}`, emoji: '📊' },
    { label: 'Hönor', value: `${props.henCount}`, emoji: '🐔' },
    { label: 'Streak', value: `${props.streak}d`, emoji: '🔥' },
  ];

  const cardW = 240;
  const gap = 40;
  const startX = (w - (cardW * 3 + gap * 2)) / 2;

  statsData.forEach((stat, i) => {
    const x = startX + i * (cardW + gap);
    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x, statsY, cardW, 160, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, statsY, cardW, 160, 20);
    ctx.stroke();

    // Emoji
    ctx.font = '32px system-ui';
    ctx.fillStyle = '#2d1a0e';
    ctx.textAlign = 'center';
    ctx.fillText(stat.emoji, x + cardW / 2, statsY + 50);

    // Value
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#2d1a0e';
    ctx.fillText(stat.value, x + cardW / 2, statsY + 105);

    // Label
    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#8b7a68';
    ctx.fillText(stat.label, x + cardW / 2, statsY + 140);
  });

  // User attribution
  if (props.userName) {
    ctx.fillStyle = '#6b5a48';
    ctx.font = '26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${props.userName}s hönsgård`, w / 2, 730);
  }

  // Divider
  ctx.strokeStyle = 'rgba(139, 115, 85, 0.1)';
  ctx.beginPath();
  ctx.moveTo(200, 780);
  ctx.lineTo(w - 200, 780);
  ctx.stroke();

  // CTA
  ctx.fillStyle = '#3d7a4a';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('Logga dina ägg gratis!', w / 2, 850);

  ctx.fillStyle = '#8b7a68';
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.fillText('honsgarden.se', w / 2, 890);

  // Bottom decorative bar
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, h - 8, w, 8);

  // Decorative egg emojis scattered
  ctx.font = '40px system-ui';
  ctx.globalAlpha = 0.08;
  const positions = [[80, 200], [950, 250], [120, 600], [900, 700], [500, 950]];
  positions.forEach(([x, y]) => {
    ctx.fillText('🥚', x, y);
  });
  ctx.globalAlpha = 1;
}

export default function ShareCard({ weekEggs, totalEggs, henCount, streak, userName }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const generateCard = useCallback(() => {
    if (!canvasRef.current) return;
    drawShareCard(canvasRef.current, { weekEggs, totalEggs, henCount, streak, userName });
    setGenerated(true);
  }, [weekEggs, totalEggs, henCount, streak, userName]);

  React.useEffect(() => {
    generateCard();
  }, [generateCard]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `honsgarden-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast({ title: '📥 Bild nedladdad!' });
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve) =>
        canvasRef.current!.toBlob((b) => resolve(b!), 'image/png')
      );
      const file = new File([blob], 'honsgarden.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Mina höns denna vecka 🐔',
          text: `Mina höns värpte ${weekEggs} ägg den här veckan! 🥚🐔 Logga dina ägg gratis på honsgarden.se`,
          files: [file],
        });
        toast({ title: '🎉 Delat!' });
      } else {
        // Fallback: copy text
        await navigator.clipboard.writeText(
          `Mina höns värpte ${weekEggs} ägg den här veckan! 🥚🐔\n\nLogga dina ägg gratis på honsgarden.se`
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: '📋 Text kopierad!', description: 'Ladda ner bilden och dela tillsammans med texten.' });
      }
    } catch (err) {
      // User cancelled share
    }
  };

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(
      `Mina höns värpte ${weekEggs} ägg den här veckan! 🥚🐔\n\nTotalt: ${totalEggs} ägg | ${henCount} hönor | ${streak} dagars streak 🔥\n\nLogga dina ägg gratis → honsgarden.se`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: '📋 Kopierat!' });
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Share2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-serif text-sm text-foreground">Dela dina resultat</h3>
            <p className="text-[11px] text-muted-foreground">Visa dina vänner hur det går!</p>
          </div>
        </div>

        {/* Canvas preview */}
        <div className="rounded-xl overflow-hidden border border-border/30 mb-4">
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl h-10 gap-2 text-sm"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Dela
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-10 gap-2 text-sm"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Ladda ner
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-10 gap-2 text-sm"
            onClick={handleCopyText}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
