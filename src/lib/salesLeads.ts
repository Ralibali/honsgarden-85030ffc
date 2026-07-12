/**
 * Verktyg för leads-hantering i admin (CSV-export, personligt utkast).
 * Ren logik utan side effects för att kunna enhetstestas.
 */

export interface SalesLead {
  id: string;
  name: string;
  business_type: string | null;
  website: string | null;
  website_domain: string | null;
  public_email: string | null;
  public_phone: string | null;
  city: string | null;
  region: string | null;
  social_urls: Record<string, string> | null;
  source_url: string | null;
  source_title: string | null;
  source_description: string | null;
  relevance_score: number;
  status: string;
  notes: string | null;
  do_not_contact: boolean;
  last_contacted_at: string | null;
  found_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const LEAD_STATUSES = [
  'new',
  'reviewed',
  'qualified',
  'contacted',
  'interested',
  'customer',
  'rejected',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const CSV_FIELDS: Array<keyof SalesLead> = [
  'name',
  'business_type',
  'website',
  'public_email',
  'public_phone',
  'city',
  'region',
  'status',
  'relevance_score',
  'do_not_contact',
  'source_url',
  'notes',
  'found_at',
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralisera CSV-injection (=+-@) — de kan bli formler i Excel.
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function leadsToCsv(leads: SalesLead[]): string {
  const header = CSV_FIELDS.join(',');
  const rows = leads.map((lead) => CSV_FIELDS.map((f) => csvEscape(lead[f])).join(','));
  return [header, ...rows].join('\n');
}

export interface DraftOptions {
  senderName?: string;
  senderTitle?: string;
  productName?: string;
  productUrl?: string;
}

/**
 * Genererar redigerbar utkastext lokalt. Skickas ALDRIG automatiskt.
 * All personalisering är minimal och baseras enbart på publikt tillgänglig
 * information (namn, ort). Innehåller GDPR/opt-out-fras.
 */
export function generatePersonalDraft(lead: SalesLead, opts: DraftOptions = {}): string {
  const senderName = opts.senderName?.trim() || '[Ditt namn]';
  const senderTitle = opts.senderTitle?.trim() || 'Hönsgården';
  const productName = opts.productName?.trim() || 'Hönsgården';
  const productUrl = opts.productUrl?.trim() || 'https://honsgarden.se';

  const salutation = lead.name ? `Hej ${lead.name},` : 'Hej,';
  const location = lead.city ? ` i ${lead.city}` : '';
  const businessLine = lead.business_type
    ? `Jag såg att ni driver ${lead.business_type}${location}.`
    : `Jag hittade er verksamhet${location} när jag läste om småskaliga äggproducenter.`;

  return [
    `Ämne: Kort fråga från ${productName}`,
    '',
    salutation,
    '',
    businessLine,
    '',
    `Jag heter ${senderName} och jobbar med ${productName} (${productUrl}) – en app för hönsägare i Sverige.`,
    'Skulle det vara okej att jag berättar kort om vad vi gör, för att se om det kan vara relevant för er?',
    '',
    'Om det inte är intressant är det bara att svara "nej tack" så återkommer jag inte.',
    '',
    'Vänliga hälsningar,',
    senderName,
    senderTitle,
  ].join('\n');
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Ny',
    reviewed: 'Granskad',
    qualified: 'Kvalificerad',
    contacted: 'Kontaktad',
    interested: 'Intresserad',
    customer: 'Kund',
    rejected: 'Avvisad',
  };
  return map[status] ?? status;
}
