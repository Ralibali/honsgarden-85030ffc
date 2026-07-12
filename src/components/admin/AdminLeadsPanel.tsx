import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Save, ExternalLink, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Lead {
  name: string;
  business_type: string;
  website: string | null;
  website_domain: string | null;
  public_email: string | null;
  public_phone: string | null;
  city: string | null;
  region: string | null;
  social_urls: Record<string, string>;
  source_url: string;
  source_title: string;
  source_description: string;
  relevance_score: number;
  found_at: string;
  already_saved?: boolean;
}

const LEAD_TYPES = [
  { value: 'generisk', label: 'Alla typer' },
  { value: 'hönsgård', label: 'Hönsgård' },
  { value: 'gårdsbutik', label: 'Gårdsbutik' },
  { value: 'äggproducent', label: 'Äggproducent' },
  { value: 'reko', label: 'REKO-ring' },
] as const;

export default function AdminLeadsPanel() {
  const qc = useQueryClient();
  const [city, setCity] = useState('');
  const [leadType, setLeadType] = useState<string>('generisk');
  const [customQuery, setCustomQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const { data: savedLeads = [] } = useQuery({
    queryKey: ['sales-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const runSearch = async () => {
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-lead-search', {
        body: { city: city.trim() || undefined, lead_type: leadType, custom_query: customQuery.trim() || undefined, limit: 10 },
      });
      if (error) throw error;
      const leads = (data?.leads ?? []) as Lead[];
      setResults(leads);
      toast({ title: `Hittade ${leads.length} leads`, description: leads.length === 0 ? 'Prova en annan stad eller sökfras.' : undefined });
    } catch (e) {
      toast({ title: 'Sökning misslyckades', description: e instanceof Error ? e.message : 'Okänt fel', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const saveLead = async (lead: Lead, idx: number) => {
    setSavingIdx(idx);
    try {
      const { error } = await supabase.from('sales_leads').insert({
        name: lead.name,
        business_type: lead.business_type,
        website: lead.website,
        website_domain: lead.website_domain,
        public_email: lead.public_email,
        public_phone: lead.public_phone,
        city: lead.city,
        region: lead.region,
        social_urls: lead.social_urls,
        source_url: lead.source_url,
        source_title: lead.source_title,
        source_description: lead.source_description,
        relevance_score: lead.relevance_score,
        status: 'new',
      });
      if (error) throw error;
      setResults((prev) => prev.map((l, i) => (i === idx ? { ...l, already_saved: true } : l)));
      qc.invalidateQueries({ queryKey: ['sales-leads'] });
      toast({ title: 'Lead sparad' });
    } catch (e) {
      toast({ title: 'Kunde inte spara', description: e instanceof Error ? e.message : 'Okänt fel', variant: 'destructive' });
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Stad (t.ex. Uppsala)" value={city} onChange={(e) => setCity(e.target.value)} />
            <Select value={leadType} onValueChange={setLeadType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Sök leads
            </Button>
          </div>
          <Input placeholder="Egen sökfras (valfritt)" value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Söker publikt tillgängliga företagsuppgifter via Firecrawl. Sparade leads hamnar i tabellen <code>sales_leads</code>.
          </p>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Nya träffar ({results.length})</h3>
          {results.map((lead, idx) => (
            <Card key={idx} className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.website_domain}</p>
                  </div>
                  <Badge variant="secondary">Score {lead.relevance_score}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{lead.source_description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {lead.public_email && <span className="inline-flex items-center gap-1 text-primary"><Mail className="h-3 w-3" />{lead.public_email}</span>}
                  {lead.public_phone && <span className="inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" />{lead.public_phone}</span>}
                  {lead.website && <a href={lead.website} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"><ExternalLink className="h-3 w-3" />Öppna</a>}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant={lead.already_saved ? 'secondary' : 'default'} disabled={lead.already_saved || savingIdx === idx} onClick={() => saveLead(lead, idx)}>
                    {savingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    {lead.already_saved ? 'Sparad' : 'Spara'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Sparade leads ({savedLeads.length})</h3>
        {savedLeads.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga sparade leads ännu.</p>
        ) : (
          <div className="space-y-1.5">
            {savedLeads.map((lead: any) => (
              <Card key={lead.id} className="border-border/50">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[lead.city, lead.public_email, lead.public_phone].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
