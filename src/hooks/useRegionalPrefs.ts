import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCountryDefaults, detectTimezone } from "@/lib/countries";
import { setLanguageSafe } from "@/i18n";

export interface RegionalPrefsState {
  country_code: string;
  language_code: string;
  locale: string;
  timezone: string;
  currency_code: string;
  measurement_system: "metric" | "imperial";
  temperature_unit: "C" | "F";
  postal_code: string | null;
}

const FALLBACK: RegionalPrefsState = {
  country_code: "SE",
  language_code: "sv",
  locale: "sv-SE",
  timezone: "Europe/Stockholm",
  currency_code: "SEK",
  measurement_system: "metric",
  temperature_unit: "C",
  postal_code: null,
};

/**
 * Hämtar användarens regionala inställningar från `profiles`.
 * Faller tillbaka till SE-defaults för icke inloggade och vid laddning,
 * så befintliga svenska användare inte påverkas visuellt.
 */
export function useRegionalPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<RegionalPrefsState>(FALLBACK);
  const [loading, setLoading] = useState<boolean>(!!user);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setPrefs(FALLBACK);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "country_code, language_code, locale, timezone, currency_code, measurement_system, temperature_unit, postal_code",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const defaults = getCountryDefaults(data?.country_code);
      const merged: RegionalPrefsState = {
        country_code: data?.country_code ?? defaults.code,
        language_code: data?.language_code ?? defaults.language,
        locale: data?.locale ?? defaults.locale,
        timezone: data?.timezone ?? detectTimezone(defaults.timezone),
        currency_code: data?.currency_code ?? defaults.currency,
        measurement_system: (data?.measurement_system as "metric" | "imperial") ?? defaults.measurement,
        temperature_unit: (data?.temperature_unit as "C" | "F") ?? defaults.temperature,
        postal_code: data?.postal_code ?? null,
      };
      setPrefs(merged);
      setLanguageSafe(merged.language_code);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return useMemo(() => ({ ...prefs, loading }), [prefs, loading]);
}
