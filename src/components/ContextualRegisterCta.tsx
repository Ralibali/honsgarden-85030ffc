import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ContextualRegisterCtaSpec } from '@/lib/contextualRegisterCtas';

type Props = Pick<ContextualRegisterCtaSpec, 'body' | 'button' | 'href'>;

/** In-content register CTA. Matches ArticleCta visual language; no new events. */
export default function ContextualRegisterCta({ body, button, href }: Props) {
  return (
    <aside
      className="my-8 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/8 via-card to-accent/5 p-5 sm:p-6"
      aria-label={button}
    >
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      <Link to={href} className="mt-4 inline-block">
        <Button className="rounded-xl">{button}</Button>
      </Link>
    </aside>
  );
}
