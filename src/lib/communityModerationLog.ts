import { supabase } from '@/integrations/supabase/client';

export type ModerationAction =
  | 'delete_post'
  | 'delete_comment'
  | 'pin'
  | 'unpin'
  | 'mark_sold'
  | 'unmark_sold'
  | 'edit_post'
  | 'edit_comment';

interface LogParams {
  action: ModerationAction;
  targetType: 'post' | 'comment';
  targetId: string;
  targetUserId?: string | null;
  snapshot?: Record<string, any> | null;
  reason?: string | null;
}

/**
 * Logs an admin moderation action to community_moderation_log.
 * Silent fail-safe: never throws – moderation should not be blocked by logging errors.
 */
export async function logModerationAction(params: LogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let moderatorName: string | null = null;
    let targetUserName: string | null = null;

    const { data: modProfile } = await (supabase as any)
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    moderatorName = modProfile?.display_name || modProfile?.email || null;

    if (params.targetUserId) {
      const { data: targetProfile } = await (supabase as any)
        .from('profiles')
        .select('display_name, email')
        .eq('user_id', params.targetUserId)
        .maybeSingle();
      targetUserName = targetProfile?.display_name || targetProfile?.email || null;
    }

    await (supabase as any).from('community_moderation_log').insert({
      moderator_id: user.id,
      moderator_name: moderatorName,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      target_user_id: params.targetUserId ?? null,
      target_user_name: targetUserName,
      snapshot: params.snapshot ?? null,
      reason: params.reason ?? null,
    });
  } catch (e) {
    console.warn('[moderation-log] failed to log', e);
  }
}
