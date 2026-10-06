import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseDelimited } from '../../supabase/functions/sync-affiliate-feed/csv.ts';
import {
  isRelevantAwin,
  mapAwinProduct,
  readFeedText,
  resolveAwinFeedUrl,
} from '../../supabase/functions/sync-affiliate-feed/awin.ts';

const CSV = [
  'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,rrp_price,merchant_name,merchant_id,merchant_deep_link,in_stock,currency',
  '"https://www.awin1.com/pclick.php?p=1&a=2&m=3","Vattenautomat för höns, 5 liter",111,A1,https://img/x.jpg,"Frostfri vattenautomat för hönshuset",Fjäderfä,"349,00",399,Butiken AB,3,https://butik.se/vattenautomat,1,SEK',
  '"https://www.awin1.com/pclick.php?p=2&a=2&m=3",Hundbädd XL,222,A2,https://img/y.jpg,Mjuk bädd för hund,Hund,499,,Butiken AB,3,https://butik.se/hund,1,SEK',
].join('\n');

describe('Awin product feed', () => {
  it('keeps poultry products and maps them like the other feeds', () => {
    const rows = parseDelimited(CSV, ',');
    const relevant = rows.filter(isRelevantAwin);
    expect(relevant.map((row) => row.product_name)).toEqual(['Vattenautomat för höns, 5 liter']);
    const record = mapAwinProduct(relevant[0], 'adv-1', '2026-10-06T00:00:00Z');
    expect(record).toMatchObject({
      advertiser_id: 'adv-1',
      external_id: '111',
      category: 'vatten',
      price: '349 kr',
      price_original: 399,
      in_stock: true,
      image_url: 'https://img/x.jpg',
      product_url: 'https://butik.se/vattenautomat',
      affiliate_url: 'https://www.awin1.com/pclick.php?p=1&a=2&m=3',
    });
    expect(record.specs).toMatchObject({ source: 'awin', merchant: 'Butiken AB' });
  });

  it('reads the API key from the secret, never from the stored URL', () => {
    const stored = 'https://productdata.awin.com/datafeed/download/apikey/{AWIN_API_KEY}/fid/9/format/csv/';
    expect(resolveAwinFeedUrl(stored, 'k3y')).toBe('https://productdata.awin.com/datafeed/download/apikey/k3y/fid/9/format/csv/');
    expect(() => resolveAwinFeedUrl(stored, undefined)).toThrow('AWIN_API_KEY saknas');
  });

  it('reads gzip and plain feeds', async () => {
    expect(await readFeedText(new Response(gzipSync(Buffer.from(CSV, 'utf8'))))).toBe(CSV);
    expect(await readFeedText(new Response(CSV))).toBe(CSV);
  });
});
