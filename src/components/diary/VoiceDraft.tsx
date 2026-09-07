import { useEffect, useId, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ResultEvent = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function VoiceDraft({
  onUse,
  disabled = false,
  onDirtyChange,
}: {
  onUse: (text: string) => void;
  disabled?: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const fieldId = useId();
  const recognition = useRef<Recognition | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    onDirtyChange(listening || !!draft.trim());
  }, [listening, draft, onDirtyChange]);
  const Speech =
    typeof window === "undefined"
      ? undefined
      : (window as SpeechWindow).SpeechRecognition ||
        (window as SpeechWindow).webkitSpeechRecognition;
  useEffect(
    () => () => {
      clearTimeout(timeout.current);
      const active = recognition.current;
      if (active) {
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        active.abort();
        recognition.current = null;
      }
    },
    [],
  );
  function start() {
    if (!Speech || recognition.current || disabled) return;
    const active = new Speech();
    const prefix = draft.trim();
    active.lang = "sv-SE";
    active.continuous = true;
    active.interimResults = false;
    active.onresult = (event) => {
      const text = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      setDraft([prefix, text].filter(Boolean).join("\n").slice(0, 10000));
    };
    active.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Mikrofonen eller taligenkänningen är inte tillåten. Du kan skriva din text eller använda tangentbordets diktering."
          : event.error === "no-speech"
            ? "Inget tal uppfattades. Din tidigare text finns kvar."
            : "Taligenkänningen avbröts. Granska texten som hann uppfattas eller skriv själv.",
      );
      clearTimeout(timeout.current);
      active.abort();
      recognition.current = null;
      setListening(false);
    };
    active.onend = () => {
      clearTimeout(timeout.current);
      if (recognition.current === active) {
        recognition.current = null;
        setListening(false);
      }
    };
    recognition.current = active;
    setListening(true);
    setError("");
    try {
      active.start();
      timeout.current = setTimeout(() => active.stop(), 60000);
    } catch {
      recognition.current = null;
      setListening(false);
      setError(
        "Taligenkänningen kunde inte starta. Skriv texten eller använd tangentbordets diktering.",
      );
    }
  }
  if (!Speech)
    return (
      <p className="text-xs text-muted-foreground">
        Du kan använda mikrofonen på tangentbordet för att diktera. Läs igenom
        texten innan du sparar.
      </p>
    );
  return (
    <section
      className="rounded-xl border bg-muted/30 p-3 space-y-3"
      aria-label="Tal till granskat utkast"
    >
      <p className="text-sm font-medium">Berätta med din röst</p>
      <p className="text-xs text-muted-foreground">
        Webbläsarens taligenkänning används och kan behandla ljud hos sin
        leverantör. Hönsgården sparar bara text som du granskar och sedan sparar
        i dagboken.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || listening}
          onClick={start}
        >
          <Mic className="mr-2 h-4 w-4" />
          {draft ? "Fortsätt diktera" : "Starta diktering"}
        </Button>
        {listening && (
          <Button
            type="button"
            variant="outline"
            onClick={() => recognition.current?.stop()}
          >
            <Square className="mr-2 h-4 w-4" />
            Stoppa
          </Button>
        )}
      </div>
      {listening && (
        <p role="status" className="text-sm">
          Lyssnar på svenska… Stoppa när du är klar. Avslutas efter en minut.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {draft && (
        <div className="space-y-2">
          <label htmlFor={fieldId} className="text-sm font-medium">
            Granska och rätta det du sa
          </label>
          <Textarea
            id={fieldId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={listening || disabled}
            maxLength={10000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Texten blir ett dagboksutkast. Äggantal, foder och sysslor
            registreras separat.
          </p>
          <Button
            type="button"
            disabled={disabled || listening || !draft.trim()}
            onClick={() => {
              onUse(draft.trim());
              setDraft("");
              setError("");
            }}
          >
            Lägg till granskad text i inlägget
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={listening || disabled}
            onClick={() => setDraft("")}
          >
            Ta bort talutkastet
          </Button>
        </div>
      )}
    </section>
  );
}
