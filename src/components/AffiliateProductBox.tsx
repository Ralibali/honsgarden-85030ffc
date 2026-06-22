import { useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineAffiliateCard } from '@/components/affiliate/InlineAffiliateCard';
import { AffiliateSafetyBoundary } from '@/components/AffiliateSafetyBoundary';
import { useAffiliateArticleProfile } from '@/hooks/useAffiliateArticleProfile';
import { useSmartAffiliateCatalog } from '@/hooks/useSmartAffiliateCatalog';
import {
  matchSmartProducts,
  type ArticleContext,
  type SmartAffiliateProduct,
} from '@/lib/smartAffiliate';

interface Props {
  slug: string;
  title: string;
  content: string;
  limit?: number;
}

interface Placement {
  id: string;
  slot: HTMLDivElement;
  product: SmartAffiliateProduct;
  sectionTitle: string;
}

const BLOCKED_SECTIONS = /vanliga frågor|faq|sammanfattning|slutsats|källor|referenser|läs också|relaterade artiklar/i;

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(value: string): number {
  const text = plainText(value);
  return text ? text.split(/\s+/).length : 0;
}

function sectionAfterHeading(heading: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];
  let node = heading.nextElementSibling as HTMLElement | null;
  while (node && !node.matches('h2, h3')) {
    elements.push(node);
    node = node.nextElementSibling as HTMLElement | null;
  }
  return elements;
}

function sectionTarget(heading: HTMLElement, elements: HTMLElement[]): HTMLElement {
  const readableBlocks = elements.filter((element) =>
    element.matches('p, ul, ol, blockquote, table, figure, .overflow-x-auto'),
  );
  return readableBlocks[Math.min(1, readableBlocks.length - 1)] || elements[0] || heading;
}

function createSlot(id: string, target: HTMLElement): HTMLDivElement {
  const slot = document.createElement('div');
  slot.dataset.smartAffiliateSlot = id;
  slot.className = 'not-prose';
  target.insertAdjacentElement('afterend', slot);
  return slot;
}

function desiredBlockCount(
  content: string,
  tier: 'normal' | 'strong' | 'hot',
  profileMax: number,
  requestedLimit?: number,
): number {
  const words = wordCount(content);
  const natural = words < 650 ? 1 : words < 1200 ? 2 : words < 1900 ? 3 : 4;
  let desired = Math.min(natural, 2);
  if (tier === 'strong') desired = Math.max(3, natural);
  if (tier === 'hot') desired = Math.max(5, natural);
  const explicitLimit = requestedLimit == null ? 5 : Math.max(0, requestedLimit);
  return Math.min(5, profileMax, explicitLimit, desired);
}

function previousHeading(target: HTMLElement, article: HTMLElement, fallback: string): string {
  const headings = Array.from(article.querySelectorAll<HTMLElement>('.prose-custom h2, .prose-custom h3'));
  let previous = fallback;
  for (const heading of headings) {
    if (heading.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
      previous = heading.textContent?.trim() || previous;
      continue;
    }
    break;
  }
  return previous;
}

function AffiliateProductBoxContent({ slug, title, content, limit }: Props) {
  const catalog = useSmartAffiliateCatalog();
  const profile = useAffiliateArticleProfile(slug);
  const [placements, setPlacements] = useState<Placement[]>([]);

  const maxBlocks = useMemo(
    () => desiredBlockCount(content, profile.tier, profile.maxBlocks, limit),
    [content, limit, profile.maxBlocks, profile.tier],
  );

  useLayoutEffect(() => {
    const article = document.querySelector<HTMLElement>('main article');
    if (!article || catalog.length === 0 || maxBlocks <= 0) {
      setPlacements([]);
      return undefined;
    }

    article.querySelectorAll<HTMLElement>('[data-smart-affiliate-slot]').forEach((slot) => slot.remove());

    const createdSlots: HTMLDivElement[] = [];
    const nextPlacements: Placement[] = [];
    const usedProductIds = new Set<string>();
    const usedTargets = new Set<HTMLElement>();
    const headings = Array.from(article.querySelectorAll<HTMLElement>('.prose-custom h2, .prose-custom h3'));
    const firstAllowedHeading = Math.max(0, Math.floor(headings.length * 0.2));
    const minimumHeadingGap = profile.tier === 'normal' ? 2 : 1;
    let lastHeadingIndex = -10;

    for (let index = firstAllowedHeading; index < headings.length && nextPlacements.length < maxBlocks; index += 1) {
      if (index - lastHeadingIndex < minimumHeadingGap) continue;
      const heading = headings[index];
      const sectionTitle = heading.textContent?.trim() || title;
      if (BLOCKED_SECTIONS.test(sectionTitle)) continue;

      const sectionElements = sectionAfterHeading(heading);
      const sectionText = [sectionTitle, ...sectionElements.map((element) => element.textContent || '')].join(' ');
      if (wordCount(sectionText) < 35) continue;

      const context: ArticleContext = { slug, title, heading: sectionTitle, text: sectionText };
      const product = matchSmartProducts(catalog, context, 5, usedProductIds)[0];
      if (!product) continue;

      const target = sectionTarget(heading, sectionElements);
      if (usedTargets.has(target)) continue;

      const id = `smart-affiliate-${slug}-${index}`;
      const slot = createSlot(id, target);
      createdSlots.push(slot);
      usedTargets.add(target);
      usedProductIds.add(product.id);
      nextPlacements.push({ id, slot, product, sectionTitle });
      lastHeadingIndex = index;
    }

    if (nextPlacements.length < maxBlocks) {
      const paragraphs = Array.from(article.querySelectorAll<HTMLElement>('.prose-custom p'))
        .filter((paragraph) => wordCount(paragraph.textContent || '') >= 24);
      const preferredFractions = [0.32, 0.52, 0.7, 0.84];

      for (let fallbackIndex = 0; fallbackIndex < preferredFractions.length && nextPlacements.length < maxBlocks; fallbackIndex += 1) {
        if (paragraphs.length === 0) break;
        const paragraphIndex = Math.min(
          paragraphs.length - 1,
          Math.max(0, Math.floor(paragraphs.length * preferredFractions[fallbackIndex])),
        );
        const target = paragraphs[paragraphIndex];
        if (usedTargets.has(target)) continue;

        const sectionTitle = previousHeading(target, article, title);
        const context: ArticleContext = {
          slug,
          title,
          heading: sectionTitle,
          text: `${sectionTitle} ${target.textContent?.trim() || ''}`,
        };
        const product = matchSmartProducts(catalog, context, 5, usedProductIds)[0];
        if (!product) continue;

        const id = `smart-affiliate-${slug}-fallback-${fallbackIndex}`;
        const slot = createSlot(id, target);
        createdSlots.push(slot);
        usedTargets.add(target);
        usedProductIds.add(product.id);
        nextPlacements.push({ id, slot, product, sectionTitle });
      }
    }

    setPlacements(nextPlacements);
    return () => createdSlots.forEach((slot) => slot.remove());
  }, [catalog, content, maxBlocks, profile.tier, slug, title]);

  return (
    <>
      {placements.map((placement) => {
        if (!placement.slot.isConnected) return null;
        return createPortal(
          <InlineAffiliateCard
            product={placement.product}
            slug={slug}
            sectionTitle={placement.sectionTitle}
          />,
          placement.slot,
          placement.id,
        );
      })}
    </>
  );
}

/**
 * Smart affiliate-motor för bloggen. Fel i produktdelen fångas lokalt,
 * så att själva bloggartikeln alltid fortsätter visas.
 */
export function AffiliateProductBox(props: Props) {
  return (
    <AffiliateSafetyBoundary>
      <AffiliateProductBoxContent {...props} />
    </AffiliateSafetyBoundary>
  );
}

export default AffiliateProductBox;
