import { describe, it, expect } from 'vitest';
import { boldMarkdownToSafeHtml } from '../safeHtml';

describe('boldMarkdownToSafeHtml', () => {
  it('konverterar **fetstil** till <strong>', () => {
    expect(boldMarkdownToSafeHtml('Ge **mycket vatten** idag')).toBe(
      'Ge <strong>mycket vatten</strong> idag',
    );
  });

  it('strippar skadlig HTML (XSS-skydd för AI-genererad text)', () => {
    const dirty = 'Tips <script>alert(1)</script> <img src=x onerror=alert(1)> **bra**';
    const out = boldMarkdownToSafeHtml(dirty);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
    expect(out).toContain('<strong>bra</strong>');
  });

  it('tar bort länkar och annan markup men behåller texten', () => {
    const out = boldMarkdownToSafeHtml('<a href="https://evil.example">klicka</a> här');
    expect(out).not.toContain('<a');
    expect(out).toContain('klicka');
  });
});
