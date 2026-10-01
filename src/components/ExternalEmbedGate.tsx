import { useState, type ReactNode } from 'react';

type Props = { service: string; children: ReactNode; english?: boolean };
/** Load third-party content only after the visitor requests this specific embed. */
export default function ExternalEmbedGate({ service, children, english = false }: Props) {
  const [enabled, setEnabled] = useState(false);
  if (enabled) return <>{children}</>;
  return <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 bg-muted p-6 text-center text-foreground">
    <p className="max-w-md text-sm">{english
      ? `To display this content, your browser connects to ${service}. The provider receives your IP address and browser information.`
      : `För att visa innehållet ansluter din webbläsare till ${service}. Leverantören får då din IP-adress och webbläsarinformation.`}</p>
    <button type="button" onClick={() => setEnabled(true)} className="rounded-lg border bg-background px-4 py-2 text-sm font-medium">
      {english ? `Load content from ${service}` : `Visa innehåll från ${service}`}
    </button>
  </div>;
}
