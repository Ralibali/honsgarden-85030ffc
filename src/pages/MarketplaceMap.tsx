import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ORTER, getOrt } from "@/data/saljaAggOrter";
import AddMapListingDialog from "@/components/map/AddMapListingDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  Sparkles,
  Search,
  SlidersHorizontal,
  Navigation,
  MapPin,
  X,
  Eye,
  Frame,
  ExternalLink,
  Locate,
} from "lucide-react";

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

type Listing = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  price_per_pack: number | null;
  eggs_per_pack: number | null;
  image_url: string | null;
  sold_out_manually: boolean | null;
  created_at: string | null;
};

const eggIcon = L.divIcon({
  html: '<div style="font-size:24px;line-height:1;text-align:center;">🥚</div>',
  className: "egg-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const SWEDEN_CENTER: [number, number] = [62.0, 15.0];

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points as any, { padding: [40, 40], maxZoom: 12 });
    }
  }, [points, map]);
  return null;
}

function FlyTo({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type SortMode = "closest" | "cheapest" | "newest";

export default function MarketplaceMap() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ortSlug = params.get("ort");
  const ort = ortSlug ? getOrt(ortSlug) : undefined;

  const [center, setCenter] = useState<[number, number]>(SWEDEN_CENTER);
  const [zoom, setZoom] = useState<number>(5);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState<number>(11);

  // Search & filter state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("closest");
  const [hideSoldOut, setHideSoldOut] = useState(true);
  const [maxPrice, setMaxPrice] = useState<number>(150);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const title = ort
      ? `Köp färska ägg i ${ort.name} – karta | Hönsgården`
      : "Köp färska ägg nära dig – karta | Hönsgården";
    const desc = ort
      ? `Hitta lokala hönsgårdar som säljer färska ägg i ${ort.name}. Se alla aktiva säljare på en karta.`
      : "Hitta lokala hönsgårdar som säljer färska ägg nära dig. Se alla aktiva säljare på en karta över Sverige.";
    document.title = title;
    setMeta("description", desc);
    if (ort) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(p);
        setZoom(8);
        setUserPos(p);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 * 30 },
    );
  }, [ort]);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["marketplace-map-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_egg_sale_listings")
        .select(
          "id, slug, title, description, location, latitude, longitude, price_per_pack, eggs_per_pack, image_url, sold_out_manually, created_at",
        )
        .eq("is_active", true)
        .not("latitude", "is", null);
      if (error) throw error;
      return (data || []) as Listing[];
    },
  });

  // Apply ort scope, search, filters, sort
  const displayed = useMemo(() => {
    let list = listings.slice();

    if (ort) {
      const needle = ort.name.toLowerCase();
      list = list.filter((l) => (l.location ?? "").toLowerCase().includes(needle));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        [l.title, l.location, l.description]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q)),
      );
    }

    if (hideSoldOut) list = list.filter((l) => !l.sold_out_manually);
    list = list.filter((l) => Number(l.price_per_pack ?? 0) <= maxPrice);

    const sortRef = userPos ?? center;
    list.sort((a, b) => {
      if (sort === "cheapest") {
        return Number(a.price_per_pack ?? 0) - Number(b.price_per_pack ?? 0);
      }
      if (sort === "newest") {
        return (
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
        );
      }
      // closest
      const da =
        a.latitude != null && a.longitude != null
          ? haversineKm(sortRef, [a.latitude, a.longitude])
          : Infinity;
      const db =
        b.latitude != null && b.longitude != null
          ? haversineKm(sortRef, [b.latitude, b.longitude])
          : Infinity;
      return da - db;
    });

    return list;
  }, [listings, ort, query, hideSoldOut, maxPrice, sort, userPos, center]);

  const markerPoints = useMemo<[number, number][]>(
    () =>
      displayed
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => [l.latitude as number, l.longitude as number]),
    [displayed],
  );

  // Quick-pick popular cities
  const popularCities = useMemo(
    () =>
      ["goteborg", "malmo", "stockholm", "uppsala", "linkoping", "lund", "boras", "umea"]
        .map((s) => ORTER.find((o) => o.slug === s))
        .filter(Boolean) as typeof ORTER,
    [],
  );

  const heading = ort ? `Ägg till salu i ${ort.name}` : "Ägg till salu nära dig";
  const subheading = ort
    ? `Lokala hönsgårdar i ${ort.name} med färska ägg.`
    : "Sök, filtrera och hitta lokala hönsgårdar som säljer färska ägg i hela Sverige.";

  const ortEmpty = !!ort && displayed.length === 0 && !isLoading;

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        setFlyTarget(p);
        setFlyZoom(10);
        setSort("closest");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const clearOrt = () => {
    const next = new URLSearchParams(params);
    next.delete("ort");
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-6 sm:mb-8 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">{heading}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{subheading}</p>
        </header>

        {/* Search + filter bar */}
        <div className="mb-4 rounded-2xl border bg-card shadow-sm p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök ort, gård eller beskrivning…"
                className="pl-9 h-11"
                aria-label="Sök bland säljare"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  aria-label="Rensa sökning"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={useMyLocation}
                disabled={locating}
                className="h-11"
              >
                <Navigation className="h-4 w-4 mr-1.5" />
                {locating ? "Hittar…" : "Nära mig"}
              </Button>

              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger className="h-11 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closest">Närmast</SelectItem>
                  <SelectItem value="cheapest">Billigast</SelectItem>
                  <SelectItem value="newest">Nyast</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11" aria-label="Filter">
                    <SlidersHorizontal className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Filter</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">Max pris/pack</Label>
                        <span className="text-sm font-medium tabular-nums">
                          {maxPrice} kr
                        </span>
                      </div>
                      <Slider
                        value={[maxPrice]}
                        min={20}
                        max={200}
                        step={5}
                        onValueChange={(v) => setMaxPrice(v[0])}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hide-sold" className="text-sm">
                        Dölj slutsålda
                      </Label>
                      <Switch
                        id="hide-sold"
                        checked={hideSoldOut}
                        onCheckedChange={setHideSoldOut}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick city chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground mr-1">Snabbval:</span>
            {ort && (
              <Badge
                variant="default"
                className="cursor-pointer gap-1"
                onClick={clearOrt}
              >
                <MapPin className="h-3 w-3" /> {ort.name}
                <X className="h-3 w-3 ml-0.5" />
              </Badge>
            )}
            {popularCities.map((o) => (
              <button
                key={o.slug}
                onClick={() => navigate(`/karta?ort=${o.slug}`)}
                className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition"
              >
                {o.name}
              </button>
            ))}
            <Link
              to="/salja-agg"
              className="text-xs px-2.5 py-1 rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
            >
              Alla orter →
            </Link>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            {isLoading
              ? "Laddar säljare…"
              : `${displayed.length} ${displayed.length === 1 ? "säljare" : "säljare"} hittade${ort ? ` i ${ort.name}` : ""}`}
          </div>
        </div>

        {/* CTA */}
        <div className="mb-6 sm:mb-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl text-foreground">
                Säljer du egna ägg? Lägg upp på kartan — gratis
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Inget konto krävs. Bekräfta via mejl och din annons syns direkt — i 60 dagar.
              </p>
            </div>
          </div>
          <AddMapListingDialog
            trigger={
              <Button size="lg" className="shrink-0 shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" /> Lägg till din annons
              </Button>
            }
          />
        </div>

        {ortEmpty && (
          <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg text-foreground">
                Inga säljare i {ort!.name} än
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bli först! Sälj dina egna ägg och dyk upp här direkt.
              </p>
            </div>
            <AddMapListingDialog
              trigger={
                <Button size="lg" className="shrink-0">
                  Bli först — lägg upp din annons →
                </Button>
              }
            />
          </div>
        )}

        {isLoading ? (
          <div className="h-[70vh] w-full rounded-2xl border bg-card/40 flex items-center justify-center text-muted-foreground">
            Laddar karta…
          </div>
        ) : listings.length === 0 ? (
          <div className="h-[40vh] w-full rounded-2xl border bg-card/40 flex items-center justify-center text-center px-6 text-muted-foreground">
            Inga säljare på kartan än – kom snart tillbaka.
          </div>
        ) : (
          <div className="h-[70vh] w-full rounded-2xl overflow-hidden border shadow-sm">
            <MapContainer
              center={center}
              zoom={zoom}
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-bidragsgivare</a>'
              />
              <FlyTo center={flyTarget} zoom={flyZoom} />
              {ort && displayed.length > 0 && <FitToMarkers points={markerPoints} />}
              {userPos && (
                <Marker
                  position={userPos}
                  icon={L.divIcon({
                    html: '<div style="width:14px;height:14px;border-radius:9999px;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px rgba(59,130,246,0.4);"></div>',
                    className: "user-marker",
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                  })}
                >
                  <Popup>Din plats</Popup>
                </Marker>
              )}
              {displayed.map((l) =>
                l.latitude != null && l.longitude != null ? (
                  <Marker key={l.id} position={[l.latitude, l.longitude]} icon={eggIcon}>
                    <Popup>
                      <div className="space-y-2 min-w-[180px]">
                        {l.image_url ? (
                          <img
                            src={l.image_url}
                            alt={l.title || "Äggannons"}
                            className="w-full h-24 object-cover rounded-md"
                            loading="lazy"
                          />
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-sm">{l.title || "Äggannons"}</strong>
                          {l.sold_out_manually ? (
                            <Badge variant="secondary">Slutsåld</Badge>
                          ) : null}
                        </div>
                        {l.location ? (
                          <div className="text-xs text-muted-foreground">{l.location}</div>
                        ) : null}
                        <div className="text-sm">
                          {l.eggs_per_pack ?? 6}-pack {Math.round(Number(l.price_per_pack || 0))} kr
                        </div>
                        <Link
                          to={`/s/${l.slug}`}
                          className="inline-block text-sm font-medium text-primary hover:underline"
                        >
                          Se annons & boka →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ) : null,
              )}
            </MapContainer>
          </div>
        )}

        {displayed.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              {ort ? `Säljare i ${ort.name}` : "Alla säljare"}
              <span className="text-sm text-muted-foreground font-sans font-normal ml-2">
                ({displayed.length})
              </span>
            </h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayed.map((l) => {
                const dist =
                  userPos && l.latitude != null && l.longitude != null
                    ? haversineKm(userPos, [l.latitude, l.longitude])
                    : null;
                return (
                  <li key={l.id}>
                    <Link
                      to={`/s/${l.slug}`}
                      className="block rounded-xl border bg-card hover:bg-accent/50 transition p-4 h-full"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-foreground">
                          {l.title || "Äggannons"}
                        </strong>
                        {l.sold_out_manually ? (
                          <Badge variant="secondary">Slutsåld</Badge>
                        ) : null}
                      </div>
                      {l.location ? (
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {l.location}
                          {dist != null && (
                            <span className="ml-auto text-xs">
                              {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className="text-sm text-foreground mt-2 font-medium">
                        {l.eggs_per_pack ?? 6}-pack{" "}
                        {Math.round(Number(l.price_per_pack || 0))} kr
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {displayed.length === 0 && listings.length > 0 && !ortEmpty && (
          <div className="mt-6 rounded-2xl border bg-card/40 p-6 text-center text-muted-foreground">
            Inga säljare matchar din sökning.{" "}
            <button
              className="text-primary hover:underline"
              onClick={() => {
                setQuery("");
                setMaxPrice(200);
                setHideSoldOut(false);
              }}
            >
              Rensa filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
