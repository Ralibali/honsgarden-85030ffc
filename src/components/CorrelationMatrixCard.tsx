import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

// Map r in [-1,1] to a background color: red <0, white ~0, green >0.
function colorFor(r: number | null): string {
  if (r == null) return 'hsl(var(--muted))';
  const t = Math.max(-1, Math.min(1, r));
  // Use HSL: red 0, green 140
  const hue = t >= 0 ? 140 : 0;
  const sat = Math.round(Math.abs(t) * 65); // 0..65
  const light = 96 - Math.round(Math.abs(t) * 38); // 96..58
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function textColorFor(r: number | null): string {
  if (r == null) return 'hsl(var(--muted-foreground))';
  return Math.abs(r) > 0.55 ? 'hsl(var(--background))' : 'hsl(var(--foreground))';
}

export default function CorrelationMatrixCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['correlation-matrix'],
    queryFn: () => api.getCorrelationMatrix(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🔗 Sambandsmatris</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const enoughDays = data.days >= 20;
  const hasAnyR = data.matrix.some((row, i) => row.some((v, j) => i !== j && v != null));

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🔗 Sambandsmatris</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Hur hänger produktion, temperatur, dagsljus och foder ihop? Värden från −1 (motsats) till +1 (följs åt).
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
        {!enoughDays || !hasAnyR ? (
          <EmptyState
            emoji="📊"
            title="För lite data för samband ännu"
            description="Vi behöver minst 20 dagar med både äggloggar och väder för att räkna ut korrelationer. Fortsätt logga – så fyller vi i bilden."
          />
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <div className="inline-block min-w-full px-1">
                <table className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="w-24"></th>
                      {data.variables.map((v) => (
                        <th
                          key={v.key}
                          className="px-2 py-1 text-[11px] sm:text-xs font-medium text-muted-foreground text-center min-w-[64px]"
                        >
                          {v.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.variables.map((row, i) => (
                      <tr key={row.key}>
                        <th className="pr-2 text-right text-[11px] sm:text-xs font-medium text-muted-foreground">
                          {row.label}
                        </th>
                        {data.variables.map((col, j) => {
                          const r = data.matrix[i][j];
                          return (
                            <td key={col.key} className="p-0">
                              <div
                                className="rounded-md h-12 sm:h-14 w-16 sm:w-20 flex items-center justify-center text-xs sm:text-sm font-mono tabular-nums border border-border/40"
                                style={{ background: colorFor(r), color: textColorFor(r) }}
                                title={
                                  r == null
                                    ? `Otillräcklig data (${data.counts[i][j]} dagar)`
                                    : `${row.label} ↔ ${col.label}: r = ${nf.format(r)} (${data.counts[i][j]} dagar)`
                                }
                              >
                                {r == null ? '–' : nf.format(r)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-6 rounded" style={{ background: colorFor(-1) }} />
                <span>−1</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-6 rounded" style={{ background: colorFor(0) }} />
                <span>0</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-3 w-6 rounded" style={{ background: colorFor(1) }} />
                <span>+1</span>
              </div>
            </div>

            {data.insight && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-sm text-foreground">
                {data.insight}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Bygger på {data.days} överlappande dagar. {data.latitudeSource === 'fallback' && 'Ange din plats i inställningarna för exaktare dagsljusberäkning.'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
