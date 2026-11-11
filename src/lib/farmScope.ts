import { supabase } from '@/integrations/supabase/client';
import { withRequestTimeout } from './requestTimeout';

export async function getUserId(): Promise<string> {
  const { data: { session } } = await withRequestTimeout(() => supabase.auth.getSession());
  if (!session?.user.id) throw new Error('Not authenticated');
  return session.user.id;
}

// RLS also permits administrative reads. Farm screens explicitly select the
// signed-in member's farm. Only share an in-flight lookup, never old membership.
const lookups = new Map<string, Promise<string[]>>();

export async function getFarmUserIds(accountId?: string): Promise<string[]> {
  const id = accountId ?? await getUserId();
  const current = lookups.get(id);
  if (current) return current;
  const lookup = withRequestTimeout(async (signal) => {
    const { data, error } = await supabase.rpc('get_farm_user_ids', { _uid: id }).abortSignal(signal);
    if (error) throw new Error(error.message);
    return [...new Set([id, ...(data ?? [])])];
  }).finally(() => lookups.delete(id));
  lookups.set(id, lookup);
  return lookup;
}
