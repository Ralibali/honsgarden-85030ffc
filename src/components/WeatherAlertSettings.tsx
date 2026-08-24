import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  latitude?: number;
  longitude?: number;
  cityName?: string | null;
}

interface Prefs {
  enabled: boolean;
  heat_threshold_c: number;
  cold_threshold_c: number;
  rain_threshold_mm: number;
  wind_threshold_ms: number;
  notify_email: boolean;
  notify_in_app: boolean;
}

const DEFAULTS: Prefs = {
  enabled: true,
  heat_threshold_c: 28,
  cold_threshold_c: -10,
  rain_threshold_mm: 15,
  wind_threshold_ms: 12,
  notify_email: true,
  notify_in_app: true,
};

export default function WeatherAlertSettings({ latitude, longitude, cityName }: Props) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('weather_alert_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled,
          heat_threshold_c: Number(data.heat_threshold_c),
          cold_threshold_c: Number(data.cold_threshold_c),
          rain_threshold_mm: Number(data.rain_threshold_mm),
          wind_threshold_ms: Number(data.wind_threshold_ms),
          notify_email: data.notify_email,
          notify_in_app: data.notify_in_app,
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('weather_alert_preferences')
        .upsert(
          {
            user_id: user.id,
            ...prefs,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            city_name: cityName ?? null,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      toast.success('Inställningar sparade');
    } catch (e: any) {
      toast.error(e?.message ?? 'Kunde inte spara');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hämtar inställningar...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-lg">Väderaviseringar</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Få notis dagen innan värme, kyla, regn eller vind väntas påverka hönsen.
            </p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))}
          />
        </div>

        {prefs.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Värmevarning vid (°C)</Label>
                <Input
                  type="number"
                  value={prefs.heat_threshold_c}
                  onChange={(e) => setPrefs((p) => ({ ...p, heat_threshold_c: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Köldvarning vid (°C)</Label>
                <Input
                  type="number"
                  value={prefs.cold_threshold_c}
                  onChange={(e) => setPrefs((p) => ({ ...p, cold_threshold_c: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Regnvarning vid (mm/dygn)</Label>
                <Input
                  type="number"
                  value={prefs.rain_threshold_mm}
                  onChange={(e) => setPrefs((p) => ({ ...p, rain_threshold_mm: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vindvarning vid (m/s)</Label>
                <Input
                  type="number"
                  value={prefs.wind_threshold_ms}
                  onChange={(e) => setPrefs((p) => ({ ...p, wind_threshold_ms: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Skicka som notis i appen</Label>
                <Switch
                  checked={prefs.notify_in_app}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, notify_in_app: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Skicka som mejl</Label>
                <Switch
                  checked={prefs.notify_email}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, notify_email: v }))}
                />
              </div>
            </div>
          </>
        )}

        <Button onClick={save} disabled={saving} className="w-full rounded-2xl">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Spara inställningar
        </Button>
      </CardContent>
    </Card>
  );
}
