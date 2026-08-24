import DOMPurify from 'dompurify';

/**
 * Konverterar enkel **fetstil**-markering till HTML och sanerar resultatet.
 * Säker att rendera med dangerouslySetInnerHTML även för AI-genererad text.
 * Endast <strong> tillåts – all annan HTML striptas.
 */
export function boldMarkdownToSafeHtml(text: string): string {
  const withBold = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return DOMPurify.sanitize(withBold, {
    ALLOWED_TAGS: ['strong'],
    ALLOWED_ATTR: [],
  });
}
