import { ExternalLink } from 'lucide-react';

export interface ContentSource {
  href: string;
  label: string;
  /** Utgivare/myndighet, t.ex. "Livsmedelsverket". Visas som prefix. */
  publisher?: string;
}

/**
 * Återanvändbar källförteckning för innehållssidor (guider, regelsidor,
 * hälsoinformation). Renderar ingenting om listan är tom — en sida utan
 * källor ska inte låtsas ha några.
 */
export function ContentSources({
  sources,
  heading = 'Källor',
  className = '',
}: {
  sources: ContentSource[];
  /** Lämna tom sträng för att dölja rubriken (t.ex. inuti en disclaimer). */
  heading?: string;
  className?: string;
}) {
  if (!sources || sources.length === 0) return null;
  return (
    <nav aria-label={heading || 'Källor'} className={`rounded-2xl border border-border bg-card/40 p-5 ${className}`}>
      {heading && <h2 className="text-sm font-semibold text-foreground mb-3">{heading}</h2>}
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.href} className="text-sm">
            {source.publisher && (
              <span className="text-muted-foreground">{source.publisher}: </span>
            )}
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 inline-flex items-center gap-1 break-all"
            >
              {source.label}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default ContentSources;
