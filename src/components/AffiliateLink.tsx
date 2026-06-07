import { forwardRef, MouseEvent, AnchorHTMLAttributes } from 'react';
import { trackAffiliateClick, AffiliateClickSource } from '@/lib/affiliateTracking';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  productId?: string | null;
  bannerId?: string | null;
  advertiser: string;
  source: AffiliateClickSource;
  slug?: string | null;
}

/**
 * Wrapper kring `<a>` som loggar ett affiliate-klick innan navigeringen sker.
 * Sätter automatiskt rel="sponsored noopener noreferrer" om ingen rel anges.
 *
 * Tracking sker på onMouseDown/onAuxClick/onContextMenu för att fånga
 * vänsterklick, mittenklick (öppna i ny flik) och högerklick → "öppna i ny flik".
 */
export const AffiliateLink = forwardRef<HTMLAnchorElement, Props>(function AffiliateLink(
  {
    href,
    productId,
    bannerId,
    advertiser,
    source,
    slug,
    rel,
    target,
    onMouseDown,
    onAuxClick,
    onContextMenu,
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const fire = () => {
    trackAffiliateClick({
      product_id: productId ?? null,
      banner_id: bannerId ?? null,
      advertiser,
      source,
      slug: slug ?? null,
      href,
    });
  };

  const handleMouseDown = (e: MouseEvent<HTMLAnchorElement>) => {
    // 0 = vänster, 1 = mitten. Högerklick fångas av onContextMenu.
    if (e.button === 0 || e.button === 1) fire();
    onMouseDown?.(e);
  };
  const handleAuxClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button === 1) fire();
    onAuxClick?.(e);
  };
  const handleContextMenu = (e: MouseEvent<HTMLAnchorElement>) => {
    fire();
    onContextMenu?.(e);
  };
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Tangentbordsaktivering (Enter) går via onClick utan mousedown
    if (e.detail === 0) fire();
    onClick?.(e);
  };

  return (
    <a
      ref={ref}
      href={href}
      target={target ?? '_blank'}
      rel={rel ?? 'sponsored noopener noreferrer'}
      onMouseDown={handleMouseDown}
      onAuxClick={handleAuxClick}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </a>
  );
});

export default AffiliateLink;
