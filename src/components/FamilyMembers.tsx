import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, UserPlus, Loader2, Crown, Trash2, Mail, ShieldCheck, Eye, ChevronDown, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type FarmRole = 'owner' | 'editor' | 'viewer';

interface FarmMember {
  id: string;
  user_id: string;
  role: FarmRole;
  joined_at: string;
  profile?: { display_name: string | null; email: string | null };
}

const ROLE_META: Record<FarmRole, { label: string; icon: typeof Crown; chipClass: string }> = {
  owner: { label: 'Ägare', icon: Crown, chipClass: 'bg-warning/15 text-warning' },
  editor: { label: 'Redigerare', icon: Pencil, chipClass: 'bg-primary/15 text-primary' },
  viewer: { label: 'Tittare', icon: Eye, chipClass: 'bg-muted text-muted-foreground' },
};

export function FamilyMembers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['farm-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_members')
        .select('id, user_id, role, joined_at')
        .order('joined_at');
      if (error) throw error;

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
    staleTime: 5 * 60 * 1000,
  });

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
    mutationFn: async ({ email, role }: { email: string; role: 'editor' | 'viewer' }) => {
      const { data, error } = await supabase.functions.invoke('manage-farm', {
        body: { action: 'invite', email, role },
      });
      if (error) {
        let msg = 'Kunde inte bjuda in';
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const parsed = await ctx.json();
            msg = parsed?.error || msg;
          }
        } catch (parseErr) {
          console.warn('[FamilyMembers] Kunde inte tolka felsvar:', parseErr);
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Inbjudan skickad! 📬', description: `En inbjudan har skickats till ${inviteEmail}` });
      setInviteEmail('');
      setInviteRole('editor');
      setInviteOpen(false);
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

  const roleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'editor' | 'viewer' }) => {
      const { data, error } = await supabase.functions.invoke('manage-farm', {
        body: { action: 'update-member-role', member_id: memberId, role },
      });
      if (error) {
        let msg = 'Kunde inte ändra roll';
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const parsed = await ctx.json();
            msg = parsed?.error || msg;
          }
        } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_data, vars) => {
      toast({ title: 'Roll uppdaterad', description: `Medlemmen är nu ${ROLE_META[vars.role].label.toLowerCase()}.` });
      queryClient.invalidateQueries({ queryKey: ['farm-members'] });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return null;

  const onlyOwner = members.length === 1 && members[0].role === 'owner';

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
          Bjud in familjen så ni kan sköta hönsen tillsammans. Välj <strong>Redigerare</strong> för att tillåta loggning eller <strong>Tittare</strong> för bara läsbehörighet.
        </p>

        {onlyOwner && isOwner && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-sm text-foreground font-medium">Bjud in din partner eller familj</p>
            <p className="text-xs text-muted-foreground mt-1">Så kan ni sköta hönsen tillsammans.</p>
          </div>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {members.map((member) => {
            const meta = ROLE_META[member.role] || ROLE_META.viewer;
            const RoleIcon = meta.icon;
            const isMe = member.user_id === user?.id;
            const canManage = isOwner && member.role !== 'owner';

            return (
              <div key={member.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {(member.profile?.display_name || member.profile?.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                      {member.profile?.display_name || member.profile?.email || 'Okänd'}
                      {isMe && <span className="text-[10px] text-muted-foreground">(du)</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${meta.chipClass}`}>
                        <RoleIcon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                      {member.profile?.email && !isMe && (
                        <span className="text-[11px] text-muted-foreground truncate">· {member.profile.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" disabled={roleMutation.isPending}>
                          Roll <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => member.role !== 'editor' && roleMutation.mutate({ memberId: member.id, role: 'editor' })}
                          className={member.role === 'editor' ? 'bg-accent' : ''}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          <div>
                            <p className="text-xs font-medium">Redigerare</p>
                            <p className="text-[10px] text-muted-foreground">Kan se och ändra</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => member.role !== 'viewer' && roleMutation.mutate({ memberId: member.id, role: 'viewer' })}
                          className={member.role === 'viewer' ? 'bg-accent' : ''}
                        >
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          <div>
                            <p className="text-xs font-medium">Tittare</p>
                            <p className="text-[10px] text-muted-foreground">Kan bara se</p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate(member.id)}
                      disabled={removeMutation.isPending}
                      aria-label="Ta bort medlem"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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

        {/* Invite dialog */}
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-10 rounded-xl gap-1.5">
                <UserPlus className="h-4 w-4" /> Bjud in familjemedlem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif">Bjud in till gården</DialogTitle>
                <DialogDescription>
                  Personen får ett mejl med en länk som gäller i 7 dagar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs">E-postadress</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="namn@exempel.se"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Roll</Label>
                  <RadioGroup value={inviteRole} onValueChange={(v) => setInviteRole(v as 'editor' | 'viewer')} className="gap-2">
                    <label htmlFor="role-editor" className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value="editor" id="role-editor" className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Pencil className="h-3.5 w-3.5 text-primary" /> Redigerare
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Kan se all data och lägga till ägg, höns, hälsohändelser m.m. Kan inte ta bort medlemmar eller radera gården.
                        </p>
                      </div>
                    </label>
                    <label htmlFor="role-viewer" className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value="viewer" id="role-viewer" className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Tittare
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Kan bara se data, kan inte ändra något.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Avbryt</Button>
                <Button
                  onClick={() => inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole })}
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  className="gap-1.5"
                >
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Skicka inbjudan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
