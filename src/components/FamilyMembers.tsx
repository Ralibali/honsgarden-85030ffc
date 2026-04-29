import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, Loader2, Crown, Trash2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FarmMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { display_name: string | null; email: string | null };
}

export function FamilyMembers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');

  // Get farm members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['farm-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_members')
        .select('id, user_id, role, joined_at')
        .order('joined_at');
      if (error) throw error;
      
      // Enrich with profile info - own profile directly, co-members via safe function
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .eq('user_id', user!.id)
        .single();
      
      const { data: coMemberProfiles } = await supabase
        .rpc('get_farm_member_display_names', { _uid: user!.id });
      
      const profiles = [
        ...(ownProfile ? [ownProfile] : []),
        ...(coMemberProfiles || []).map((p: any) => ({ ...p, email: null })),
      ];
      
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      
      return (data as any[]).map((m: any) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      })) as FarmMember[];
    },
    enabled: !!user?.id,
  });

  // Get pending invitations
  const { data: invitations = [] } = useQuery({
    queryKey: ['farm-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_invitations')
        .select('id, email, status, created_at, expires_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  const isOwner = members.some(m => m.user_id === user?.id && m.role === 'owner');

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('manage-farm', {
        body: { action: 'invite', email },
      });
      if (error) {
        // Try to parse the error body for a user-friendly message
        const errorBody = typeof error === 'object' && 'context' in error ? (error as any).context : null;
        let msg = 'Kunde inte bjuda in';
        try {
          if (errorBody?.body) {
            const parsed = JSON.parse(await errorBody.body.text());
            msg = parsed.error || msg;
          }
        } catch (parseErr) {
          console.warn('[FamilyMembers] Kunde inte tolka felsvar från invite-funktionen:', parseErr);
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Inbjudan skickad! 📬', description: `En inbjudan har skickats till ${inviteEmail}` });
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['farm-invitations'] });
    },
    onError: (err: any) => toast({ title: 'Kunde inte bjuda in', description: err.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-farm', {
        body: { action: 'remove-member', member_id: memberId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Medlem borttagen' });
      queryClient.invalidateQueries({ queryKey: ['farm-members'] });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return null;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Familjemedlemmar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Bjud in familjen så alla kan logga ägg och hantera gården tillsammans.
        </p>

        {/* Current members */}
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {(member.profile?.display_name || member.profile?.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    {member.profile?.display_name || member.profile?.email || 'Okänd'}
                    {member.role === 'owner' && <Crown className="h-3 w-3 text-warning" />}
                    {member.user_id === user?.id && <span className="text-[10px] text-muted-foreground">(du)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.role === 'owner' ? 'Ägare' : 'Medlem'}
                    {member.profile?.email && member.user_id !== user?.id && ` · ${member.profile.email}`}
                  </p>
                </div>
              </div>
              {isOwner && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMutation.mutate(member.id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Väntande inbjudningar</p>
            {invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-border/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-foreground">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Skickad {new Date(inv.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite form (only for owners) */}
        {isOwner && (
          <div className="flex gap-2 pt-1">
            <Input
              type="email"
              placeholder="E-post till familjemedlem..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-10 rounded-xl flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inviteEmail.trim()) {
                  inviteMutation.mutate(inviteEmail.trim());
                }
              }}
            />
            <Button
              className="h-10 rounded-xl gap-1.5"
              onClick={() => inviteMutation.mutate(inviteEmail.trim())}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Bjud in
            </Button>
          </div>
        )}

        {!isOwner && members.length > 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Bara gårdsägaren kan bjuda in nya medlemmar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
