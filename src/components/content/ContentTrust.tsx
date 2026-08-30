import { AlertTriangle, CalendarCheck2, UserCheck } from 'lucide-react';

const formatIsoDate = (iso: string, locale = 'sv-SE') => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * "Senast granskad"-markering. Kräver ett riktigt ISO-datum — renderar
 * ingenting om datumet saknas eller ligger i framtiden (en granskning i
 * framtiden är en fabrikerad granskning).
 */
export function LastReviewed({ date, className = '' }: { date?: string; className?: string }) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return null;
  return (
    <p className={`text-xs text-muted-foreground inline-flex items-center gap-1.5 ${className}`}>
      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
      Senast granskad: <time dateTime={date}>{formatIsoDate(date)}</time>
    </p>
  );
}

export interface ReviewerIdentity {
  /** Riktigt namn på granskaren. Får ALDRIG hittas på. */
  name?: string;
  /** Granskarens roll/legitimation, t.ex. "veterinär". Får ALDRIG hittas på. */
  role?: string;
}

/**
 * Granskningsinformation för förtroendekänsligt innehåll.
 *
 * Policy (swarm A): vi visar bara en namngiven granskare när en riktig
 * person faktiskt har granskat innehållet. Utan identitet renderas inget —
 * sidan får aldrig påstå att en veterinär eller expert granskat något som
 * ingen granskat.
 */
export function ReviewedBy({
  reviewer,
  date,
  className = '',
}: {
  reviewer?: ReviewerIdentity;
  date?: string;
  className?: string;
}) {
  if (!reviewer?.name) return null;
  return (
    <p className={`text-xs text-muted-foreground inline-flex items-center gap-1.5 ${className}`}>
      <UserCheck className="h-3.5 w-3.5" aria-hidden />
      Granskad av {reviewer.name}
      {reviewer.role ? `, ${reviewer.role}` : ''}
      {date && new Date(date).getTime() <= Date.now() && (
        <>
          {' '}
          <time dateTime={date}>{formatIsoDate(date)}</time>
        </>
      )}
    </p>
  );
}

/**
 * Återanvändbar disclaimer för hälso- och regelinnehåll.
 * variant 'halsa'  → uppmaning att kontakta veterinär vid sjukdomssymptom.
 * variant 'regler' → uppmaning att dubbelkolla hos myndigheterna.
 */
export function ContentDisclaimer({
  variant,
  className = '',
  children,
}: {
  variant: 'halsa' | 'regler';
  className?: string;
  children?: React.ReactNode;
}) {
  const copy =
    variant === 'halsa'
      ? {
          title: 'Hönsgården ersätter inte veterinär',
          body: 'Innehållet är allmän information för hobbyhönsägare. Vid oro för sjukdom, skador eller plötsliga dödsfall i flocken – kontakta alltid veterinär.',
        }
      : {
          title: 'Regler kan ändras – dubbelkolla alltid källan',
          body: 'Innehållet är en översikt och ersätter inte myndigheternas information. Aktuella regler hittar du hos Jordbruksverket, Livsmedelsverket och din kommun.',
        };
  return (
    <aside
      className={`rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 sm:p-5 flex gap-3 ${className}`}
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="text-sm text-amber-900 dark:text-amber-100 space-y-2">
        <p className="font-medium">{copy.title}</p>
        <p>{copy.body}</p>
        {children}
      </div>
    </aside>
  );
}

export default { LastReviewed, ReviewedBy, ContentDisclaimer };
