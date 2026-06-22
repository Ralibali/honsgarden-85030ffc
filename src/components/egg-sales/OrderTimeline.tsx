import { CheckCircle2 } from 'lucide-react';
import { eggOrderStatusLabels, eggOrderSteps } from '@/lib/eggOrderPortal';

export default function OrderTimeline({ status }: { status: string }) {
  if (['cancelled', 'refunded', 'no_show'].includes(status)) return null;
  const current = eggOrderSteps.indexOf(status);

  return (
    <div className="overflow-x-auto rounded-3xl border bg-card p-5">
      <div className="flex min-w-[560px] items-start justify-between gap-2">
        {eggOrderSteps.map((step, index) => {
          const complete = index <= current;
          return (
            <div key={step} className="relative flex-1 text-center">
              {index > 0 && (
                <div className={`absolute right-1/2 top-4 h-0.5 w-full ${complete ? 'bg-primary' : 'bg-border'}`} />
              )}
              <div className={`relative mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full ${complete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <span className="text-[10px] sm:text-xs">{eggOrderStatusLabels[step]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
