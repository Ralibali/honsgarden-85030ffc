import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Listing = {
  id: string;
  slug: string;
  title: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  price_per_pack: number | null;
  eggs_per_pack: number | null;
  image_url: string | null;
  sold_out_manually: boolean | null;
};

const eggIcon = L.divIcon({
  html: '<div style="font-size:24px;line-height:1;text-align:center;">🥚</div>',
  className: "egg-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const SWEDEN_CENTER: [number, number] = [62.0, 15.0];

export default function MarketplaceMap() {
  const [center, setCenter] = useState<[number, number]>(SWEDEN_CENTER);
  const [zoom, setZoom] = useState<number>(5);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(8);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 * 30 },
    );
  }, []);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["marketplace-map-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_egg_sale_listings")
        .select(
          "id, slug, title, location, latitude, longitude, price_per_pack, eggs_per_pack, image_url, sold_out_manually",
        )
        .eq("is_active", true)
        .not("latitude", "is", null);
      if (error) throw error;
      return (data || []) as Listing[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Köp färska ägg nära dig – karta | Hönsgården</title>
        <meta
          name="description"
          content="Hitta lokala hönsgårdar som säljer färska ägg nära dig. Se alla aktiva säljare på en karta över Sverige."
        />
        <link rel="canonical" href="https://honsgarden.se/karta" />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-6 sm:mb-8 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
            Ägg till salu nära dig
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upptäck lokala hönsgårdar som säljer färska ägg i hela Sverige. Klicka på en
            markör för att se annonsen och boka.
          </p>
        </header>

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
              {listings.map((l) =>
                l.latitude != null && l.longitude != null ? (
                  <Marker
                    key={l.id}
                    position={[l.latitude, l.longitude]}
                    icon={eggIcon}
                  >
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

        {listings.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-foreground mb-4">Alla säljare</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/s/${l.slug}`}
                    className="block rounded-xl border bg-card hover:bg-accent/50 transition p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-foreground">{l.title || "Äggannons"}</strong>
                      {l.sold_out_manually ? (
                        <Badge variant="secondary">Slutsåld</Badge>
                      ) : null}
                    </div>
                    {l.location ? (
                      <div className="text-sm text-muted-foreground mt-1">{l.location}</div>
                    ) : null}
                    <div className="text-sm text-foreground mt-2">
                      {l.eggs_per_pack ?? 6}-pack {Math.round(Number(l.price_per_pack || 0))} kr
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
