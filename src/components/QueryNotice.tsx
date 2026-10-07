import { Button } from '@/components/ui/button';

export default function QueryNotice({ title, loading = false, onRetry }: { title: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <div role={loading ? 'status' : 'alert'} className="my-6 rounded-2xl border bg-card p-6 space-y-3">
      <p className="font-medium">{title}</p>
      {!loading && <p className="text-sm text-muted-foreground">Uppgifterna kunde inte hämtas. Kontrollera din anslutning och försök igen.</p>}
      {onRetry && !loading && <Button variant="outline" onClick={onRetry}>Försök igen</Button>}
    </div>
  );
}
