import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, Share2, Download, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface PersonalRecordToastData {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  unit: string;
  /** Optional ISO date the record was achieved. Defaults to today. */
  date?: string;
}

interface Props {
  record: PersonalRecordToastData | null;
  onDone: () => void;
}

function formatDateSv(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  try {
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/** Draw a juicy 1080x1350 share card to a canvas. */
function drawRecordCard(canvas: HTMLCanvasElement, r: PersonalRecordToastData) {
  const ctx = canvas.getContext('2d')!;
  const w = 1080;
  const h = 1350;
  canvas.width = w;
  canvas.height = h;

  // Background — warm amber-to-orange gradient
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#fff7ed');
  bg.addColorStop(0.55, '#fed7aa');
  bg.addColorStop(1, '#fb923c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft radial glow behind trophy
  const glow = ctx.createRadialGradient(w / 2, 470, 40, w / 2, 470, 520);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Faint dot pattern
  ctx.fillStyle = 'rgba(120, 53, 15, 0.05)';
  for (let i = 30; i < w; i += 38) {
    for (let j = 30; j < h; j += 38) {
      ctx.beginPath();
      ctx.arc(i, j, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top brand bar
  const bar = ctx.createLinearGradient(0, 0, w, 0);
  bar.addColorStop(0, '#3a6b35');
  bar.addColorStop(1, '#b45309');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, w, 10);

  // Brand
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a6b35';
  ctx.font = '700 30px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText('🐔  HÖNSGÅRDEN', w / 2, 90);

  // Eyebrow
  ctx.fillStyle = '#92400e';
  ctx.font = '700 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('PERSONLIGT REKORD', w / 2, 170);
  // Underline
  ctx.strokeStyle = 'rgba(146, 64, 14, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 110, 188);
  ctx.lineTo(w / 2 + 110, 188);
  ctx.stroke();

  // Trophy circle
  const cx = w / 2;
  const cy = 360;
  const radius = 130;
  const trophyGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  trophyGrad.addColorStop(0, '#fbbf24');
  trophyGrad.addColorStop(1, '#ea580c');
  ctx.fillStyle = trophyGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'rgba(234, 88, 12, 0.4)';
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Trophy emoji
  ctx.font = '160px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText('🏆', cx, cy + 60);

  // Title
  ctx.fillStyle = '#1c1917';
  ctx.font = '700 64px Georgia, "Young Serif", serif';
  ctx.fillText(r.title, cx, 600);

  // Subtitle
  ctx.fillStyle = '#57534e';
  ctx.font = '400 32px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(r.subtitle, cx, 656);

  // Big value
  ctx.fillStyle = '#c2410c';
  ctx.font = '900 320px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(r.value), cx, 980);

  // Unit
  ctx.fillStyle = '#7c2d12';
  ctx.font = '700 38px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(r.unit.toUpperCase(), cx, 1030);

  // Divider
  ctx.strokeStyle = 'rgba(124, 45, 18, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(180, 1100);
  ctx.lineTo(w - 180, 1100);
  ctx.stroke();

  // Date
  ctx.fillStyle = '#78350f';
  ctx.font = '500 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(formatDateSv(r.date), cx, 1160);

  // CTA
  ctx.fillStyle = '#3a6b35';
  ctx.font = '700 32px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Logga dina ägg gratis på honsgarden.se', cx, 1240);

  // Bottom bar
  ctx.fillStyle = bar;
  ctx.fillRect(0, h - 10, w, 10);

  // Decorative eggs corners
  ctx.font = '60px system-ui';
  ctx.globalAlpha = 0.15;
  ctx.fillText('🥚', 90, 1280);
  ctx.fillText('🥚', w - 90, 1280);
  ctx.fillText('🥚', 110, 240);
  ctx.fillText('🥚', w - 110, 240);
  ctx.globalAlpha = 1;
}

/**
 * Big juicy "personal record" toast that drops in from the top with a glow + sparkle burst.
 * Includes a share button that generates a beautiful 1080x1350 PNG card with the user's record.
 */
export function PersonalRecordToast({ record, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // Auto-dismiss after 5s, but cancel if the user is interacting (sharing/downloading)
  useEffect(() => {
    if (!record) return;
    setShared(false);
    hideTimer.current = window.setTimeout(onDone, 5000);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [record, onDone]);

  const cancelAutoHide = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const buildBlob = async (): Promise<{ blob: Blob; canvas: HTMLCanvasElement } | null> => {
    if (!record) return null;
    const canvas = document.createElement('canvas');
    drawRecordCard(canvas, record);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) return null;
    return { blob, canvas };
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record || busy) return;
    cancelAutoHide();
    setBusy(true);
    try {
      const built = await buildBlob();
      if (!built) throw new Error('canvas');
      const file = new File([built.blob], `honsgarden-rekord-${record.value}-${record.unit}.png`, {
        type: 'image/png',
      });
      const text = `🏆 Nytt personligt rekord! ${record.value} ${record.unit} – ${record.title} 🥚\nLogga dina ägg gratis på honsgarden.se`;

      // @ts-expect-error – navigator.canShare not typed in all envs
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Personligt rekord 🏆', text, files: [file] });
        setShared(true);
        toast({ title: '🎉 Delat!' });
      } else if (navigator.share) {
        await navigator.share({ title: 'Personligt rekord 🏆', text });
        setShared(true);
      } else {
        // Fallback: download + copy text
        const url = URL.createObjectURL(built.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        try {
          await navigator.clipboard.writeText(text);
        } catch {}
        toast({ title: '📥 Bild nedladdad', description: 'Texten är kopierad – klistra in när du delar.' });
        setShared(true);
      }
    } catch {
      // user cancelled or error – swallow silently
    } finally {
      setBusy(false);
      // Give the user a moment to see the confirmation, then close
      window.setTimeout(onDone, 1200);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record || busy) return;
    cancelAutoHide();
    setBusy(true);
    try {
      const built = await buildBlob();
      if (!built) return;
      const url = URL.createObjectURL(built.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `honsgarden-rekord-${record.value}-${record.unit}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: '📥 Bild nedladdad!' });
      setShared(true);
    } finally {
      setBusy(false);
      window.setTimeout(onDone, 1200);
    }
  };

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key={record.id}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] w-[min(92vw,440px)]"
          initial={{ opacity: 0, y: -40, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/80 dark:via-yellow-950/70 dark:to-orange-950/60 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(245,158,11,0.55)]">
            {/* Sparkle particles */}
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const tx = Math.cos(angle) * 80;
              const ty = Math.sin(angle) * 50;
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-amber-400 pointer-events-none"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: tx, y: ty, scale: [0, 1.2, 0.5], rotate: [0, 180] }}
                  transition={{ duration: 1.4, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
              );
            })}

            <div className="relative flex items-center gap-3 p-4">
              <motion.div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg"
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: [-20, 8, -4, 0], scale: [0, 1.2, 0.95, 1] }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.05 }}
              >
                <Trophy className="h-7 w-7 text-white drop-shadow" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Personligt rekord
                </p>
                <p className="font-serif text-lg leading-tight text-foreground">{record.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{record.subtitle}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400 leading-none">
                  {record.value}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  {record.unit}
                </span>
              </div>
            </div>

            {/* Action row */}
            <div className="relative flex items-center gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={handleShare}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/30 transition-all disabled:opacity-60"
                aria-label="Dela ditt rekord"
              >
                {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {shared ? 'Delat!' : busy ? 'Skapar bild…' : 'Dela rekord'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-amber-300/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60"
                aria-label="Ladda ner bild"
                title="Ladda ner bild"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PersonalRecordToast;
