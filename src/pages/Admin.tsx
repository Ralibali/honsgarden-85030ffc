import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Crown, MessageSquare, BarChart3, Loader2, Trash2,
  Shield, TrendingUp, Egg, CheckCircle2, XCircle, Clock, FileCheck, Search, CalendarDays, BookOpen, Link2, Eye, Bell, Send, Mail, Lightbulb, RefreshCw
} from 'lucide-react';
import { DollarSign } from 'lucide-react';
import BlogEditor from '@/components/admin/BlogEditor';
import NotificationSender from '@/components/admin/NotificationSender';
import GlossaryManager from '@/components/admin/GlossaryManager';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import UserInsightsDashboard from '@/components/admin/UserInsightsDashboard';
import UserDetailModal from '@/components/admin/UserDetailModal';
import RevenueDashboard from '@/components/admin/RevenueDashboard';
import SeoAdmin from '@/components/admin/SeoAdmin';
import { MarketingOptInPanel } from '@/components/admin/MarketingOptInPanel';
import CommunityModerationLog from '@/components/admin/CommunityModerationLog';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function Admin() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [premiumDurations, setPremiumDurations] = useState<Record<string, string>>({});
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [brevoSyncing, setBrevoSyncing] = useState(false);
  const { data: adminCheck, isLoading: checkLoading, isError: checkError } = useQuery({
    queryKey: ['admin-check'],
    queryFn: () => api.adminCheck(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.adminStats(),
    enabled: !!adminCheck?.is_admin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.adminUsers(),
    enabled: !!adminCheck?.is_admin,
  });

  const { data: feedback = [], isLoading: feedbackLoading } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => api.adminFeedback(),
    enabled: !!adminCheck?.is_admin,
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({ title: 'Användare raderad' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.adminUpdateFeedbackStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      toast({ title: 'Feedback uppdaterad' });
    },
  });

  const replyFeedbackMutation = useMutation({
    mutationFn: ({ feedbackId, userId, message }: { feedbackId: string; userId: string; message: string }) =>
      api.adminReplyFeedback(feedbackId, userId, message),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      toast({ title: 'Svar skickat! 📩' });
      setReplyTexts((prev) => ({ ...prev, [vars.feedbackId]: '' }));
      setReplyingTo(null);
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const updateSubMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) =>
      api.adminUpdateSubscription(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['insights-profiles'] });
      toast({ title: 'Prenumeration uppdaterad' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  if (checkLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (checkError || !adminCheck?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Shield className="h-12 w-12 text-destructive/50" />
        <h2 className="font-serif text-xl text-foreground">Åtkomst nekad</h2>
        <p className="text-sm text-muted-foreground">Du har inte behörighet att se denna sida.</p>
      </div>
    );
  }

  const premiumCount = (users as any[]).filter((u: any) => u.subscription_status === 'premium').length;
  const termsAcceptedCount = (users as any[]).filter((u: any) => u.terms_accepted_at).length;

  const filteredUsers = userSearch
    ? (users as any[]).filter((u: any) =>
        (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
      )
    : (users as any[]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-serif text-foreground">Admin</h1>
          <p className="text-xs text-muted-foreground">
            Hantera användare, prenumerationer och feedback
            <span className="ml-2 opacity-60">· v{__BUILD_TIME__.slice(0, 16).replace('T', ' ')}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl text-xs gap-1.5"
          onClick={async () => {
            try {
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
            } catch (err) {
              console.warn('Cache clear failed', err);
            }
            const url = new URL(window.location.href);
            url.searchParams.set('_v', Date.now().toString());
            window.location.replace(url.toString());
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Uppdatera nu
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl text-xs gap-1.5"
          disabled={brevoSyncing}
          onClick={async () => {
            setBrevoSyncing(true);
            try {
              const { data, error } = await supabase.functions.invoke('sync-brevo');
              if (error) throw error;
              toast({ title: '✅ Brevo-synk klar', description: `${data?.synced ?? 0} kontakter synkade` });
            } catch (err: any) {
              toast({ title: 'Fel vid Brevo-synk', description: err.message, variant: 'destructive' });
            } finally {
              setBrevoSyncing(false);
            }
          }}
        >
          {brevoSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Synka Brevo
        </Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 stagger-children">
          {[
            { icon: Users, value: stats.user_count ?? 0, label: 'Användare', color: 'text-primary', bg: 'bg-primary/8' },
            { icon: Crown, value: premiumCount, label: 'Premium', color: 'text-warning', bg: 'bg-warning/8' },
            { icon: Egg, value: stats.egg_records ?? 0, label: 'Ägg totalt', color: 'text-accent', bg: 'bg-accent/8' },
            { icon: TrendingUp, value: stats.hen_count ?? 0, label: 'Hönor', color: 'text-success', bg: 'bg-success/8' },
            { icon: FileCheck, value: termsAcceptedCount, label: 'Villkor godkända', color: 'text-muted-foreground', bg: 'bg-muted/60' },
          ].map(({ icon: Icon, value, label, color, bg }, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="stat-number text-xl text-foreground">{value}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1 h-auto rounded-xl p-1">
          <TabsTrigger value="insights" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Lightbulb className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Insikter</span><span className="sm:hidden">💡</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs sm:text-sm gap-1 rounded-lg">
            <DollarSign className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Intäkter</span><span className="sm:hidden">💰</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Analys</span><span className="sm:hidden">📊</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Users className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Användare</span><span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Crown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Pren.</span><span className="sm:hidden">Prem</span>
          </TabsTrigger>
          <TabsTrigger value="blog" className="text-xs sm:text-sm gap-1 rounded-lg">
            <BookOpen className="h-3.5 w-3.5" /> Blogg
          </TabsTrigger>
          <TabsTrigger value="seo" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Search className="h-3.5 w-3.5" /> SEO
          </TabsTrigger>
          <TabsTrigger value="glossary" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Link2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Länkord</span><span className="sm:hidden">Länkar</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="text-xs sm:text-sm gap-1 rounded-lg">
            <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Feedback</span><span className="sm:hidden">FB</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Bell className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Notiser</span><span className="sm:hidden">🔔</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs sm:text-sm gap-1 rounded-lg">
            <Mail className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Marknad</span><span className="sm:hidden">📧</span>
          </TabsTrigger>
          <TabsTrigger value="moderation" className="text-xs sm:text-sm gap-1 rounded-lg">
            <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Moderation</span><span className="sm:hidden">🛡️</span>
          </TabsTrigger>
        </TabsList>

        {/* Insights tab */}
        <TabsContent value="insights" className="space-y-3">
          <UserInsightsDashboard />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-3">
          <RevenueDashboard />
        </TabsContent>

        {/* Analytics tab */}
        <TabsContent value="analytics" className="space-y-3">
          <AnalyticsDashboard />
        </TabsContent>

        {/* Users tab */}
        <TabsContent value="users" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök användare..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !filteredUsers.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga användare hittades.</p>
          ) : (
             <div className="space-y-2">
              {filteredUsers.map((user: any) => (
                <Card key={user.id} className="border-border/50">
                  <CardContent className="p-3 sm:p-4 space-y-2.5">
                    {/* Top row: avatar + info + action icons */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(user.display_name || user.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.display_name || 'Namnlös'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        {user.coop_name && (
                          <p className="text-[10px] text-primary/70 truncate">🏡 {user.coop_name}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary/60 hover:text-primary"
                          onClick={() => setSelectedUser(user)}
                          title="Visa detaljer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-serif">Radera användare?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Detta raderar <strong>{user.email}</strong> och all deras data permanent.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Avbryt</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                onClick={() => deleteUserMutation.mutate(user.user_id)}
                              >
                                Radera
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {user.subscription_status === 'premium' && (
                        <Badge variant="secondary" className="text-[9px] bg-warning/10 text-warning border-warning/20">
                          <Crown className="h-2.5 w-2.5 mr-0.5" /> Premium
                        </Badge>
                      )}
                      {user.terms_accepted_at ? (
                        <Badge variant="secondary" className="text-[9px] bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Godkänt
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                          <XCircle className="h-2.5 w-2.5 mr-0.5" /> Ej godkänt
                        </Badge>
                      )}
                      {user.subscription_status === 'premium' && user.premium_expires_at && !user.is_lifetime_premium && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />
                          Går ut {new Date(user.premium_expires_at).toLocaleDateString('sv-SE')}
                        </span>
                      )}
                      {user.subscription_status === 'premium' && user.is_lifetime_premium && (
                        <span className="text-[9px] text-success font-medium">♾️ Livstid</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('sv-SE') : '–'}
                      </span>
                    </div>

                    {/* Premium actions row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Select value={premiumDurations[user.user_id] || '7'} onValueChange={(v) => setPremiumDurations(prev => ({ ...prev, [user.user_id]: v }))}>
                        <SelectTrigger className="h-7 w-[90px] text-[10px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 dagar</SelectItem>
                          <SelectItem value="14">14 dagar</SelectItem>
                          <SelectItem value="30">30 dagar</SelectItem>
                          <SelectItem value="90">90 dagar</SelectItem>
                          <SelectItem value="365">1 år</SelectItem>
                          <SelectItem value="lifetime">♾️ Livstid</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 rounded-lg"
                        onClick={() => updateSubMutation.mutate({ userId: user.user_id, data: { is_premium: true, days: premiumDurations[user.user_id] || '7' } })}
                      >
                        <Crown className="h-3 w-3 mr-1" /> {user.subscription_status === 'premium' ? '+' : 'Ge Premium'}
                      </Button>
                      {user.subscription_status === 'premium' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 text-destructive rounded-lg"
                          onClick={() => updateSubMutation.mutate({ userId: user.user_id, data: { is_premium: false } })}
                        >
                          Ta bort
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Subscriptions tab - uses same users data */}
        <TabsContent value="subscriptions" className="space-y-3">
          {usersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {(users as any[]).map((user: any) => (
                <Card key={user.id} className="border-border/50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{user.display_name || user.email || '–'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className={`text-[9px] ${
                              user.subscription_status === 'premium'
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {user.subscription_status === 'premium' ? '✅ Premium' : 'Gratis'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Sedan {new Date(user.created_at).toLocaleDateString('sv-SE')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 items-center">
                        <Select value={premiumDurations[user.user_id] || '7'} onValueChange={(v) => setPremiumDurations(prev => ({ ...prev, [user.user_id]: v }))}>
                          <SelectTrigger className="h-7 w-[90px] text-[10px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 dagar</SelectItem>
                            <SelectItem value="14">14 dagar</SelectItem>
                            <SelectItem value="30">30 dagar</SelectItem>
                            <SelectItem value="90">90 dagar</SelectItem>
                            <SelectItem value="365">1 år</SelectItem>
                            <SelectItem value="lifetime">♾️ Livstid</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 rounded-lg"
                          onClick={() => updateSubMutation.mutate({ userId: user.user_id, data: { is_premium: true, days: premiumDurations[user.user_id] || '7' } })}
                        >
                          <Crown className="h-3 w-3 mr-1" /> {user.subscription_status === 'premium' ? '+' : 'Ge'}
                        </Button>
                        {user.subscription_status === 'premium' && (
                          <div className="flex flex-col items-end gap-1">
                            {user.is_lifetime_premium ? (
                              <span className="text-[9px] text-success font-medium">♾️ Livstid</span>
                            ) : user.premium_expires_at ? (
                              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-2.5 w-2.5" />
                                Går ut {new Date(user.premium_expires_at).toLocaleDateString('sv-SE')}
                              </span>
                            ) : (
                              <span className="text-[9px] text-warning font-medium">⚠️ Saknar slutdatum</span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7 text-destructive rounded-lg"
                              onClick={() => updateSubMutation.mutate({ userId: user.user_id, data: { is_premium: false } })}
                            >
                              Ta bort Premium
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Blog tab */}
        <TabsContent value="blog" className="space-y-3">
          <BlogEditor />
        </TabsContent>

        <TabsContent value="seo" className="space-y-3">
          <SeoAdmin />
        </TabsContent>

        {/* Glossary tab */}
        <TabsContent value="glossary" className="space-y-3">
          <GlossaryManager />
        </TabsContent>

        {/* Feedback tab */}
        <TabsContent value="feedback" className="space-y-3">
          {feedbackLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !(feedback as any[]).length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen feedback ännu.</p>
          ) : (
            <div className="space-y-2">
              {(feedback as any[]).map((fb: any) => (
                <Card key={fb.id} className="border-border/50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        fb.status === 'resolved' ? 'bg-success/10' :
                        fb.status === 'in_progress' ? 'bg-warning/10' :
                        fb.status === 'support' ? 'bg-primary/10' :
                        'bg-muted/60'
                      }`}>
                        {fb.status === 'resolved' ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                         fb.status === 'in_progress' ? <Clock className="h-4 w-4 text-warning" /> :
                         <MessageSquare className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-xs font-semibold text-foreground">
                            {fb.sender_label || fb.profile?.display_name || `Användare ${String(fb.user_id).slice(0, 8)}`}
                          </p>
                          {fb.profile?.email ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Mail className="h-2.5 w-2.5" /> {fb.profile.email}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">ID: {String(fb.user_id).slice(0, 8)}…</span>
                          )}
                          {fb.status === 'support' && (
                            <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary border-primary/20">Support</Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{fb.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {fb.created_at ? new Date(fb.created_at).toLocaleDateString('sv-SE') : '–'}
                        </p>
                      </div>
                    </div>

                    {/* Reply form */}
                    {replyingTo === fb.id && (
                      <div className="mt-3 space-y-2 animate-fade-in">
                        <Textarea
                          placeholder="Skriv ditt svar till användaren..."
                          value={replyTexts[fb.id] || ''}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                          rows={3}
                          className="text-xs rounded-xl"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <Button variant="outline" size="sm" className="text-[10px] h-7 rounded-lg" onClick={() => setReplyingTo(null)}>
                            Avbryt
                          </Button>
                          <Button size="sm" className="text-[10px] h-7 rounded-lg gap-1"
                            disabled={!replyTexts[fb.id]?.trim() || replyFeedbackMutation.isPending}
                            onClick={() => replyFeedbackMutation.mutate({ feedbackId: fb.id, userId: fb.user_id, message: replyTexts[fb.id].trim() })}>
                            {replyFeedbackMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Skicka svar
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5 mt-3 justify-end">
                      {replyingTo !== fb.id && fb.profile?.email && (
                        <Button variant="outline" size="sm" className="text-[10px] h-7 rounded-lg gap-1 text-primary"
                          onClick={() => setReplyingTo(fb.id)}>
                          <Send className="h-3 w-3" /> Svara
                        </Button>
                      )}
                      {fb.status !== 'in_progress' && (
                        <Button variant="outline" size="sm" className="text-[10px] h-7 rounded-lg"
                          onClick={() => updateFeedbackMutation.mutate({ id: fb.id, status: 'in_progress' })}>
                          <Clock className="h-3 w-3 mr-1" /> Pågår
                        </Button>
                      )}
                      {fb.status !== 'resolved' && (
                        <Button variant="outline" size="sm" className="text-[10px] h-7 text-success rounded-lg"
                          onClick={() => updateFeedbackMutation.mutate({ id: fb.id, status: 'resolved' })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Löst
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications" className="space-y-3">
          <NotificationSender />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-3">
          <MarketingOptInPanel />
        </TabsContent>

        <TabsContent value="moderation" className="space-y-3">
          <CommunityModerationLog />
        </TabsContent>
      </Tabs>

      <UserDetailModal
        userId={selectedUser?.user_id || null}
        userName={selectedUser?.display_name || 'Namnlös'}
        userEmail={selectedUser?.email || ''}
        open={!!selectedUser}
        onOpenChange={(open) => { if (!open) setSelectedUser(null); }}
      />
    </div>
  );
}
