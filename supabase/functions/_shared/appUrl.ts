/** Public links in outgoing messages must point to the configured customer application. */
export const PUBLIC_APP_URL = (Deno.env.get('PUBLIC_APP_URL')?.trim() || 'https://honsgarden.se').replace(/\/+$/, '');
