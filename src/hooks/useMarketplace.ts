import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketplaceCategory, MarketplaceListing, MarketplaceMessage } from '@/lib/marketplace';

export interface ListingFilters {
  search?: string;
  category?: MarketplaceCategory | 'all';
  region?: string | 'all';
  sort?: 'newest' | 'price_asc' | 'price_desc';
  hasImage?: boolean;
}

export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: async () => {
      let q = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active')
        .limit(60);

      if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category);
      if (filters.region && filters.region !== 'all') q = q.eq('region', filters.region);
      if (filters.search?.trim()) q = q.ilike('title', `%${filters.search.trim()}%`);

      if (filters.sort === 'price_asc') q = q.order('price', { ascending: true, nullsFirst: false });
      else if (filters.sort === 'price_desc') q = q.order('price', { ascending: false, nullsFirst: false });
      else q = q.order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as MarketplaceListing[];
      if (filters.hasImage) rows = rows.filter((r) => r.image_urls && r.image_urls.length > 0);
      return rows;
    },
    staleTime: 30_000,
  });
}

export function useListingBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-listing', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data as MarketplaceListing | null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useMyListings(userId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-mine', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketplaceListing[];
    },
    enabled: !!userId,
  });
}

/** Trådar = en konversation per (listing, motpart). */
export interface Thread {
  listing_id: string;
  other_user_id: string;
  last_message: MarketplaceMessage;
  unread_count: number;
  listing?: Pick<MarketplaceListing, 'title' | 'slug' | 'image_urls' | 'user_id'>;
  other_name?: string;
}

export function useThreads(userId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-threads', userId],
    queryFn: async (): Promise<Thread[]> => {
      if (!userId) return [];
      const { data: msgs, error } = await supabase
        .from('marketplace_messages')
        .select('*')
        .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const list = (msgs ?? []) as MarketplaceMessage[];

      const map = new Map<string, Thread>();
      for (const m of list) {
        const other = m.sender_user_id === userId ? m.recipient_user_id : m.sender_user_id;
        const key = `${m.listing_id}|${other}`;
        if (!map.has(key)) {
          map.set(key, {
            listing_id: m.listing_id,
            other_user_id: other,
            last_message: m,
            unread_count: 0,
          });
        }
        const t = map.get(key)!;
        if (m.recipient_user_id === userId && !m.read_at) t.unread_count += 1;
      }

      const threads = Array.from(map.values());
      if (threads.length === 0) return threads;

      // Hämta listing + namn
      const listingIds = [...new Set(threads.map((t) => t.listing_id))];
      const userIds = [...new Set(threads.map((t) => t.other_user_id))];

      const [{ data: listings }, { data: profiles }] = await Promise.all([
        supabase
          .from('marketplace_listings')
          .select('id, title, slug, image_urls, user_id')
          .in('id', listingIds),
        supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds),
      ]);

      const lMap = new Map((listings ?? []).map((l: any) => [l.id, l]));
      const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      return threads.map((t) => ({
        ...t,
        listing: lMap.get(t.listing_id) as any,
        other_name: (pMap.get(t.other_user_id) as any)?.display_name ?? 'Användare',
      }));
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

export function useThreadMessages(listingId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-thread', listingId, otherUserId],
    queryFn: async () => {
      if (!listingId || !otherUserId) return [];
      const { data, error } = await supabase
        .from('marketplace_messages')
        .select('*')
        .eq('listing_id', listingId)
        .or(`sender_user_id.eq.${otherUserId},recipient_user_id.eq.${otherUserId}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarketplaceMessage[];
    },
    enabled: !!listingId && !!otherUserId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { listing_id: string; recipient_user_id: string; content: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const sender = auth.user?.id;
      if (!sender) throw new Error('Du måste vara inloggad');
      const { data, error } = await supabase
        .from('marketplace_messages')
        .insert({
          listing_id: input.listing_id,
          sender_user_id: sender,
          recipient_user_id: input.recipient_user_id,
          content: input.content.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-thread'] });
      qc.invalidateQueries({ queryKey: ['marketplace-threads'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { listing_id: string; other_user_id: string; me: string }) => {
      const { error } = await supabase
        .from('marketplace_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('listing_id', input.listing_id)
        .eq('sender_user_id', input.other_user_id)
        .eq('recipient_user_id', input.me)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-threads'] }),
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketplace_listings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-mine'] }),
  });
}

export function useUpdateListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'active' | 'sold' | 'hidden' }) => {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ status: input.status })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-mine'] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] });
    },
  });
}

export function useReportListing() {
  return useMutation({
    mutationFn: async (input: { listing_id: string; reason: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Logga in för att rapportera');
      const { error } = await supabase
        .from('marketplace_reports')
        .insert({
          listing_id: input.listing_id,
          reported_by: auth.user.id,
          reason: input.reason.trim(),
        });
      if (error) throw error;
    },
  });
}

export async function incrementView(slug: string) {
  try { await supabase.rpc('increment_marketplace_view', { _slug: slug }); } catch {}
}
