import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import {
  AlertCircle,
  BellRing,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Facebook,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  Send,
  Star,
  Share2,
  ShoppingBasket,
  Store,
  Trash2,
  Truck,
  Upload,
  Users,
  Wallet,
  Wand2,
} from 'lucide-react';

const PUBLIC_BASE_URL = 'https://honsgarden.se';
const IMAGE_BUCKET = 'egg-sale-images';

type Tone = 'mysig' | 'kort' | 'proffsig' | 'humor';
type Listing = any;
type Booking = any;
type MarketingTexts = { facebook: string; sms: string; email: string; poster: string; story: string; price_tip?: string };

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'farska-agg';
}

function safeNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function encode(value: string) {
  return encodeURIComponent(value.trim());
}

function kr(value: unknown) {
  const n = Number(value || 0);
  return `${Math.round(n)} kr`;
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Betald';
  if (status === 'picked_up') return 'Hämtad';
  if (status === 'cancelled') return 'Avbokad';
  return 'Ny förfrågan';
}

function statusTone(status: string) {
  if (status === 'paid') return 'bg-blue-100 text-blue-900 border-blue-200';
  if (status === 'picked_up') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground border-border';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

function statusDot(status: string) {
  if (status === 'paid') return 'bg-blue-500';
  if (status === 'picked_up') return 'bg-emerald-500';
  if (status === 'cancelled') return 'bg-muted-foreground';
  return 'bg-amber-500';
}

function nextAction(status: string) {
  if (status === 'reserved') return 'Väntar på betalning/bekräftelse';
  if (status === 'paid') return 'Betald – väntar på hämtning';
  if (status === 'picked_up') return 'Klar – betald och hämtad';
  return 'Avbokad';
}

function getExt(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return ext;
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  return 'jpg';
}

function copyText(text: string, label = 'Texten') {
  navigator.clipboard?.writeText(text);
  toast({ title: `${label} är kopierad` });
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

async function getUniqueSlug(baseSlug: string, currentId?: string | null) {
  const clean = slugify(baseSlug);
  for (let i = 0; i < 30; i += 1) {
    const candidate = i === 0 ? clean : `${clean}-${i + 1}`;
    const { data, error } = await (supabase as any)
      .from('public_egg_sale_listings')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data || data.id === currentId) return candidate;
  }
  return `${clean}-${Date.now().toString(36)}`;
}

export default function EggSalesProV6() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState('Färska ägg till salu');
  const [description, setDescription] = useState('Färska ägg från vår lilla hönsgård. Perfekt till frukost, bakning och helgmys.');
  const [salePacks, setSalePacks] = useState('6');
  const [packSize, setPackSize] = useState('12');
  const [pricePerPack, setPricePerPack] = useState('60');
  const [location, setLocation] = useState('');
  const [pickupInfo, setPickupInfo] = useState('Hämtas efter överenskommelse.');
  const [contact, setContact] = useState('Skicka meddelande vid intresse');
  const [swishNumber, setSwishNumber] = useState('');
  const [swishName, setSwishName] = useState('');
  const [swishMessage, setSwishMessage] = useState('Ägg');
  const [imageUrl, setImageUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [tone, setTone] = useState<Tone>('mysig');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedTexts, setGeneratedTexts] = useState<MarketingTexts | null>(null);
  const [stockPacks, setStockPacks] = useState('0');
  const [stockSource, setStockSource] = useState<'manual' | 'egg_log'>('manual');
  const [autoPublish, setAutoPublish] = useState(true);

  useEffect(() => {
    document.title = 'Agda sälj | Hönsgården';
  }, []);

  // Hämta tillgängliga ägg (från äggloggen senaste 14 dagarna minus redan sålt)
  const { data: eggLogStock = 0 } = useQuery({
    queryKey: ['egg-log-stock-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [{ data: logs }, { data: bookings }] = await Promise.all([
        (supabase as any).from('egg_logs').select('count').eq('user_id', userId).gte('date', since),
        (supabase as any).from('public_egg_sale_bookings').select('packs').eq('seller_user_id', userId).neq('status', 'cancelled').gte('created_at', since),
      ]);
      const totalEggs = (logs || []).reduce((s: number, r: any) => s + Number(r.count || 0), 0);
      const soldEggs = (bookings || []).reduce((s: number, b: any) => s + Number(b.packs || 0), 0) * Math.max(1, safeNumber(packSize, 12));
      return Math.max(0, Math.floor((totalEggs - soldEggs) / Math.max(1, safeNumber(packSize, 12))));
    },
  });

  const packCount = Math.max(1, safeNumber(salePacks, 1));
  const eggsPerPack = Math.max(1, safeNumber(packSize, 12));
  const price = Math.max(1, safeNumber(pricePerPack, 60));
  const draftSlug = useMemo(() => slugify(customSlug || `${location || title} agg`), [customSlug, location, title]);
  const saleUrl = `${PUBLIC_BASE_URL}/s/${publishedSlug || draftSlug}`;
  const p6 = Math.max(1, Math.round(((price / eggsPerPack) * 6) / 5) * 5);
  const p12 = eggsPerPack === 12 ? price : Math.max(1, Math.round(((price / eggsPerPack) * 12) / 5) * 5);
  const p30 = Math.max(1, Math.round(((price / eggsPerPack) * 30) / 5) * 5);

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['my-public-egg-sale-listings-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-public-egg-sale-bookings-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('*')
        .eq('seller_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['my-egg-sale-waitlist-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('egg_sale_waitlist')
        .select('*')
        .eq('seller_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['my-egg-sale-reviews-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('egg_sale_reviews')
        .select('*')
        .eq('seller_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: reviewTokens = [] } = useQuery({
    queryKey: ['my-egg-sale-review-tokens-v6'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('egg_sale_review_tokens')
        .select('*')
        .eq('seller_user_id', userId);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const listingById = useMemo(() => {
    const map: Record<string, Listing> = {};
    (listings as Listing[]).forEach((l) => { map[l.id] = l; });
    return map;
  }, [listings]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'reserved' | 'paid' | 'picked_up' | 'cancelled'>('all');

  const sortedBookings = useMemo(() => {
    const order: Record<string, number> = { reserved: 0, paid: 1, picked_up: 2, cancelled: 3 };
    return [...(bookings as Booking[])].sort((a, b) => {
      const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return sortedBookings;
    return sortedBookings.filter((b) => b.status === statusFilter);
  }, [sortedBookings, statusFilter]);

  const bookingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (bookings as Booking[]).forEach((b) => {
      if (b.status !== 'cancelled') map[b.listing_id] = (map[b.listing_id] || 0) + Number(b.packs || 0);
    });
    return map;
  }, [bookings]);

  const salesStats = useMemo(() => {
    const rows = bookings as Booking[];
    const active = rows.filter((b) => b.status !== 'cancelled');
    const reserved = rows.filter((b) => b.status === 'reserved');
    const paid = rows.filter((b) => b.status === 'paid');
    const pickedUp = rows.filter((b) => b.status === 'picked_up');
    const cancelled = rows.filter((b) => b.status === 'cancelled');

    const amountFor = (items: Booking[]) => items.reduce((sum, b) => {
      const listing = listingById[b.listing_id];
      return sum + Number(b.packs || 0) * Number(listing?.price_per_pack || 0);
    }, 0);
    const packsFor = (items: Booking[]) => items.reduce((sum, b) => sum + Number(b.packs || 0), 0);

    return {
      totalActive: active.length,
      reservedCount: reserved.length,
      paidCount: paid.length,
      pickedUpCount: pickedUp.length,
      cancelledCount: cancelled.length,
      reservedPacks: packsFor(reserved),
      paidPacks: packsFor(paid),
      pickedUpPacks: packsFor(pickedUp),
      activePacks: packsFor(active),
      reservedAmount: amountFor(reserved),
      paidAmount: amountFor(paid),
      pickedUpAmount: amountFor(pickedUp),
      confirmedAmount: amountFor([...paid, ...pickedUp]),
      completedAmount: amountFor(pickedUp),
    };
  }, [bookings, listingById]);

  const regularThreshold = useMemo(() => {
    const t = (listings as Listing[])[0]?.regular_customer_threshold;
    return Math.max(2, Number(t || 4));
  }, [listings]);

  type Customer = { key: string; name: string; phone: string | null; orders: number; packs: number; amount: number; lastDate: string | null; lastListingId: string | null; isRegular: boolean };
  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    (bookings as Booking[]).forEach((b) => {
      if (b.status === 'cancelled') return;
      const phone = (b.customer_phone || '').trim();
      const name = (b.customer_name || '').trim();
      const key = phone ? `p:${phone.replace(/\s+/g, '')}` : `n:${name.toLowerCase()}`;
      if (!key || key === 'n:') return;
      const listing = listingById[b.listing_id];
      const amount = Number(b.packs || 0) * Number(listing?.price_per_pack || 0);
      const existing = map.get(key);
      if (existing) {
        existing.orders += 1;
        existing.packs += Number(b.packs || 0);
        existing.amount += amount;
        if (!existing.lastDate || (b.created_at && b.created_at > existing.lastDate)) {
          existing.lastDate = b.created_at;
          existing.lastListingId = b.listing_id;
        }
        if (!existing.phone && phone) existing.phone = phone;
        if ((!existing.name || existing.name.length < name.length) && name) existing.name = name;
      } else {
        map.set(key, { key, name: name || phone, phone: phone || null, orders: 1, packs: Number(b.packs || 0), amount, lastDate: b.created_at || null, lastListingId: b.listing_id, isRegular: false });
      }
    });
    const arr = Array.from(map.values()).map((c) => ({ ...c, isRegular: c.orders >= regularThreshold }));
    arr.sort((a, b) => (b.isRegular ? 1 : 0) - (a.isRegular ? 1 : 0) || b.orders - a.orders || b.amount - a.amount);
    return arr;
  }, [bookings, listingById, regularThreshold]);

  const [customerFilter, setCustomerFilter] = useState<'all' | 'regulars'>('all');
  const visibleCustomers = useMemo(() => customerFilter === 'regulars' ? customers.filter((c) => c.isRegular) : customers, [customers, customerFilter]);

  const texts = useMemo<MarketingTexts>(() => {
    if (generatedTexts) return generatedTexts;
    const place = location.trim() || 'lokalt i området';
    const scarcity = packCount <= 3 ? 'Det finns bara några få kartor, så det är först till kvarn.' : `Just nu finns cirka ${packCount} kartor tillgängliga.`;
    const swishLine = swishNumber.trim() ? `\nSwish: ${swishNumber}${swishName ? ` (${swishName})` : ''}\nMeddelande: ${swishMessage || 'Ägg'}` : '';
    const opener = tone === 'humor' ? 'Hönsen har jobbat hårt – nu finns ägg att köpa! 🐔🥚' : tone === 'kort' ? '🥚 Färska ägg säljes.' : tone === 'proffsig' ? 'Lokala, färska ägg finns nu till försäljning.' : `🥚 ${title}`;
    return {
      facebook: `${opener}\n\n${description}\n\n${scarcity}\n${eggsPerPack}-pack: ${price} kr\nHämtas: ${place}\n${pickupInfo}\n${contact}${swishLine}\n\nSkicka bokningsförfrågan här: ${saleUrl}`,
      sms: `Hej! Nu finns färska ägg 🥚 ${eggsPerPack}-pack för ${price} kr. Skicka bokningsförfrågan här: ${saleUrl}`,
      email: `Hej!\n\n${description}\n\nJag har ungefär ${packCount} kartor tillgängliga. Pris: ${price} kr för ${eggsPerPack} ägg.\nHämtning: ${place}.\n${pickupInfo}${swishLine}\n\nSkicka bokningsförfrågan här:\n${saleUrl}\n\nVänliga hälsningar`,
      poster: `${title.toUpperCase()}\n\n${eggsPerPack}-pack: ${price} kr\n${packCount} kartor tillgängliga\n\nHämtas: ${place}\n${pickupInfo}\n${contact}${swishLine}\n\nBokningsförfrågan:\n${saleUrl}`,
      story: `${title} 🥚\n${eggsPerPack}-pack · ${price} kr\n${place}\nBoka via länken`,
      price_tip: `Om allt säljs blir det cirka ${packCount * price} kr.`,
    };
  }, [generatedTexts, title, description, packCount, eggsPerPack, price, location, pickupInfo, contact, swishNumber, swishName, swishMessage, saleUrl, tone]);

  const invalidateAgda = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['my-public-egg-sale-listings-v6'] }),
      qc.invalidateQueries({ queryKey: ['my-public-egg-sale-bookings-v6'] }),
      qc.invalidateQueries({ queryKey: ['my-egg-sale-waitlist-v6'] }),
      qc.invalidateQueries({ queryKey: ['my-egg-sale-reviews-v6'] }),
      qc.invalidateQueries({ queryKey: ['my-egg-sale-review-tokens-v6'] }),
    ]);
  };

  const triggerWaitlistNotify = async (listingId: string) => {
    try {
      const { data } = await (supabase as any).functions.invoke('notify-waitlist', { body: { listing_id: listingId } });
      const n = Number(data?.notified ?? 0);
      if (n > 0) toast({ title: `Väntelistan är notifierad 🔔`, description: `${n} intresserade fick mejl om att lagret är påfyllt.` });
    } catch {
      // tyst – notifiering är best-effort
    }
  };

  const loadListing = (l: Listing) => {
    setEditingId(l.id);
    setPublishedSlug(l.slug || '');
    setCustomSlug(l.slug || '');
    setTitle(l.title || 'Färska ägg till salu');
    setDescription(l.description || '');
    setImageUrl(l.image_url || '');
    setSalePacks(String(l.packs_available || 1));
    setPackSize(String(l.eggs_per_pack || 12));
    setPricePerPack(String(Math.round(Number(l.price_per_pack || 60))));
    setLocation(l.location || '');
    setPickupInfo(l.pickup_info || '');
    setContact(l.contact_info || '');
    setSwishNumber(l.swish_number || '');
    setSwishName(l.swish_name || '');
    setSwishMessage(l.swish_message || 'Ägg');
    setStockPacks(String(l.stock_packs ?? 0));
    setStockSource((l.stock_source as 'manual' | 'egg_log') || 'manual');
    setAutoPublish(l.auto_publish !== false);
    setGeneratedTexts(null);
    toast({ title: 'Säljlistan är öppnad för redigering' });
  };

  const duplicateListing = (l: Listing) => {
    loadListing(l);
    setEditingId(null);
    setPublishedSlug('');
    setCustomSlug(`${l.slug || draftSlug}-ny`);
    toast({ title: 'Säljlistan är duplicerad', description: 'Publicera för att skapa en ny länk.' });
  };

  const newListing = () => {
    setEditingId(null);
    setPublishedSlug('');
    setCustomSlug('');
    setGeneratedTexts(null);
    toast({ title: 'Ny säljlista skapad' });
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast({ title: 'Välj en bildfil', variant: 'destructive' });
    if (file.size > 8 * 1024 * 1024) return toast({ title: 'Bilden är för stor', description: 'Välj en bild under 8 MB.', variant: 'destructive' });
    setImageUploading(true);
    try {
      const userId = await getCurrentUserId();
      const path = `${userId}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${getExt(file)}`;
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
      setImageUrl(data.publicUrl);
      setGeneratedTexts(null);
      toast({ title: 'Bilden är uppladdad 📸' });
    } catch (e: any) {
      toast({ title: 'Kunde inte ladda upp bild', description: e.message, variant: 'destructive' });
    } finally {
      setImageUploading(false);
    }
  };

  const publishListing = async () => {
    setPublishing(true);
    try {
      const userId = await getCurrentUserId();
      const requestedSlug = publishedSlug || customSlug || draftSlug;
      const slug = await getUniqueSlug(requestedSlug, editingId);
      const newStock = Math.max(0, safeNumber(stockPacks, 0));
      const prevStock = editingId ? Number((listings as Listing[]).find((x) => x.id === editingId)?.stock_packs ?? 0) : 0;
      const row = {
        user_id: userId,
        slug,
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        packs_available: packCount,
        eggs_per_pack: eggsPerPack,
        price_per_pack: price,
        location: location.trim() || null,
        pickup_info: pickupInfo.trim() || null,
        contact_info: contact.trim() || null,
        swish_number: swishNumber.trim() || null,
        swish_name: swishName.trim() || null,
        swish_message: swishMessage.trim() || 'Ägg',
        p6_price: p6,
        p12_price: p12,
        p30_price: p30,
        is_active: true,
        stock_packs: newStock,
        stock_source: stockSource,
        auto_publish: autoPublish,
      };
      const result = editingId
        ? await (supabase as any).from('public_egg_sale_listings').update(row).eq('id', editingId).select('id, slug').single()
        : await (supabase as any).from('public_egg_sale_listings').insert(row).select('id, slug').single();
      if (result.error) throw result.error;
      setEditingId(result.data.id);
      setPublishedSlug(result.data.slug);
      setCustomSlug(result.data.slug);
      await invalidateAgda();
      toast({ title: editingId ? 'Säljlistan är uppdaterad ✨' : 'Säljlistan är publicerad ✨', description: `${PUBLIC_BASE_URL}/s/${result.data.slug}` });
      if (slug !== requestedSlug) toast({ title: 'Länken justerades automatiskt', description: `Den blev /s/${slug} eftersom önskad länk var upptagen.` });
      // Notifiera väntelistan om lager precis fyllts på (manuellt lager)
      if (stockSource === 'manual' && prevStock <= 0 && newStock > 0) {
        await triggerWaitlistNotify(result.data.id);
      }
    } catch (e: any) {
      toast({ title: 'Kunde inte publicera', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const updateListingState = async (id: string, patch: Record<string, unknown>, message: string) => {
    const { error } = await (supabase as any).from('public_egg_sale_listings').update(patch).eq('id', id);
    if (error) return toast({ title: 'Kunde inte uppdatera säljlistan', description: error.message, variant: 'destructive' });
    await invalidateAgda();
    toast({ title: message });
  };

  const deleteListing = async (listing: Listing) => {
    const ok = window.confirm(`Vill du ta bort säljlistan ”${listing.title || listing.slug}”? Länken /s/${listing.slug} kommer sluta fungera och bokningar för listan tas bort.`);
    if (!ok) return;
    const { error } = await (supabase as any).from('public_egg_sale_listings').delete().eq('id', listing.id);
    if (error) return toast({ title: 'Kunde inte ta bort säljlistan', description: error.message, variant: 'destructive' });
    if (editingId === listing.id) newListing();
    await invalidateAgda();
    toast({ title: 'Säljlistan är borttagen', description: `Länken /s/${listing.slug} är inte längre aktiv.` });
  };

  const updateBookingStatus = async (id: string, status: string) => {
    const current = (bookings as Booking[]).find((b) => b.id === id);
    if (current?.status === 'picked_up' && status === 'paid') {
      return toast({ title: 'Hämtade bokningar kan inte nedgraderas', description: 'En hämtad bokning är redan betald och avslutad.', variant: 'destructive' });
    }
    const { error } = await (supabase as any).from('public_egg_sale_bookings').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Kunde inte uppdatera bokningen', description: error.message, variant: 'destructive' });
    await invalidateAgda();
    toast({ title: status === 'paid' ? 'Bokningen är markerad som betald' : status === 'picked_up' ? 'Bokningen är markerad som hämtad' : 'Bokningen är uppdaterad' });
    // Auto-skicka recensions-länk när bokningen markeras som hämtad
    if (status === 'picked_up' && current?.status !== 'picked_up') {
      try {
        const { data } = await (supabase as any).functions.invoke('send-review-request', { body: { booking_id: id } });
        if (data?.review_url) {
          try { await navigator.clipboard?.writeText(data.review_url); } catch { /* ignore */ }
          toast({ title: 'Recensions-länk skapad ⭐', description: 'Länken är kopierad – skicka till kunden via SMS eller mejl.' });
        }
      } catch { /* tyst */ }
    }
  };

  const generateWithAI = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('egg-sales-marketing', {
        body: {
          salePacks,
          packSize,
          pricePerPack,
          location,
          contact: `${contact}\nHämtning: ${pickupInfo}\nSwish: ${swishNumber || 'ej angivet'} ${swishName || ''}`,
          tone,
          sellingPoint: description,
          monthEggs: packCount * eggsPerPack,
          monthFeedCost: 0,
          costPerEgg: 0,
          suggestedLow: price,
          suggestedHigh: Math.ceil(price * 1.2),
        },
      });
      if (error) throw error;
      setGeneratedTexts({ ...data, facebook: `${data.facebook}\n\nSkicka bokningsförfrågan här: ${saleUrl}` });
      toast({ title: 'Agda har skapat säljtexter ✨' });
    } catch (e: any) {
      toast({ title: 'Kunde inte skapa AI-texter', description: e.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const shareNative = async () => {
    if (navigator.share) await navigator.share({ title, text: texts.facebook, url: saleUrl }).catch(() => undefined);
    else copyText(texts.facebook, 'Delningstexten');
  };

  const customerReply = (booking: Booking) => {
    const listing = listingById[booking.listing_id];
    const unitPrice = Number(listing?.price_per_pack || 0);
    const sum = Number(booking.packs || 0) * unitPrice;
    const swish = listing?.swish_number ? `\nSwish: ${listing.swish_number}${listing.swish_name ? ` (${listing.swish_name})` : ''}\nMeddelande: ${listing.swish_message || 'Ägg'}` : '';
    return `Hej ${booking.customer_name}! Din bokningsförfrågan på ${booking.packs} karta/kartor ägg är mottagen.${unitPrice ? `\nSumma: ${sum} kr.` : ''}\n${listing?.pickup_info || 'Vi bestämmer hämtningstid tillsammans.'}${swish}\n\nVänliga hälsningar`;
  };

  const exportBookingsCsv = () => {
    const rows = [
      ['Ordning', 'Status', 'Bokat datum', 'Bokad tid', 'Senast uppdaterad', 'Säljlista', 'Länk', 'Kundnamn', 'Kontakt', 'Antal kartor', 'Pris per karta', 'Summa', 'Meddelande'],
      ...sortedBookings.map((b, index) => {
        const listing = listingById[b.listing_id];
        const unitPrice = Number(listing?.price_per_pack || 0);
        const created = new Date(b.created_at);
        const updated = b.updated_at ? new Date(b.updated_at) : null;
        return [
          index + 1,
          statusLabel(b.status),
          created.toLocaleDateString('sv-SE'),
          created.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
          updated ? updated.toLocaleString('sv-SE') : '',
          listing?.title || 'Okänd säljlista',
          listing?.slug ? `${PUBLIC_BASE_URL}/s/${listing.slug}` : '',
          b.customer_name,
          b.customer_phone || '',
          b.packs,
          unitPrice || '',
          unitPrice ? Number(b.packs || 0) * unitPrice : '',
          b.customer_message || '',
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agda-bokningar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exporterad', description: 'Filen kan öppnas i Excel eller Google Sheets.' });
  };

  const copyCustomerList = () => {
    const text = (bookings as Booking[]).map((b) => {
      const listing = listingById[b.listing_id];
      const unitPrice = Number(listing?.price_per_pack || 0);
      const sum = unitPrice ? ` · ${Number(b.packs || 0) * unitPrice} kr` : '';
      return `${b.customer_name}${b.customer_phone ? ` (${b.customer_phone})` : ''} · ${b.packs} kartor${sum} · ${statusLabel(b.status)} · ${listing?.title || 'Okänd säljlista'}`;
    }).join('\n');
    copyText(text || 'Inga bokningar ännu', 'Kundlistan');
  };

  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readScoped(user?.id, 'agdas-bod-onboarding-dismissed') !== '1';
  });
  const dismissOnboarding = () => {
    writeScoped(user?.id, 'agdas-bod-onboarding-dismissed', '1');
    setShowOnboarding(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="data-label mb-1">Sälj ägg</p>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Agdas Bod 🥚</h1>
          <p className="text-sm text-muted-foreground mt-1">Din digitala gårdsbutik – publicera säljsidor för dina ägg, ta emot bokningar från kunder och håll koll på lager och Swish-betalningar på ett ställe.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={newListing} className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Ny lista</Button>
          <Button onClick={publishListing} disabled={publishing} className="rounded-xl gap-2">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />} {editingId ? 'Uppdatera' : 'Publicera'}</Button>
        </div>
      </div>

      {showOnboarding && (
        <Card className="border-primary/30 bg-gradient-to-br from-accent/20 via-card to-primary/10 shadow-sm relative overflow-hidden animate-fade-in">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-lg leading-tight">Välkommen till Agdas Bod!</h2>
                  <p className="text-xs text-muted-foreground">Så här kommer du igång på 1 minut.</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissOnboarding} className="text-xs h-8 rounded-lg">Stäng</Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="data-label mb-2">Exempel på vad du kan sälja</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2"><span>🥚</span><span><strong>Färska ägg</strong> – t.ex. "6-pack blandade gårdsägg, 45 kr"</span></li>
                  <li className="flex gap-2"><span>🌿</span><span><strong>Påsk- eller blåa ägg</strong> – "Cream Legbar, 10-pack 80 kr"</span></li>
                  <li className="flex gap-2"><span>🐣</span><span><strong>Kläckägg eller kycklingar</strong> – säsongsbaserat</span></li>
                </ul>
              </div>

              <div>
                <p className="data-label mb-2">Så funkar bokningen</p>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2"><span className="font-serif text-primary">1.</span><span>Klicka <strong>Ny lista</strong> och beskriv vad du säljer, antal och pris.</span></li>
                  <li className="flex gap-2"><span className="font-serif text-primary">2.</span><span>Dela din publika länk på Facebook, SMS eller anslagstavlan.</span></li>
                  <li className="flex gap-2"><span className="font-serif text-primary">3.</span><span>Kunden bokar med namn, telefon och e-post – du markerar <strong>Hämtad</strong> när de hämtat.</span></li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => { newListing(); dismissOnboarding(); }} size="sm" className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Skapa min första lista</Button>
              <Button variant="outline" size="sm" onClick={dismissOnboarding} className="rounded-xl">Jag fixar själv</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-primary" /> Försäljning och beställningar</h2>
              <p className="text-sm text-muted-foreground">Här ser du både statistik och alla som skickat in en förfrågan via dina säljsidor.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl gap-2" onClick={copyCustomerList}><Copy className="h-4 w-4" /> Kopiera kundlista</Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={exportBookingsCsv}><Download className="h-4 w-4" /> Exportera CSV</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SalesStat icon={AlertCircle} label="Nya förfrågningar" value={salesStats.reservedCount} sub={`${salesStats.reservedPacks} kartor · ${kr(salesStats.reservedAmount)}`} tone="amber" />
            <SalesStat icon={CircleDollarSign} label="Betalda (ej hämtade)" value={salesStats.paidCount} sub={`${salesStats.paidPacks} kartor · ${kr(salesStats.paidAmount)}`} tone="blue" />
            <SalesStat icon={Truck} label="Hämtade & klara" value={salesStats.pickedUpCount} sub={`${salesStats.pickedUpPacks} kartor · ${kr(salesStats.pickedUpAmount)}`} tone="green" />
            <SalesStat icon={Wallet} label="Bekräftat värde" value={kr(salesStats.confirmedAmount)} sub={`${salesStats.paidPacks + salesStats.pickedUpPacks} kartor betalda/hämtade`} tone="default" />
          </div>

          {bookingsLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (bookings as Booking[]).length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-center"><Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="font-medium">Inga bokningsförfrågningar ännu</p><p className="text-sm text-muted-foreground mt-1">När någon beställer via din publika länk visas det här direkt.</p></div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrera bokningar">
                {([
                  { key: 'all', label: 'Alla', count: bookingCounts.total, cls: 'bg-card text-foreground border-border hover:bg-muted', active: 'bg-primary text-primary-foreground border-primary' },
                  { key: 'reserved', label: 'Ny', count: bookingCounts.reserved, cls: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100', active: 'bg-amber-500 text-white border-amber-500' },
                  { key: 'paid', label: 'Betald', count: bookingCounts.paid, cls: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100', active: 'bg-blue-600 text-white border-blue-600' },
                  { key: 'picked_up', label: 'Hämtad', count: bookingCounts.picked_up, cls: 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100', active: 'bg-emerald-600 text-white border-emerald-600' },
                  { key: 'cancelled', label: 'Ej hämtad / Avbokad', count: bookingCounts.cancelled, cls: 'bg-muted text-muted-foreground border-border hover:bg-muted/80', active: 'bg-foreground text-background border-foreground' },
                ] as const).map((chip) => {
                  const isActive = statusFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setStatusFilter(chip.key as typeof statusFilter)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${isActive ? chip.active : chip.cls}`}
                    >
                      {chip.label}
                      <span className={`inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/25 text-current' : 'bg-background/70 text-current'}`}>{chip.count}</span>
                    </button>
                  );
                })}
              </div>

              {filteredBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Inga bokningar med vald status.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredBookings.map((b) => {
                    const listing = listingById[b.listing_id];
                    const unitPrice = Number(listing?.price_per_pack || 0);
                    const total = unitPrice ? Number(b.packs || 0) * unitPrice : 0;
                    const isPaid = b.status === 'paid' || b.status === 'picked_up';
                    const isPickedUp = b.status === 'picked_up';
                    return (
                      <div key={b.id} className={`rounded-2xl border-2 bg-card p-4 space-y-3 shadow-sm ${b.status === 'reserved' ? 'border-amber-300 bg-amber-50/40' : b.status === 'paid' ? 'border-blue-300 bg-blue-50/40' : b.status === 'picked_up' ? 'border-emerald-300 bg-emerald-50/40' : 'border-border opacity-60'}`}>
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot(b.status)}`} aria-hidden />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{b.customer_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.customer_phone || 'Ingen kontakt angiven'}</p>
                        </div>
                      </div>
                      <Badge className={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <MiniStat label="Kartor" value={b.packs} />
                      <MiniStat label="Summa" value={total ? kr(total) : '–'} />
                      <MiniStat label="Status" value={isPickedUp ? 'Klar' : isPaid ? 'Betald' : 'Ny'} />
                    </div>

                    <div className="rounded-xl bg-muted/30 border p-3 text-xs space-y-1">
                      <p><span className="text-muted-foreground">Gäller:</span> <strong>{listing?.title || 'Okänd säljlista'}</strong></p>
                      {listing?.slug && <p className="truncate text-muted-foreground">{PUBLIC_BASE_URL}/s/{listing.slug}</p>}
                      <p><span className="text-muted-foreground">Nästa steg:</span> <strong>{nextAction(b.status)}</strong></p>
                    </div>

                    {b.customer_message && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{b.customer_message}</p>}

                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant={isPaid ? 'default' : 'outline'} className="rounded-xl" onClick={() => updateBookingStatus(b.id, 'paid')} disabled={b.status === 'cancelled' || isPickedUp} title={isPickedUp ? 'Hämtade bokningar kan inte nedgraderas' : undefined}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Betald</Button>
                      <Button size="sm" variant={isPickedUp ? 'default' : 'outline'} className="rounded-xl" onClick={() => updateBookingStatus(b.id, 'picked_up')} disabled={b.status === 'cancelled'}><Truck className="h-3.5 w-3.5 mr-1" /> Hämtad</Button>
                      <Button size="sm" variant="outline" className="rounded-xl col-span-2" onClick={() => copyText(customerReply(b), 'Svar till kund')}><MessageCircle className="h-3.5 w-3.5 mr-1" /> Kopiera svar till kund</Button>
                      {b.status !== 'cancelled' && <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:text-destructive col-span-2" onClick={() => updateBookingStatus(b.id, 'cancelled')}><Trash2 className="h-3.5 w-3.5 mr-1" /> Avboka</Button>}
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <h2 className="font-serif text-lg">Säljlista</h2>
              <Field label="Rubrik/banner" value={title} setValue={(v) => { setTitle(v); setGeneratedTexts(null); }} />
              <div className="rounded-2xl border border-border/50 bg-card/70 p-4 space-y-3">
                <p className="font-serif text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Bild</p>
                {imageUrl ? <img src={imageUrl} alt="Förhandsvisning av säljbild" className="h-52 w-full rounded-2xl object-cover border" /> : <div className="h-40 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><FileButton label="Ta ny bild" icon="camera" uploading={imageUploading} capture onFile={uploadImage} /><FileButton label="Välj från galleri" icon="upload" uploading={imageUploading} onFile={uploadImage} /></div>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Eller klistra in bildlänk" className="rounded-xl" />
              </div>
              <label className="space-y-1.5 block"><span className="text-xs text-muted-foreground">Beskrivning</span><Textarea value={description} onChange={(e) => { setDescription(e.target.value); setGeneratedTexts(null); }} className="rounded-xl min-h-[95px]" /></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Kartor" value={salePacks} setValue={setSalePacks} type="number" />
                <Field label="Ägg/karta" value={packSize} setValue={setPackSize} type="number" />
                <Field label="Pris/karta" value={pricePerPack} setValue={setPricePerPack} type="number" />
                <label className="space-y-1.5"><span className="text-xs text-muted-foreground">Ton</span><select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="mysig">Mysig</option><option value="kort">Kort</option><option value="proffsig">Proffsig</option><option value="humor">Humor</option></select></label>
                <Field label="Plats" value={location} setValue={setLocation} />
                <Field label="Önskad länk" value={customSlug} setValue={(v) => setCustomSlug(slugify(v))} placeholder={draftSlug} />
                <Field label="Hämtning" value={pickupInfo} setValue={setPickupInfo} />
                <Field label="Kontakt" value={contact} setValue={setContact} />
                <Field label="Swishnummer" value={swishNumber} setValue={setSwishNumber} />
                <Field label="Swishnamn" value={swishName} setValue={setSwishName} />
                <Field label="Swish-meddelande" value={swishMessage} setValue={setSwishMessage} />
              </div>

              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <p className="font-serif text-sm">Lager & autopublicering</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Butiks-läge</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Lagerkälla</span>
                    <select
                      value={stockSource}
                      onChange={(e) => setStockSource(e.target.value as 'manual' | 'egg_log')}
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="manual">Manuellt antal</option>
                      <option value="egg_log">Räkna från äggloggen</option>
                    </select>
                  </label>

                  {stockSource === 'manual' ? (
                    <Field label="Antal kartor i lager" value={stockPacks} setValue={setStockPacks} type="number" />
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Beräknat från äggloggen (14 d)</span>
                      <div className="h-11 rounded-xl border border-input bg-muted/30 px-3 flex items-center text-sm">
                        <Package className="h-3.5 w-3.5 mr-2 text-primary" />
                        <strong>{eggLogStock}</strong>&nbsp;kartor tillgängliga
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPublish}
                    onChange={(e) => setAutoPublish(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span>
                    <span className="font-medium">Autopublicering</span>
                    <span className="block text-xs text-muted-foreground">
                      Pausa annonsen automatiskt när lagret är slut, och återaktivera när du fyller på.
                    </span>
                  </span>
                </label>

                {stockSource === 'manual' && Number(stockPacks) === 0 && autoPublish && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-100 border border-amber-300 p-2 text-xs text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Lagret är tomt – annonsen markeras som slutsåld vid publicering.</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-muted/25 border p-4 space-y-3"><p className="text-sm break-all">{saleUrl}</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><Button onClick={publishListing} disabled={publishing} className="rounded-xl">{editingId ? 'Uppdatera' : 'Publicera'}</Button><Button variant="outline" onClick={() => copyText(saleUrl, 'Säljlänken')} className="rounded-xl">Kopiera</Button><Button variant="outline" onClick={() => window.open(saleUrl, '_blank')} className="rounded-xl">Visa</Button></div></div>
            </CardContent>
          </Card>

          <Card className="shadow-sm"><CardContent className="p-4 sm:p-5 space-y-4"><div className="flex items-center justify-between gap-2"><h2 className="font-serif text-lg">Agdas texter</h2><Button onClick={generateWithAI} disabled={aiLoading} className="rounded-xl gap-2">{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} AI</Button></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><Button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encode(saleUrl)}&quote=${encode(texts.facebook)}`, '_blank')} className="rounded-xl gap-2"><Facebook className="h-4 w-4" /> Facebook</Button><Button variant="outline" onClick={shareNative} className="rounded-xl gap-2"><Share2 className="h-4 w-4" /> Dela</Button><Button variant="outline" onClick={() => copyText(texts.facebook, 'Facebooktexten')} className="rounded-xl gap-2"><Copy className="h-4 w-4" /> Kopiera</Button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><MarketingOutput icon={MessageCircle} title="Facebook" text={texts.facebook} /><MarketingOutput icon={MessageCircle} title="SMS" text={texts.sms} /><MarketingOutput icon={Mail} title="E-post" text={texts.email} /><MarketingOutput icon={Package} title="Plansch" text={texts.poster} /></div></CardContent></Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden shadow-sm">{imageUrl ? <img src={imageUrl} alt={title || 'Säljsida – förhandsvisning'} className="h-48 w-full object-cover" /> : <div className="h-40 bg-muted/30 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}<CardContent className="p-4 space-y-3"><Badge>Förhandsvisning</Badge><h2 className="font-serif text-2xl">{title}</h2><p className="text-sm text-muted-foreground">{description}</p><div className="grid grid-cols-3 gap-2 text-center"><MiniStat label="Kartor" value={packCount} /><MiniStat label="Ägg" value={eggsPerPack} /><MiniStat label="Pris" value={`${price} kr`} /></div><div className="rounded-2xl border bg-muted/20 p-4 text-sm space-y-1"><PriceRow label="6-pack" value={`${p6} kr`} /><PriceRow label="12-pack" value={`${p12} kr`} /><PriceRow label="30-pack" value={`${p30} kr`} /></div><div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><Wallet className="h-4 w-4 inline mr-1 text-primary" /> {swishNumber || 'Swishnummer visas här'}</div></CardContent></Card>

          <Card className="shadow-sm"><CardContent className="p-4 space-y-3"><h2 className="font-serif text-lg">Mina säljlistor</h2>{listingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (listings as Listing[]).length === 0 ? <p className="text-sm text-muted-foreground">Inga publicerade säljlistor ännu.</p> : <div className="space-y-2">{(listings as Listing[]).slice(0, 8).map((l) => { const booked = bookingCounts[l.id] || 0; const left = Math.max(0, Number(l.packs_available || 0) - booked); const stockLeft = Number(l.stock_packs ?? 0); const isAuto = l.auto_publish !== false; const wlPending = (waitlist as any[]).filter((w) => w.listing_id === l.id && !w.notified_at).length; return <div key={l.id} className="rounded-2xl border p-3 space-y-2"><div><p className="font-medium text-sm truncate">{l.title}</p><p className="text-xs text-muted-foreground truncate">{PUBLIC_BASE_URL}/s/{l.slug}</p></div><div className="flex flex-wrap gap-1"><Badge variant={l.is_active ? 'default' : 'secondary'}>{l.is_active ? 'Aktiv' : 'Pausad'}</Badge>{l.sold_out_manually && <Badge variant="destructive">Slutsåld</Badge>}<Badge variant="outline" className={stockLeft === 0 ? 'border-destructive text-destructive' : stockLeft <= 3 ? 'border-amber-500 text-amber-700' : 'border-emerald-500 text-emerald-700'}><Package className="h-3 w-3 mr-1" />{stockLeft} i lager</Badge>{isAuto && <Badge variant="outline" className="text-xs">Auto</Badge>}<Badge variant="outline">{left} kvar (bokn.)</Badge>{wlPending > 0 && <Badge variant="outline" className="border-primary/40 text-primary"><BellRing className="h-3 w-3 mr-1" />{wlPending} på väntelistan</Badge>}</div><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" className="rounded-xl" onClick={() => loadListing(l)}><Edit3 className="h-3.5 w-3.5 mr-1" /> Redigera</Button><Button size="sm" variant="ghost" className="rounded-xl" onClick={() => window.open(`${PUBLIC_BASE_URL}/s/${l.slug}`, '_blank')}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Visa</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => duplicateListing(l)}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicera</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => updateListingState(l.id, { is_active: !l.is_active }, l.is_active ? 'Säljlistan är pausad' : 'Säljlistan är aktiv igen')}>{l.is_active ? <PauseCircle className="h-3.5 w-3.5 mr-1" /> : <PlayCircle className="h-3.5 w-3.5 mr-1" />}{l.is_active ? 'Pausa' : 'Aktivera'}</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => updateListingState(l.id, { sold_out_manually: !l.sold_out_manually }, l.sold_out_manually ? 'Säljlistan är inte längre slutsåld' : 'Säljlistan är markerad som slutsåld')}>{l.sold_out_manually ? 'Öppna' : 'Slutsåld'}</Button><Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={() => deleteListing(l)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Ta bort</Button></div></div>; })}</div>}</CardContent></Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /> Väntelista</h2>
                <Badge variant="outline">{(waitlist as any[]).filter((w) => !w.notified_at).length} aktiva</Badge>
              </div>
              {(waitlist as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">När en säljlista är slutsåld kan kunder anmäla intresse här. De får automatiskt mejl när du fyller på lagret.</p>
              ) : (
                <div className="space-y-2">
                  {(waitlist as any[]).slice(0, 12).map((w) => {
                    const l = listingById[w.listing_id];
                    const notified = Boolean(w.notified_at);
                    return (
                      <div key={w.id} className="rounded-2xl border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{w.customer_name} <span className="text-muted-foreground font-normal">vill {w.packs_wanted} st</span></p>
                            <p className="text-xs text-muted-foreground truncate">{l?.title || 'Säljlista borttagen'}</p>
                            <p className="text-xs text-muted-foreground truncate">{w.customer_email || ''}{w.customer_email && w.customer_phone ? ' · ' : ''}{w.customer_phone || ''}</p>
                          </div>
                          <Badge variant={notified ? 'secondary' : 'default'} className="shrink-0">{notified ? 'Notifierad' : 'Väntar'}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {w.customer_email && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(`mailto:${w.customer_email}?subject=${encode(`Ägg från ${l?.title || 'Hönsgården'}`)}`, '_blank')}><Mail className="h-3.5 w-3.5 mr-1" /> Mejla</Button>}
                          {w.customer_phone && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(`sms:${w.customer_phone}`, '_blank')}><MessageCircle className="h-3.5 w-3.5 mr-1" /> SMS</Button>}
                          {!notified && l && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => triggerWaitlistNotify(l.id)}><Send className="h-3.5 w-3.5 mr-1" /> Skicka notis nu</Button>}
                          <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={async () => { const { error } = await (supabase as any).from('egg_sale_waitlist').delete().eq('id', w.id); if (error) return toast({ title: 'Kunde inte ta bort', description: error.message, variant: 'destructive' }); await invalidateAgda(); toast({ title: 'Borttagen från väntelistan' }); }}><Trash2 className="h-3.5 w-3.5 mr-1" /> Ta bort</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Stamkunder</h2>
                <div className="flex gap-1">
                  <Button size="sm" variant={customerFilter === 'all' ? 'default' : 'outline'} className="rounded-xl h-7 text-xs" onClick={() => setCustomerFilter('all')}>Alla ({customers.length})</Button>
                  <Button size="sm" variant={customerFilter === 'regulars' ? 'default' : 'outline'} className="rounded-xl h-7 text-xs" onClick={() => setCustomerFilter('regulars')}><Crown className="h-3 w-3 mr-1" /> Stam ({customers.filter((c) => c.isRegular).length})</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Räknas som stamkund vid {regularThreshold}+ köp. Slås ihop på telefonnummer (eller namn).</p>
              {visibleCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga kunder att visa ännu. När bokningar börjar trilla in syns de här.</p>
              ) : (
                <div className="space-y-2">
                  {visibleCustomers.slice(0, 15).map((c) => {
                    const lastListing = c.lastListingId ? listingById[c.lastListingId] : null;
                    const greeting = encode(`Hej ${c.name.split(' ')[0]}! Tack för att du handlar ägg av oss${lastListing ? ` (${lastListing.title})` : ''}. Hör gärna av dig om du vill ha en ny leverans.`);
                    return (
                      <div key={c.key} className={`rounded-2xl border p-3 space-y-2 ${c.isRegular ? 'bg-amber-50/50 border-amber-200' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate flex items-center gap-1.5">{c.isRegular && <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />}{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.phone || 'Inget telefonnummer'} · senast {c.lastDate ? new Date(c.lastDate).toLocaleDateString('sv-SE') : '–'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="stat-number text-base text-primary">{c.orders}</p>
                            <p className="text-[10px] data-label">köp</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="rounded-lg bg-muted/40 p-1.5"><p className="font-semibold">{c.packs}</p><p className="text-[9px] text-muted-foreground">kartor</p></div>
                          <div className="rounded-lg bg-muted/40 p-1.5"><p className="font-semibold">{Math.round(c.amount)} kr</p><p className="text-[9px] text-muted-foreground">totalt</p></div>
                          <div className="rounded-lg bg-muted/40 p-1.5"><p className="font-semibold">{c.orders >= regularThreshold ? 'Stam' : `${regularThreshold - c.orders} kvar`}</p><p className="text-[9px] text-muted-foreground">status</p></div>
                        </div>
                        {c.phone && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(`sms:${c.phone}?body=${greeting}`, '_blank')}><MessageCircle className="h-3.5 w-3.5 mr-1" /> SMS</Button>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(`tel:${c.phone}`, '_blank')}><Send className="h-3.5 w-3.5 mr-1" /> Ring</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Recensioner</h2>
                <Badge variant="outline">{(reviews as any[]).length} st</Badge>
              </div>
              {reviewsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (reviews as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Recensioner skapas automatiskt när du markerar en bokning som "Hämtad" – kunden får ett mejl med länk att lämna betyg.</p>
              ) : (
                <>
                  {(() => {
                    const visible = (reviews as any[]).filter((r) => r.is_published);
                    const avg = visible.length ? visible.reduce((s, r) => s + Number(r.rating || 0), 0) / visible.length : 0;
                    return visible.length > 0 ? (
                      <div className="rounded-2xl border bg-amber-50/50 border-amber-200 p-3 flex items-center gap-3">
                        <p className="stat-number text-2xl text-amber-700">{avg.toFixed(1)}</p>
                        <div>
                          <div className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(avg) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />)}</div>
                          <p className="text-xs text-muted-foreground mt-0.5">{visible.length} publicerade</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="space-y-2">
                    {(reviews as any[]).slice(0, 10).map((r: any) => {
                      const l = listingById[r.listing_id];
                      return (
                        <div key={r.id} className={`rounded-2xl border p-3 space-y-1.5 ${!r.is_published ? 'opacity-60 border-dashed' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{r.customer_name}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3 w-3 ${n <= Number(r.rating) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />)}</div>
                                <span className="text-[10px] text-muted-foreground truncate">{l?.title || ''} · {new Date(r.created_at).toLocaleDateString('sv-SE')}</span>
                              </div>
                            </div>
                            {!r.is_published && <Badge variant="outline" className="text-[10px]">Dold</Badge>}
                          </div>
                          {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={async () => { const { error } = await (supabase as any).from('egg_sale_reviews').update({ is_published: !r.is_published }).eq('id', r.id); if (error) return toast({ title: 'Kunde inte uppdatera', description: error.message, variant: 'destructive' }); await invalidateAgda(); toast({ title: r.is_published ? 'Recensionen är dold' : 'Recensionen visas igen' }); }}>{r.is_published ? 'Dölj' : 'Visa'}</Button>
                            <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-destructive hover:text-destructive" onClick={async () => { if (!confirm('Ta bort recensionen?')) return; const { error } = await (supabase as any).from('egg_sale_reviews').delete().eq('id', r.id); if (error) return toast({ title: 'Kunde inte ta bort', description: error.message, variant: 'destructive' }); await invalidateAgda(); toast({ title: 'Borttagen' }); }}><Trash2 className="h-3.5 w-3.5 mr-1" /> Ta bort</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(reviewTokens as any[]).filter((t: any) => !t.used_at).length > 0 && (
                    <p className="text-xs text-muted-foreground border-t pt-2">⏳ {(reviewTokens as any[]).filter((t: any) => !t.used_at).length} kund(er) har fått recensions-länk men inte svarat ännu.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SalesStat({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub: string; tone: 'blue' | 'amber' | 'green' | 'default' }) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-900' : tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900' : tone === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-card border-border text-foreground';
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><Icon className="h-4 w-4 mb-2" /><p className="text-2xl font-bold tabular-nums">{value}</p><p className="data-label text-[10px] mt-1">{label}</p><p className="text-xs mt-1 opacity-80">{sub}</p></div>;
}

function FileButton({ label, icon, uploading, capture, onFile }: { label: string; icon: 'camera' | 'upload'; uploading: boolean; capture?: boolean; onFile: (file: File) => void }) {
  const Icon = icon === 'camera' ? Camera : Upload;
  return <label className="cursor-pointer"><input type="file" accept="image/*" capture={capture ? 'environment' : undefined} className="sr-only" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.currentTarget.value = ''; }} /><span className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50 transition-colors">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{uploading ? 'Laddar upp...' : label}</span></label>;
}

function Field({ label, value, setValue, placeholder, type = 'text' }: { label: string; value: string; setValue: (v: string) => void; placeholder?: string; type?: string }) {
  return <label className="space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span><Input type={type} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="rounded-xl h-11" /></label>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-muted/30 border p-3"><p className="font-bold text-foreground tabular-nums truncate">{value}</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p></div>;
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

function MarketingOutput({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <Card className="border-border/50 bg-card/80 shadow-sm"><CardContent className="p-4 space-y-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><Icon className="h-4 w-4 text-primary shrink-0" /><h3 className="font-serif text-sm truncate">{title}</h3></div><Button variant="ghost" size="sm" onClick={() => copyText(text, title)} className="h-8 px-2 rounded-lg"><Copy className="h-3.5 w-3.5 mr-1" /> Kopiera</Button></div><Textarea value={text} readOnly className="min-h-[120px] rounded-xl text-xs leading-relaxed resize-none bg-muted/25" /></CardContent></Card>;
}
