import { useParams } from 'react-router-dom';
import { Egg } from 'lucide-react';
import RepeatPurchaseSummary from '@/components/egg-sales/RepeatPurchaseSummary';

export default function RecurringOrderPortal() {
  const { token: accessKey = '' } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen bg-[#f5efe5]">
      <header className="border-b bg-background/85">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-4 font-serif font-semibold">
          <Egg className="h-5 w-5 text-primary" /> Agdas bod
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <RepeatPurchaseSummary accessKey={accessKey} />
      </main>
    </div>
  );
}
