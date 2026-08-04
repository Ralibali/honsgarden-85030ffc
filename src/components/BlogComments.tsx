import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface Props {
  postId: string;
}

export default function BlogComments({ postId }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['blog-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim();
      if (!trimmed || !user?.id) return;
      const { error } = await supabase.from('blog_comments').insert({
        post_id: postId,
        user_id: user.id,
        display_name: user.name || 'Anonym',
        content: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['blog-comments', postId] });
      toast({ title: 'Kommentar publicerad!' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-comments', postId] });
    },
  });

  return (
    <section className="mt-12 pt-8 border-t border-border/50">
      <h2 className="font-serif text-xl text-foreground mb-5 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        Kommentarer ({comments.length})
      </h2>

      {/* Comment list */}
      <div className="space-y-4 mb-6">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {comments.map(c => (
          <div key={c.id} className="bg-card rounded-xl p-4 border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{c.display_name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {user?.id === c.user_id && (
                <button
                  onClick={() => deleteComment.mutate(c.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Inga kommentarer än – bli den första!</p>
        )}
      </div>

      {/* Add comment */}
      {isAuthenticated ? (
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Skriv en kommentar..."
            className="rounded-xl resize-none min-h-[80px]"
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{content.length}/1000</span>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => addComment.mutate()}
              disabled={!content.trim() || addComment.isPending}
            >
              {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicera'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 bg-card/50 rounded-xl border border-border/30">
          <p className="text-sm text-muted-foreground mb-2">Logga in för att kommentera</p>
          <Link to="/login">
            <Button size="sm" variant="outline" className="rounded-xl">Logga in</Button>
          </Link>
        </div>
      )}
    </section>
  );
}
