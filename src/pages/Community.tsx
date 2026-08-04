import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Send, Share2, Users, Lightbulb, Loader2, Flag, Pin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/PageHeader';

type CommunityPost = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  is_pinned: boolean;
  likes: number;
  comments: number;
  liked: boolean;
};

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Nyss';
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Igår';
  if (days < 7) return `${days} dagar sedan`;
  return date.toLocaleDateString('sv-SE');
}

function makeTitle(content: string) {
  const firstLine = content.trim().split('\n')[0] || 'Inlägg från communityt';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

export default function Community() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Community | Hönsgården';
  }, []);

  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['community-posts'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;

      const { data: rawPosts, error: postsError } = await (supabase as any)
        .from('community_posts')
        .select('id,user_id,title,content,category,created_at,is_pinned')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (postsError) throw postsError;

      const ids = (rawPosts ?? []).map((post: any) => post.id);
      if (!ids.length) return [] as CommunityPost[];

      const [{ data: reactions }, { data: comments }] = await Promise.all([
        (supabase as any)
          .from('community_reactions')
          .select('id,post_id,user_id,reaction_type')
          .in('post_id', ids),
        (supabase as any)
          .from('community_comments')
          .select('id,post_id')
          .in('post_id', ids),
      ]);

      return (rawPosts ?? []).map((post: any) => {
        const postReactions = (reactions ?? []).filter((reaction: any) => reaction.post_id === post.id && reaction.reaction_type === 'like');
        return {
          id: post.id,
          user_id: post.user_id,
          title: post.title,
          content: post.content,
          category: post.category || 'Fråga',
          created_at: post.created_at,
          is_pinned: !!post.is_pinned,
          likes: postReactions.length,
          comments: (comments ?? []).filter((comment: any) => comment.post_id === post.id).length,
          liked: !!currentUserId && postReactions.some((reaction: any) => reaction.user_id === currentUserId),
        } as CommunityPost;
      });
    },
  });

  const publishPost = useMutation({
    mutationFn: async () => {
      const trimmed = message.trim();
      if (trimmed.length < 5) throw new Error('Skriv minst några ord först.');

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Du behöver vara inloggad för att skriva i communityt.');

      const { error } = await (supabase as any)
        .from('community_posts')
        .insert({
          user_id: userData.user.id,
          title: makeTitle(trimmed),
          content: trimmed,
          category: 'Fråga',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      toast({ title: 'Inlägget är publicerat i communityt 💚' });
    },
    onError: (error: any) => {
      toast({ title: 'Kunde inte publicera', description: error.message, variant: 'destructive' });
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (post: CommunityPost) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Logga in för att gilla inlägg.');

      if (post.liked) {
        const { error } = await (supabase as any)
          .from('community_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userData.user.id)
          .eq('reaction_type', 'like');
        if (error) throw error;
        return;
      }

      const { error } = await (supabase as any)
        .from('community_reactions')
        .insert({ post_id: post.id, user_id: userData.user.id, reaction_type: 'like' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
    onError: (error: any) => toast({ title: 'Kunde inte uppdatera gillning', description: error.message, variant: 'destructive' }),
  });

  const reportPost = useMutation({
    mutationFn: async (post: CommunityPost) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Logga in för att rapportera inlägg.');

      const { error } = await (supabase as any)
        .from('community_reports')
        .insert({
          post_id: post.id,
          reported_by: userData.user.id,
          reason: 'Rapporterat från communityt',
          status: 'open',
        });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Tack, inlägget är rapporterat' }),
    onError: (error: any) => toast({ title: 'Kunde inte rapportera', description: error.message, variant: 'destructive' }),
  });

  const copyPost = async (post: CommunityPost) => {
    await navigator.clipboard?.writeText(post.content);
    toast({ title: 'Inlägget är kopierat' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-8">
      <PageHeader
        title="Community"
        emoji="🤝"
        subtitle="Dela tips, frågor och erfarenheter med andra hönsägare. Inlägg, gillningar och rapporter sparas nu i databasen."
        actions={(
          <Badge variant="secondary" className="w-fit gap-1.5 rounded-full px-3 py-1">
            <Users className="h-3.5 w-3.5" />
            {posts.length} inlägg
          </Badge>
        )}
      />

      <Card className="bg-gradient-to-br from-primary/8 via-card to-accent/5 border-primary/20 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-lg shrink-0">
              🐔
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <h2 className="font-serif text-lg text-foreground">Skriv ett inlägg</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Ställ en fråga, dela ett tips eller berätta vad som händer i din hönsgård.
                </p>
              </div>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="T.ex. Mina hönor värper mindre efter foderbytet – någon som varit med om samma?"
                className="min-h-[110px] rounded-2xl resize-none bg-background/80"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Inlägget blir synligt för andra när databasen tillåter publicering via RLS.
                </p>
                <Button className="rounded-xl gap-2 w-full sm:w-auto" disabled={message.trim().length < 5 || publishPost.isPending} onClick={() => publishPost.mutate()}>
                  {publishPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicera
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard icon="🥚" title="Fråga om ägg" text="Foder, värpning, skal, försäljning och konstiga äggfenomen." />
        <InfoCard icon="🐓" title="Dela vardagstips" text="Smarta lösningar från riktiga hönshus och små gårdar." />
        <InfoCard icon="🌿" title="Lär av andra" text="Se hur andra löser kyla, värme, kläckning och flockbeteenden." />
      </div>

      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-5 text-center space-y-3">
            <p className="text-sm text-destructive">Kunde inte läsa community-inlägg från databasen.</p>
            <Button variant="outline" className="rounded-xl" onClick={() => refetch()}>Försök igen</Button>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-8 text-center">
            <Users className="h-9 w-9 mx-auto text-muted-foreground/50 mb-2" />
            <h2 className="font-serif text-lg text-foreground">Inga inlägg ännu</h2>
            <p className="text-sm text-muted-foreground mt-1">Bli först med att skriva något i Hönsgårdens community.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="bg-card border-border shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {post.user_id ? '👤' : '🐔'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Hönsägare</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center shrink-0">
                    {post.is_pinned && <Badge className="rounded-full gap-1"><Pin className="h-3 w-3" /> Fäst</Badge>}
                    <Badge variant="secondary" className="rounded-full">{post.category || 'Fråga'}</Badge>
                  </div>
                </div>

                <h2 className="font-serif text-base text-foreground mb-2 break-words">{post.title}</h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-4">
                  {post.content}
                </p>

                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <button
                    className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                    onClick={() => toggleLike.mutate(post)}
                  >
                    <Heart className={`h-4 w-4 ${post.liked ? 'fill-current' : ''}`} />
                    {post.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <MessageCircle className="h-4 w-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-auto" onClick={() => reportPost.mutate(post)}>
                    <Flag className="h-4 w-4" />
                    <span className="hidden sm:inline">Rapportera</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => copyPost(post)}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Kopiera</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-dashed bg-muted/20">
        <CardContent className="p-4 sm:p-5 flex gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-base text-foreground">Databaskopplat community</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Communityt använder nu Supabase-tabellerna för inlägg, gillningar och rapporter. Admin kan moderera via adminpanelen.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <span className="text-2xl block mb-2">{icon}</span>
        <h3 className="font-serif text-sm text-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
