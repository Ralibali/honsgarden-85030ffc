import { describe, it, expect } from 'vitest';
import { leadsToCsv, generatePersonalDraft, statusLabel, LEAD_STATUSES, type SalesLead } from '@/lib/salesLeads';

const baseLead: SalesLead = {
  id: 'a1',
  name: 'Grönskogens Höns',
  business_type: 'hönsgård',
  website: 'https://gronhon.se',
  website_domain: 'gronhon.se',
  public_email: 'info@gronhon.se',
  public_phone: '+46701234567',
  city: 'Uppsala',
  region: null,
  social_urls: { facebook: 'https://facebook.com/gronhon' },
  source_url: 'https://gronhon.se/kontakt',
  source_title: 'Kontakt – Grönskogens Höns',
  source_description: 'Vi säljer ägg och höns i Uppsala.',
  relevance_score: 45,
  status: 'new',
  notes: null,
  do_not_contact: false,
  last_contacted_at: null,
  found_at: '2026-11-15T10:00:00Z',
  created_at: '2026-11-15T10:00:00Z',
  updated_at: '2026-11-15T10:00:00Z',
};

describe('leadsToCsv', () => {
  it('emits header and row values', () => {
    const csv = leadsToCsv([baseLead]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('public_email');
    expect(lines[1]).toContain('Grönskogens Höns');
    expect(lines[1]).toContain('info@gronhon.se');
  });

  it('neutralizes CSV injection prefixes', () => {
    const evil = { ...baseLead, name: '=cmd|calc' };
    const csv = leadsToCsv([evil]);
    // Prefix ' + then wrapped in quotes because contains no comma but has "="; still safe.
    expect(csv).toContain("'=cmd|calc");
    expect(csv).not.toMatch(/^=cmd/m);
  });

  it('escapes commas and quotes', () => {
    const l = { ...baseLead, notes: 'Han sa "hej, kompis"' };
    const csv = leadsToCsv([l]);
    expect(csv).toContain('"Han sa ""hej, kompis"""');
  });
});

describe('generatePersonalDraft', () => {
  it('personalizes with name, city and business type', () => {
    const d = generatePersonalDraft(baseLead, { senderName: 'Anna', productName: 'Hönsgården' });
    expect(d).toContain('Hej Grönskogens Höns');
    expect(d).toContain('Uppsala');
    expect(d).toContain('hönsgård');
    expect(d).toContain('Anna');
  });

  it('includes opt-out phrase for GDPR compliance', () => {
    const d = generatePersonalDraft(baseLead);
    expect(d.toLowerCase()).toContain('nej tack');
  });

  it('falls back to safe defaults when fields missing', () => {
    const minimal: SalesLead = { ...baseLead, name: '', city: null, business_type: null };
    const d = generatePersonalDraft(minimal);
    expect(d).toContain('Hej,');
    expect(d).not.toContain('undefined');
    expect(d).not.toContain('null');
  });
});

describe('statusLabel', () => {
  it('maps all known statuses', () => {
    for (const s of LEAD_STATUSES) {
      expect(statusLabel(s)).not.toBe(s === 'new' ? 'new' : s === 'customer' ? 'customer' : statusLabel(s));
    }
    expect(statusLabel('new')).toBe('Ny');
    expect(statusLabel('customer')).toBe('Kund');
  });
});
