
-- Add merchant advertisers (idempotent)
INSERT INTO public.affiliate_advertisers (name, slug)
VALUES ('Outl1', 'outl1'), ('Vetapotek', 'vetapotek')
ON CONFLICT (slug) DO NOTHING;

-- Upsert 9 curated affiliate products. Uses external_id=EAN as the per-advertiser unique key.
WITH adv AS (
  SELECT id, slug FROM public.affiliate_advertisers WHERE slug IN ('outl1','vetapotek')
), data(merchant, name, brand, price_sek, in_stock, category, image_url, product_url, tracking_url, ean) AS (
  VALUES
    ('outl1','Hönshus med hönsgård 2×0,7×1 m','Lyfco',2695,true,'hus',
      'https://cdn3.outl1.se/img/62/ef/ab/72/1000x1000/62efab72df57738da289d91ddeb0fcd646.jpg',
      'https://outl1.se/honshus-med-utegard?var=12423',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-1-3&url=https://outl1.se/honshus-med-utegard?var=12423',
      '7333421040823'),
    ('outl1','Hönshus med hönsgård 1,9×1,7×1,6 m','Lyfco',4888,true,'hus',
      'https://cdn3.outl1.se/img/14/8d/c5/07/1000x1000/148dc50787da1aed810229ca251b00cc3e.jpg',
      'https://outl1.se/stor-honsbur-med-varprede?var=12715',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-1-5&url=https://outl1.se/stor-honsbur-med-varprede?var=12715',
      '7333421040847'),
    ('outl1','Värprede med 6 fack – galvaniserat stål','Lyfco',1599,true,'redskap',
      'https://cdn2.outl1.se/img/23/ed/16/b2/1000x1000/23ed16b21a4bd78abde756684407428ff6.jpg',
      'https://outl1.se/varprede-6-fack?var=28548',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-3-5&url=https://outl1.se/varprede-6-fack?var=28548',
      '7333421077898'),
    ('outl1','Hönshus/voljär i aluminium 242×178×195 cm','Lyfco',3988,true,'hus',
      'https://cdn.outl1.se/img/35/ac/81/a7/1000x1000/35ac81a77eb936952ddc1d39303b425c97.jpg',
      'https://outl1.se/fagelhus-aluminium-jarnnat-242x178x195cm?var=29196',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-2-6&url=https://outl1.se/fagelhus-aluminium-jarnnat-242x178x195cm?var=29196',
      '7333421077508'),
    ('outl1','Hönshus/voljär i aluminium 122×178×195 cm','Lyfco',2495,true,'hus',
      'https://cdn2.outl1.se/img/20/ff/c8/a2/1000x1000/20ffc8a216af65d3d1165e15354ad7647a.jpg',
      'https://outl1.se/fagelhus-aluminium-jarnnat-122x178x195cm?var=29195',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-2-5&url=https://outl1.se/fagelhus-aluminium-jarnnat-122x178x195cm?var=29195',
      '7333421077492'),
    ('outl1','Stort hönshus med hönsgård 2×0,7×1,1 m','Lyfco',3499,false,'hus',
      'https://cdn.outl1.se/img/95/98/5f/91/1000x1000/95985f91b95d1cac9923ee261b06c5e637.jpg',
      'https://outl1.se/honsbur-med-honsgard?var=12427',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-1-4&url=https://outl1.se/honsbur-med-honsgard?var=12427',
      '7333421040830'),
    ('outl1','Hönshus med hönsgård 2,5×1,9×1 m','Lyfco',3999,false,'hus',
      'https://cdn2.outl1.se/img/3c/2a/d6/cf/1000x1000/3c2ad6cff0d4ea578ffb8343c22186f0f3.jpg',
      'https://outl1.se/vinkel-honshus?var=13284',
      'https://do.outl1.se/t/t?a=1728546061&as=2056181186&t=2&tk=1&cupa_sku=209-1-7&url=https://outl1.se/vinkel-honshus?var=13284',
      '7333421040861'),
    ('vetapotek','Eclipse Biofarmab Kiselgur Forte 2 kg','Eclipse Biofarmab',479,true,'tillskott',
      'https://vetapotek.se/pim/11424_0797-1.jpg',
      'https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/',
      'https://id.vetapotek.se/t/t?a=1701463577&as=2056181186&t=2&tk=1&cupa_sku=7330824007972&url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-2-kg-7330824007972/',
      '7330824007972'),
    ('vetapotek','Eclipse Biofarmab Kiselgur Forte 500 g','Eclipse Biofarmab',149,true,'tillskott',
      'https://vetapotek.se/pim/11423_0798-1.jpg',
      'https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/',
      'https://id.vetapotek.se/t/t?a=1701463577&as=2056181186&t=2&tk=1&cupa_sku=7330824007989&url=https://vetapotek.se/produkt/kosttillskott-eclipse-biofarmab-kiselgur-forte-500-g-7330824007989/',
      '7330824007989')
)
INSERT INTO public.affiliate_products
  (advertiser_id, external_id, name, price, currency, in_stock, is_active,
   category, image_url, image_urls, product_url, affiliate_url, specs)
SELECT
  adv.id,
  d.ean,
  d.name,
  d.price_sek::text || ' kr',
  'SEK',
  d.in_stock,
  true,
  d.category,
  d.image_url,
  ARRAY[d.image_url],
  d.product_url,
  d.tracking_url,
  jsonb_build_object('brand', d.brand, 'merchant', d.merchant, 'ean', d.ean, 'price_sek', d.price_sek)
FROM data d JOIN adv ON adv.slug = d.merchant
ON CONFLICT (advertiser_id, external_id) DO UPDATE
SET price = EXCLUDED.price,
    in_stock = EXCLUDED.in_stock,
    image_url = EXCLUDED.image_url,
    image_urls = EXCLUDED.image_urls,
    affiliate_url = EXCLUDED.affiliate_url,
    is_active = true,
    updated_at = now();
