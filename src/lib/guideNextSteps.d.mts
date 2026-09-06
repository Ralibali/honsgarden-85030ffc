export type GuideNextStep = {
  title: string;
  body: string;
  primary: { href: string; label: string };
  related: { href: string; label: string };
};
export const GUIDE_NEXT_STEPS: Record<string, GuideNextStep>;
export function injectGuideNextSteps(html?: string, slug?: string | null): string;
