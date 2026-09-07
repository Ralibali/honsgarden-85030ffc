import { AffiliateLink } from '@/components/AffiliateLink';
import {
  shopPlacementForPath,
  trackedShopHref,
  type ShopPlacement,
} from '@/lib/contextualShopPlacements';

type Props = {
  path: string;
  placement?: ShopPlacement;
};

/** Annons-disclosed shop CTA. Reuses AffiliateLink + existing Adtraction wraps. */
export default function ContextualShopCta({ path, placement: provided }: Props) {
  const placement = provided ?? shopPlacementForPath(path);
  if (!placement) return null;

  return (
    <aside
      className="my-8 rounded-2xl border border-border/40 bg-gradient-to-br from-card to-secondary/40 p-5 sm:p-6"
      data-shop-placement={placement.path}
      aria-label="Annons"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Annons</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{placement.body}</p>
      <p className="mt-3 text-sm font-medium text-foreground flex flex-wrap gap-x-3 gap-y-2">
        {placement.links.map((link) => (
          <AffiliateLink
            key={`${link.merchant}:${link.destination}`}
            href={trackedShopHref(link)}
            advertiser={link.merchant}
            source="other"
            slug={placement.slug ?? null}
            className="underline underline-offset-2 hover:text-primary"
          >
            {link.label}
          </AffiliateLink>
        ))}
      </p>
    </aside>
  );
}
