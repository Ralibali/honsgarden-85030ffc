import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, FileText, Plus, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  is_published: boolean;
};

type Match = {
  postId: string;
  postTitle: string;
  slug: string;
  isPublished: boolean;
  snippets: string[];
  count: number;
};

function highlightTerm(text: string, term: string) {
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-warning/30 text-foreground rounded px-0.5">$1</mark>');
}

function extractSnippets(content: string, term: string, maxSnippets = 3): string[] {
  // Strip HTML tags for cleaner search
  const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const snippets: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(plain)) !== null && snippets.length < maxSnippets) {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(plain.length, match.index + term.length + 60);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < plain.length ? '…' : '';
    snippets.push(prefix + plain.slice(start, end).trim() + suffix);
  }

  return snippets;
}

interface KeywordExplorerProps {
  onAddKeywords: (keywords: string[]) => void;
  existingKeywords: string[];
}

export default function KeywordExplorer({ onAddKeywords, existingKeywords }: KeywordExplorerProps) {
  const [search, setSearch] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, is_published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const searchTerm = search.trim().toLowerCase();

  const results = useMemo(() => {
    if (searchTerm.length < 2) return [];
    
    const matches: Match[] = [];
    for (const post of posts) {
      const plain = post.content.replace(/<[^>]+>/g, ' ');
      const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const allMatches = plain.match(regex);
      if (allMatches && allMatches.length > 0) {
        matches.push({
          postId: post.id,
          postTitle: post.title,
          slug: post.slug,
          isPublished: post.is_published,
          snippets: extractSnippets(post.content, searchTerm, 5),
          count: allMatches.length,
        });
      }
    }
    return matches.sort((a, b) => b.count - a.count);
  }, [searchTerm, posts]);

  // Find unique word variations from results
  const uniqueWords = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const wordSet = new Map<string, number>();
    
    for (const post of posts) {
      const plain = post.content.replace(/<[^>]+>/g, ' ');
      // Match the search term and surrounding word context
      const regex = new RegExp(`\\b(\\S*${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S*)\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(plain)) !== null) {
        const word = match[1].toLowerCase().replace(/[.,;:!?"()]/g, '');
        if (word.length >= 2) {
          wordSet.set(word, (wordSet.get(word) || 0) + 1);
        }
      }
    }
    
    return Array.from(wordSet.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
  }, [searchTerm, posts]);

  const totalMatches = results.reduce((sum, r) => sum + r.count, 0);

  const toggleWord = (word: string) => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const selectAll = () => {
    const allWords = uniqueWords.map(([w]) => w).filter(w => !existingKeywords.includes(w));
    setSelectedWords(new Set(allWords));
  };

  const deselectAll = () => setSelectedWords(new Set());

  const handleAddSelected = () => {
    onAddKeywords(Array.from(selectedWords));
    setSelectedWords(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Search className="h-3 w-3" /> Sök ord i alla artiklar
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök ord, t.ex. höns, foder, Granngården..."
              className="pl-9 rounded-xl"
            />
          </div>
          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-[10px] text-muted-foreground">Skriv minst 2 tecken…</p>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {searchTerm.length >= 2 && !isLoading && (
        <>
          {/* Word variations found */}
          {uniqueWords.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ordvarianter med "{searchTerm}" ({uniqueWords.length} st)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectAll}>
                      Välj alla
                    </Button>
                    {selectedWords.size > 0 && (
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={deselectAll}>
                        Avmarkera
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueWords.map(([word, count]) => {
                    const alreadyExists = existingKeywords.includes(word);
                    const isSelected = selectedWords.has(word);
                    return (
                      <button
                        key={word}
                        onClick={() => !alreadyExists && toggleWord(word)}
                        disabled={alreadyExists}
                        className={`
                          inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-all
                          ${alreadyExists
                            ? 'bg-muted/50 text-muted-foreground/50 border-border/30 cursor-not-allowed line-through'
                            : isSelected
                              ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/20'
                              : 'bg-card text-foreground border-border/50 hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                          }
                        `}
                      >
                        {!alreadyExists && (
                          <Checkbox
                            checked={isSelected}
                            className="h-3 w-3 pointer-events-none"
                          />
                        )}
                        {word}
                        <span className="text-[9px] text-muted-foreground">({count})</span>
                        {alreadyExists && <Link2 className="h-2.5 w-2.5" />}
                      </button>
                    );
                  })}
                </div>

                {selectedWords.size > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <p className="text-xs text-muted-foreground">
                      {selectedWords.size} ord valda
                    </p>
                    <Button
                      size="sm"
                      className="rounded-xl text-xs gap-1"
                      onClick={handleAddSelected}
                    >
                      <Plus className="h-3 w-3" />
                      Lägg till som länkord
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Article matches with previews */}
          {results.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                Hittade "{searchTerm}" {totalMatches} gånger i {results.length} artiklar
              </p>
              {results.map(match => (
                <Card key={match.postId} className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    <button
                      onClick={() => setExpandedPost(expandedPost === match.postId ? null : match.postId)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{match.postTitle}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={match.isPublished ? 'default' : 'secondary'} className="text-[8px] h-4">
                            {match.isPublished ? 'Publicerad' : 'Utkast'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{match.count} träffar</span>
                        </div>
                      </div>
                      {expandedPost === match.postId ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {expandedPost === match.postId && (
                      <div className="space-y-1.5 pt-2 border-t border-border/30">
                        {match.snippets.map((snippet, i) => (
                          <p
                            key={i}
                            className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: highlightTerm(snippet, searchTerm) }}
                          />
                        ))}
                        {match.count > match.snippets.length && (
                          <p className="text-[9px] text-muted-foreground/60 text-center">
                            +{match.count - match.snippets.length} fler träffar i artikeln
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Inga artiklar innehåller "{searchTerm}".
              </p>
            </div>
          )}
        </>
      )}

      {searchTerm.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Sök efter ett ord för att se var det förekommer i dina artiklar.
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Du kan sedan välja ord och lägga till dem som länkord i bulk.
          </p>
        </div>
      )}
    </div>
  );
}
