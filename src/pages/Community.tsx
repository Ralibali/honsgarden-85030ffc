import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Send, Share2, Sparkles, Users, Lightbulb } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type CommunityPost = {
  id: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
  tag?: string;
  liked?: boolean;
};

const starterPosts: CommunityPost[] = [
  {
    id: 'starter-1',
    author: 'Anna L.',
    avatar: '👩‍🌾',
    time: '2 timmar sedan',
    tag: 'Äggläggning',
    content: 'Min Barnevelder la sitt första dubbelgulor idag! 🎉 Har ni varit med om samma sak? Är det något särskilt jag borde hålla koll på?',
    likes: 12,
    comments: 5,
  },
  {
    id: 'starter-2',
    author: 'Karl S.',
    avatar: '👨‍🌾',
    time: '5 timmar sedan',
    tag: 'Foder',
    content: 'Testar nytt ekologiskt foder den här veckan. Hönorna verkar gilla det mer än det gamla. Ska bli spännande att se om produktionen påverkas.',
    likes: 8,
    comments: 3,
  },
  {
    id: 'starter-3',
    author: 'Maria G.',
    avatar: '👩‍🌾',
    time: 'Igår',
    tag: 'Tips',
    content: 'Vintertips: häng ett kålhuvud i hönshuset. Mina blir mer aktiva och det verkar minska hackning. 🥬🐔',
    likes: 24,
    comments: 7,
  },
];

const storageKey = 'honsgarden-community-local-posts-v1';

export default function Community() {
  const [message, setMessage] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>(starterPosts);

  useEffect(() => {
    document.title = 'Community | Hönsgården';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPosts([...parsed, ...starterPosts]);
      }
    } catch {
      // Ignore localStorage issues.
    }
  }, []);

  const localPosts = useMemo(() => posts.filter((post) => post.id.startsWith('local-')), [posts]);

  const saveLocalPosts = (nextLocalPosts: CommunityPost[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextLocalPosts));
    } catch {
      // Ignore localStorage issues.
    }
  };

  const publishPost = () => {
    const trimmed = message.trim();
    if (trimmed.length < 5) return;

    const newPost: CommunityPost = {
      id: `local-${Date.now()}`,
      author: 'Du',
      avatar: '🐔',
      time: 'Nyss',
      tag: 'Fråga',
      content: trimmed,
      likes: 0,
      comments: 0,
    };

    const nextPosts = [newPost, ...posts];
    setPosts(nextPosts);
    saveLocalPosts([newPost, ...localPosts]);
    setMessage('');
    toast({ title: 'Inlägget är publicerat i communityt 💚' });
  };

  const toggleLike = (postId: string) => {
    const nextPosts = posts.map((post) => {
      if (post.id !== postId) return post;
      const liked = !post.liked;
      return {
        ...post,
        liked,
        likes: liked ? post.likes + 1 : Math.max(0, post.likes - 1),
      };
    });
    setPosts(nextPosts);
    saveLocalPosts(nextPosts.filter((post) => post.id.startsWith('local-')));
  };

  const copyPost = async (post: CommunityPost) => {
    await navigator.clipboard?.writeText(post.content);
    toast({ title: 'Inlägget är kopierat' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="data-label mb-1">Hönsägare emellan</p>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Community 🤝</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Dela tips, frågor och erfarenheter med andra hönsägare. Här hör vardagsproblemen, smarta knepen och små segrar hemma.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 rounded-full px-3 py-1">
          <Users className="h-3.5 w-3.5" />
          {posts.length} inlägg
        </Badge>
      </div>

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
                  Inlägg sparas lokalt i webbläsaren tills communityt kopplas till databasen.
                </p>
                <Button className="rounded-xl gap-2 w-full sm:w-auto" disabled={message.trim().length < 5} onClick={publishPost}>
                  <Send className="h-4 w-4" />
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

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="bg-card border-border shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                    {post.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.author}</p>
                    <p className="text-xs text-muted-foreground">{post.time}</p>
                  </div>
                </div>
                {post.tag && (
                  <Badge variant="secondary" className="shrink-0 rounded-full">
                    {post.tag}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-4">
                {post.content}
              </p>

              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <button
                  className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart className={`h-4 w-4 ${post.liked ? 'fill-current' : ''}`} />
                  {post.likes}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  {post.comments}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-auto" onClick={() => copyPost(post)}>
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Kopiera</span>
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed bg-muted/20">
        <CardContent className="p-4 sm:p-5 flex gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-base text-foreground">Nästa steg för communityt</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Det här återställer community-känslan med inlägg. När databastabellerna är på plats kan inlägg, kommentarer och gillningar sparas mellan alla användare.
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
