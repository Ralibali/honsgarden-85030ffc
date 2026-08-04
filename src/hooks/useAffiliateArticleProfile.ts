import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AffiliateAdTier = 'normal' | 'strong' | 'hot';

export interface AffiliateArticleProfile {
  views30d: number;
  uniqueVisitors30d: number;
  rank30d: number | null;
  articleCount: number;
  percentile: number;
  tier: AffiliateAdTier;
  maxBlocks: number;
}

const DEFAULT_PROFILE: AffiliateArticleProfile = {
  views30d: 0,
  uniqueVisitors30d: 0,
  rank30d: null,
  articleCount: 0,
  percentile: 0,
  tier: 'normal',
  maxBlocks: 2,
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useAffiliateArticleProfile(slug: string): AffiliateArticleProfile {
  const { data } = useQuery({
    queryKey: ['affiliate-article-profile', slug],
    enabled: Boolean(slug),
    queryFn: async (): Promise<AffiliateArticleProfile> => {
      const client = supabase as any;
      const { data: rpcRows, error: rpcError } = await client.rpc(
        'get_affiliate_article_profile',
        { p_slug: slug },
      );

      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!rpcError && row) {
        const tier = ['normal', 'strong', 'hot'].includes(row.tier)
          ? row.tier as AffiliateAdTier
          : 'normal';
        return {
          views30d: numberValue(row.views_30d),
          uniqueVisitors30d: numberValue(row.unique_visitors_30d),
          rank30d: row.rank_30d == null ? null : numberValue(row.rank_30d),
          articleCount: numberValue(row.article_count),
          percentile: numberValue(row.percentile),
          tier,
          maxBlocks: Math.max(1, Math.min(5, numberValue(row.max_blocks) || 2)),
        };
      }

      const { data: post } = await supabase
        .from('blog_posts')
        .select('view_count')
        .eq('slug', slug)
        .maybeSingle();

      const lifetimeViews = numberValue(post?.view_count);
      if (lifetimeViews >= 1000) return { ...DEFAULT_PROFILE, tier: 'hot', maxBlocks: 5 };
      if (lifetimeViews >= 250) return { ...DEFAULT_PROFILE, tier: 'strong', maxBlocks: 4 };
      return DEFAULT_PROFILE;
    },
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });

  return data ?? DEFAULT_PROFILE;
}
