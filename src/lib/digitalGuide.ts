// Delade konstanter för det digitala engångsköpet "Mina första höns".
// Omslaget är den riktiga första sidan ur PDF:en och ligger som statisk fil.
// Smakprovet strömmas av edge-funktionen digital-sample, som klipper ut de
// fyra första sidorna ur originalfilen – samma innehåll som i köpta guiden.

export const GUIDE_COVER_PATH = '/guider/mina-forsta-hons-omslag.jpg';
export const GUIDE_COVER_URL = `https://honsgarden.se${GUIDE_COVER_PATH}`;

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`;

export const GUIDE_SAMPLE_URL = `${FUNCTIONS_BASE}/digital-sample?produkt=mina-forsta-hons`;
export const GUIDE_SAMPLE_PAGES = 4;
