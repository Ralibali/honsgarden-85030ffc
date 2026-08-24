import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CountrySelect } from "@/components/CountrySelect";
import { COUNTRIES, type CountryCode, detectTimezone } from "@/lib/countries";
import { ENABLED_LANGUAGES, setLanguageSafe } from "@/i18n";
import { validatePostalCode } from "@/lib/postalCode";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Globe } from "lucide-react";

interface RegionalRow {
  country_code: string | null;
  language_code: string | null;
  locale: string | null;
  timezone: string | null;
  currency_code: string | null;
  measurement_system: string | null;
  temperature_unit: string | null;
  postal_code: string | null;
}

// Lättare än hela IANA-listan: vanliga zoner som täcker våra aktiverade länder.
const COMMON_TIMEZONES = [
  "Europe/Stockholm","Europe/Oslo","Europe/Copenhagen","Europe/Helsinki",
  "Europe/London","Europe/Amsterdam","Europe/Berlin",
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Toronto","America/Vancouver",
  "Australia/Sydney","Australia/Melbourne","Australia/Perth",
  "Pacific/Auckland",
];

const CURRENCIES = ["SEK","NOK","DKK","EUR","GBP","USD","CAD","AUD","NZD"];

export function RegionLanguageSettings() {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<RegionalRow | null>(null);
  const [confirmCountry, setConfirmCountry] = useState<CountryCode | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("country_code,language_code,locale,timezone,currency_code,measurement_system,temperature_unit,postal_code")
        .eq("user_id", user.id)
        .maybeSingle();
      setRow(data ?? {
        country_code: "SE", language_code: "sv", locale: "sv-SE",
        timezone: detectTimezone("Europe/Stockholm"), currency_code: "SEK",
        measurement_system: "metric", temperature_unit: "C", postal_code: null,
      });
      setLoading(false);
    })();
  }, [user]);

  if (loading || !row || !user) {
    return null;
  }

  const update = (patch: Partial<RegionalRow>) => setRow(prev => prev ? { ...prev, ...patch } : prev);

  const handleCountryChange = (next: CountryCode) => {
    const def = COUNTRIES[next];
    const hasCustom =
      (row.language_code && row.language_code !== COUNTRIES[(row.country_code as CountryCode) ?? "SE"]?.language) ||
      (row.currency_code && row.currency_code !== COUNTRIES[(row.country_code as CountryCode) ?? "SE"]?.currency) ||
      (row.measurement_system && row.measurement_system !== COUNTRIES[(row.country_code as CountryCode) ?? "SE"]?.measurement) ||
      (row.temperature_unit && row.temperature_unit !== COUNTRIES[(row.country_code as CountryCode) ?? "SE"]?.temperature);
    if (hasCustom) {
      setConfirmCountry(next);
      return;
    }
    update({
      country_code: next,
      language_code: def.language,
      locale: def.locale,
      currency_code: def.currency,
      measurement_system: def.measurement,
      temperature_unit: def.temperature,
    });
  };

  const applyCountryDefaults = (next: CountryCode) => {
    const def = COUNTRIES[next];
    update({
      country_code: next,
      language_code: def.language,
      locale: def.locale,
      currency_code: def.currency,
      measurement_system: def.measurement,
      temperature_unit: def.temperature,
    });
    setConfirmCountry(null);
  };

  const keepMine = (next: CountryCode) => {
    update({ country_code: next, locale: COUNTRIES[next].locale });
    setConfirmCountry(null);
  };

  const handleSave = async () => {
    const check = validatePostalCode(row.postal_code, row.country_code);
    if (!check.ok) {
      toast({ title: t("postal_code"), description: "Ogiltigt format för valt land.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        country_code: row.country_code,
        language_code: row.language_code,
        locale: row.locale,
        timezone: row.timezone,
        currency_code: row.currency_code,
        measurement_system: row.measurement_system,
        temperature_unit: row.temperature_unit,
        postal_code: row.postal_code,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
      return;
    }
    setLanguageSafe(row.language_code);
    toast({ title: t("saved") });
  };

  return (
    <>
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            {t("region_and_language")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("country_change_note")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">{t("country")}</Label>
              <div className="mt-1.5">
                <CountrySelect
                  value={(row.country_code as CountryCode) ?? "SE"}
                  onChange={handleCountryChange}
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t("language")}</Label>
              <Select value={row.language_code ?? "sv"} onValueChange={(v) => update({ language_code: v })}>
                <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENABLED_LANGUAGES.map(l => (
                    <SelectItem key={l} value={l}>{l === "sv" ? "Svenska" : "English"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t("timezone")}</Label>
              <Select value={row.timezone ?? "Europe/Stockholm"} onValueChange={(v) => update({ timezone: v })}>
                <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t("currency")}</Label>
              <Select value={row.currency_code ?? "SEK"} onValueChange={(v) => update({ currency_code: v })}>
                <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t("temperature")}</Label>
              <Select value={row.temperature_unit ?? "C"} onValueChange={(v) => update({ temperature_unit: v })}>
                <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">{t("celsius")}</SelectItem>
                  <SelectItem value="F">{t("fahrenheit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">{t("measurement")}</Label>
              <Select value={row.measurement_system ?? "metric"} onValueChange={(v) => update({ measurement_system: v })}>
                <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">{t("metric")}</SelectItem>
                  <SelectItem value="imperial">{t("imperial")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground text-xs">{t("postal_code")}</Label>
              <Input
                value={row.postal_code ?? ""}
                onChange={(e) => update({ postal_code: e.target.value })}
                className="mt-1.5 h-11"
                placeholder=""
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Sparar…" : "Spara"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmCountry} onOpenChange={(o) => !o && setConfirmCountry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("country_change_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("country_change_confirm_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => confirmCountry && keepMine(confirmCountry)}>
              {t("keep_mine")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmCountry && applyCountryDefaults(confirmCountry)}>
              {t("use_defaults")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
