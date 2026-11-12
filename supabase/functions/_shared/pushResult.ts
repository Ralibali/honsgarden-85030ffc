// Tolkar svaret från send-push.
//
// send-push svarar 200 även när ingen notis gick fram, till exempel när
// prenumerationen har dött eller web push inte är konfigurerat. Fältet `sent`
// är antalet notiser som faktiskt lämnades över (webb + app). Den som har ett
// mejl som reserv ska därför fråga här i stället för att räkna försöket som
// en leverans.
//
// Modulen har inga beroenden och kan därför testas direkt i Vitest.
export function pushDelivered(response: { data?: unknown; error?: unknown } | null | undefined): boolean {
  if (!response || response.error) return false;
  const sent = (response.data as { sent?: unknown } | null | undefined)?.sent;
  return typeof sent === "number" && sent > 0;
}
