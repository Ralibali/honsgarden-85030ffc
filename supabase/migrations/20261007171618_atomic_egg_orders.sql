begin;
alter table public.public_egg_sale_bookings
 add column if not exists unit_price_sek numeric(12,2),
 add column if not exists total_price_sek numeric(12,2),
 add column if not exists eggs_per_pack_snapshot integer,
 add column if not exists request_id uuid unique,
 add column if not exists request_digest text;
-- Historical rows deliberately keep a null snapshot: their original price is unknown.
alter table public.public_egg_sale_bookings drop constraint if exists public_egg_sale_bookings_status_check;
alter table public.public_egg_sale_bookings add constraint public_egg_sale_bookings_status_check
 check(status in ('pending','reserved','confirmed','paid','packed','picked_up','cancelled','no_show','refunded'));

create or replace function public.price_and_reserve_egg_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.public_egg_sale_listings; slot public.egg_sale_pickup_slots; reserved bigint; price numeric; tier jsonb; min_qty numeric; max_qty numeric; best_min numeric:=0;
begin
 select * into l from public.public_egg_sale_listings where id=new.listing_id for update;
 if not found or not l.is_active or coalesce(l.sold_out_manually,false) then raise exception 'Säljsidan kan inte ta emot bokningar just nu.';end if;
 if new.packs is null or new.packs<1 or new.packs>1000 then raise exception 'Ange ett helt antal kartor mellan 1 och 1 000.';end if;
 select coalesce(sum(packs),0) into reserved from public.public_egg_sale_bookings where listing_id=l.id and status<>'cancelled';
 if new.packs>coalesce(l.packs_available,0)-reserved then raise exception 'Det finns inte så många kartor kvar. Uppdatera sidan och försök igen.';end if;
 if new.pickup_slot_id is not null then
  select * into slot from public.egg_sale_pickup_slots where id=new.pickup_slot_id for update;
  if not found or slot.listing_id<>l.id or not slot.is_active or slot.starts_at<=now() or slot.current_bookings>=slot.max_bookings then raise exception 'Hämtningstiden är inte längre ledig. Välj en annan tid.';end if;
 elsif exists(select 1 from public.egg_sale_pickup_slots where listing_id=l.id and is_active and starts_at>now()) then
  raise exception 'Välj en hämtningstid.';
 end if;
 price:=l.price_per_pack;
 for tier in select value from jsonb_array_elements(case when jsonb_typeof(l.price_tiers)='array' then l.price_tiers else '[]'::jsonb end) loop
  if coalesce(tier->>'min_qty','')~'^[0-9]+$' and coalesce(tier->>'price_per_pack','')~'^[0-9]+([.][0-9]+)?$' then
   min_qty:=(tier->>'min_qty')::numeric;
   max_qty:=case when coalesce(tier->>'max_qty','')~'^[0-9]+$' then (tier->>'max_qty')::numeric else null end;
   if min_qty>=1 and new.packs>=min_qty and (max_qty is null or new.packs<=max_qty) and min_qty>=best_min and (tier->>'price_per_pack')::numeric>0 then
    price:=(tier->>'price_per_pack')::numeric;best_min:=min_qty;
   end if;
  end if;
 end loop;
 if price is null or price<0 or price>1000000 then raise exception 'Priset kunde inte bekräftas. Kontakta säljaren.';end if;
 new.seller_user_id:=l.user_id;
 new.unit_price_sek:=round(price,2);new.total_price_sek:=round(new.packs*new.unit_price_sek,2);new.eggs_per_pack_snapshot:=l.eggs_per_pack;
 return new;
end;$$;
create trigger price_and_reserve_egg_order before insert on public.public_egg_sale_bookings for each row execute function public.price_and_reserve_egg_order();

-- Anonymous customers receive only their receipt; they do not get SELECT access to orders.
create or replace function public.create_egg_order(p_request_id uuid,p_listing_id uuid,p_customer jsonb,p_packs integer,p_expected_total numeric,p_slot uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.public_egg_sale_bookings; digest text; token text; already boolean:=false;
begin
 if p_request_id is null or p_listing_id is null or p_customer is null or p_expected_total is null or p_expected_total<0 then raise exception 'Bokningen saknar uppgifter.';end if;
 if length(trim(coalesce(p_customer->>'name',''))) not between 1 and 120 or length(trim(coalesce(p_customer->>'phone',''))) not between 3 and 40 or length(coalesce(p_customer->>'email',''))>254 or coalesce(p_customer->>'email','')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(coalesce(p_customer->>'message',''))>2000 or length(coalesce(p_customer->>'pickup_name',''))>120 or length(coalesce(p_customer->>'pickup_phone',''))>40 then raise exception 'Kontrollera namn, telefonnummer och e-postadress.';end if;
 digest:=encode(sha256(convert_to(jsonb_build_object('listing',p_listing_id,'customer',p_customer,'packs',p_packs,'slot',p_slot,'total',p_expected_total)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into b from public.public_egg_sale_bookings where request_id=p_request_id;
 if found then
  if b.request_digest<>digest then raise exception 'Bokningsförsöket har ändrats. Uppdatera sidan och försök igen.';end if;
  already:=true;
 else
  insert into public.public_egg_sale_bookings(listing_id,seller_user_id,customer_name,customer_phone,customer_email,customer_message,packs,pickup_slot_id,pickup_person_name,pickup_person_phone,status,payment_status,request_id,request_digest)
  select p_listing_id,l.user_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),trim(p_customer->>'email'),nullif(trim(p_customer->>'message'),''),p_packs,p_slot,nullif(trim(p_customer->>'pickup_name'),''),nullif(trim(p_customer->>'pickup_phone'),''),'reserved','unpaid',p_request_id,digest from public.public_egg_sale_listings l where l.id=p_listing_id returning * into b;
  if not found then raise exception 'Säljsidan kunde inte hittas.';end if;
  if b.total_price_sek<>round(p_expected_total,2) then raise exception 'Priset har ändrats. Uppdatera sidan och kontrollera det nya priset innan du bokar.';end if;
 end if;
 select t.token into token from public.egg_sale_booking_tokens t where booking_id=b.id;
 return jsonb_build_object('id',b.id,'reference',upper(substr(b.id::text,1,8)),'token',token,'packs',b.packs,'unit_price_sek',b.unit_price_sek,'total_price_sek',b.total_price_sek,'eggs_per_pack',b.eggs_per_pack_snapshot,'duplicate',already);
end;$$;
revoke all on function public.create_egg_order(uuid,uuid,jsonb,integer,numeric,uuid) from public;
grant execute on function public.create_egg_order(uuid,uuid,jsonb,integer,numeric,uuid) to anon,authenticated;
revoke insert, update on public.public_egg_sale_bookings from anon,authenticated;

-- Seller-only token access supports "copy order link" without exposing customer tokens publicly.
grant select on public.egg_sale_booking_tokens to authenticated;
create policy "Sellers read own order tokens" on public.egg_sale_booking_tokens for select to authenticated using(exists(select 1 from public.public_egg_sale_bookings b where b.id=booking_id and b.seller_user_id=auth.uid()));

-- Preserve snapshots even when the seller updates an order or the listing price.
create or replace function public.keep_egg_order_price() returns trigger language plpgsql set search_path='' as $$ begin
 if new.unit_price_sek is distinct from old.unit_price_sek or new.total_price_sek is distinct from old.total_price_sek or new.eggs_per_pack_snapshot is distinct from old.eggs_per_pack_snapshot or new.packs<>old.packs or new.listing_id<>old.listing_id or new.seller_user_id<>old.seller_user_id or new.request_id is distinct from old.request_id or new.request_digest is distinct from old.request_digest then raise exception 'Orderns antal och pris är låsta. Avboka och skapa en ny order om de ska ändras.';end if;
 return new;
end;$$;
create trigger keep_egg_order_price before update on public.public_egg_sale_bookings for each row execute function public.keep_egg_order_price();

create or replace function public.transition_egg_booking_status(p_booking_id uuid,p_new_status text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.public_egg_sale_bookings; next_status text; next_payment text;
begin
 if auth.uid() is null then raise exception 'Logga in först.';end if;
 select * into b from public.public_egg_sale_bookings where id=p_booking_id for update;
 if not found or b.seller_user_id<>auth.uid() then raise exception 'Bokningen kunde inte hittas.';end if;
 next_status:=b.status;next_payment:=b.payment_status;
 if p_new_status='paid' then
  if b.status in ('cancelled','refunded','no_show') then raise exception 'Bokningen är avslutad.';end if;
  next_payment:='paid';if b.status in ('pending','reserved','confirmed') then next_status:='paid';end if;
 elsif p_new_status='refunded' then
  if b.payment_status<>'paid' then raise exception 'Bokningen är inte markerad som betald.';end if;
  next_payment:='refunded'; -- Refunding never moves physical eggs back into inventory.
 elsif p_new_status=b.status then return jsonb_build_object('ok',true,'unchanged',true);
 elsif b.status in ('cancelled','picked_up','no_show','refunded') then raise exception 'Bokningen är avslutad.';
 elsif p_new_status='confirmed' and b.status in ('pending','reserved') then next_status:='confirmed';
 elsif p_new_status='packed' and b.status in ('pending','reserved','confirmed','paid') then next_status:='packed';
 elsif p_new_status='picked_up' and b.status in ('pending','reserved','confirmed','paid','packed') then next_status:='picked_up';
 elsif p_new_status in ('cancelled','no_show') then next_status:=p_new_status;
 else raise exception 'Statusen kan inte ändras på det sättet.';end if;
 if next_status=b.status and next_payment=b.payment_status then return jsonb_build_object('ok',true,'unchanged',true);end if;
 update public.public_egg_sale_bookings set status=next_status,payment_status=next_payment,
  confirmed_at=case when next_status='confirmed' then coalesce(confirmed_at,now()) else confirmed_at end,
  paid_at=case when p_new_status='paid' then coalesce(paid_at,now()) else paid_at end,
  packed_at=case when next_status='packed' then coalesce(packed_at,now()) else packed_at end,
  picked_up_at=case when next_status='picked_up' then coalesce(picked_up_at,now()) else picked_up_at end,
  cancelled_at=case when next_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,
  no_show_at=case when next_status='no_show' then coalesce(no_show_at,now()) else no_show_at end,
  refunded_at=case when p_new_status='refunded' then coalesce(refunded_at,now()) else refunded_at end,updated_at=now() where id=b.id;
 insert into public.egg_sale_booking_events(booking_id,listing_id,seller_user_id,event_type,old_status,new_status,actor,metadata)
 values(b.id,b.listing_id,b.seller_user_id,p_new_status,b.status,next_status,'seller',jsonb_build_object('note',left(p_note,500),'payment_status',next_payment));
 return jsonb_build_object('ok',true,'status',next_status,'payment_status',next_payment);
end;$$;
revoke all on function public.transition_egg_booking_status(uuid,text,text) from public,anon;
grant execute on function public.transition_egg_booking_status(uuid,text,text) to authenticated;

create or replace function public.transition_egg_orders(p_ids uuid[],p_status text,p_mark_paid boolean default false) returns void
language plpgsql security definer set search_path='' as $$ declare id uuid;begin
 if auth.uid() is null or coalesce(array_length(p_ids,1),0) not between 1 and 100 then raise exception 'Välj mellan 1 och 100 bokningar.';end if;
 -- Stable lock order; an invalid row rolls back the entire batch.
 for id in select distinct unnest(p_ids) order by 1 loop
  perform public.transition_egg_booking_status(id,p_status);
  if p_mark_paid and p_status<>'paid' then perform public.transition_egg_booking_status(id,'paid');end if;
 end loop;
end;$$;
revoke all on function public.transition_egg_orders(uuid[],text,boolean) from public,anon;
grant execute on function public.transition_egg_orders(uuid[],text,boolean) to authenticated;
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
  v_l record;
  v_slot record;
  v_seller_display text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_tok FROM egg_sale_booking_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_b FROM public_egg_sale_bookings WHERE id = v_tok.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_l FROM public_egg_sale_listings WHERE id = v_b.listing_id;

  SELECT * INTO v_slot FROM egg_sale_pickup_slots WHERE id = v_b.pickup_slot_id;

  IF v_l.user_id IS NOT NULL THEN
    SELECT COALESCE(display_name, split_part(email,'@',1))
    INTO v_seller_display
    FROM profiles WHERE user_id = v_l.user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking', jsonb_build_object(
      'id', v_b.id,
      'reference', upper(substr(v_b.id::text, 1, 8)),
      'customer_name', v_b.customer_name,
      'customer_phone', v_b.customer_phone,
      'customer_email', v_b.customer_email,
      'customer_message', v_b.customer_message,
      'pickup_person_name', v_b.pickup_person_name,
      'pickup_person_phone', v_b.pickup_person_phone,
      'packs', v_b.packs,
      'unit_price_sek', v_b.unit_price_sek,
      'total_price_sek', v_b.total_price_sek,
      'eggs_per_pack_snapshot', v_b.eggs_per_pack_snapshot,
      'status', v_b.status,
      'payment_status', v_b.payment_status,
      'created_at', v_b.created_at,
      'cancelled_at', v_b.cancelled_at,
      'paid_at', v_b.paid_at,
      'packed_at', v_b.packed_at,
      'picked_up_at', v_b.picked_up_at
    ),
    'listing', jsonb_build_object(
      'id', v_l.id,
      'slug', v_l.slug,
      'title', v_l.title,
      'eggs_per_pack', COALESCE(v_l.eggs_per_pack, 12),
      'price_per_pack', v_l.price_per_pack,
      'location', v_l.location,
      'pickup_info', v_l.pickup_info,
      'latitude', v_l.latitude,
      'longitude', v_l.longitude,
      'swish_number', v_l.swish_number,
      'swish_name', v_l.swish_name,
      'swish_message', v_l.swish_message,
      'seller_display_name', v_seller_display
    ),
    'pickup_slot', CASE WHEN v_slot.id IS NOT NULL THEN jsonb_build_object(
      'id', v_slot.id,
      'starts_at', v_slot.starts_at,
      'ends_at', v_slot.ends_at,
      'label', v_slot.label
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.send_booking_confirmation_to_buyer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _listing RECORD;
  _slot RECORD;
  _cancel_token text;
  _order_link text;
  _amount numeric;
  _swish_msg text;
  _slot_text text := '';
  _pickup_info text := '';
  _message_id text;
  _maps_link text := '';
  _maps_html text := '';
  _maps_target text;
BEGIN
  IF NEW.customer_email IS NULL OR length(NEW.customer_email) < 5 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _listing FROM public.public_egg_sale_listings WHERE id = NEW.listing_id;
  IF _listing IS NULL THEN RETURN NEW; END IF;

  IF NEW.pickup_slot_id IS NOT NULL THEN
    SELECT * INTO _slot FROM public.egg_sale_pickup_slots WHERE id = NEW.pickup_slot_id;
    IF _slot IS NOT NULL THEN
      _slot_text := to_char(_slot.starts_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI')
        || ' – ' || to_char(_slot.ends_at AT TIME ZONE 'Europe/Stockholm', 'HH24:MI');
    END IF;
  END IF;

  SELECT token INTO _cancel_token FROM public.egg_sale_booking_tokens WHERE booking_id = NEW.id;
  _order_link := 'https://honsgarden.se/bestallning/' || COALESCE(_cancel_token, '');

  _amount := COALESCE(NEW.total_price_sek, NEW.packs * COALESCE(_listing.price_per_pack, 0));
  _swish_msg := COALESCE(_listing.swish_message, 'Äggbokning') || ' ' || NEW.customer_name;
  _pickup_info := COALESCE(_listing.pickup_info, '');

  IF _listing.latitude IS NOT NULL AND _listing.longitude IS NOT NULL THEN
    _maps_link := 'https://www.google.com/maps/dir/?api=1&destination='
      || _listing.latitude::text || ',' || _listing.longitude::text;
  ELSE
    _maps_target := trim(COALESCE(_listing.location, '') || ' ' || COALESCE(_listing.pickup_info, ''));
    IF length(_maps_target) > 2 THEN
      _maps_link := 'https://www.google.com/maps/dir/?api=1&destination='
        || replace(replace(_maps_target, ' ', '+'), E'\n', '+');
    END IF;
  END IF;

  IF _maps_link <> '' THEN
    _maps_html := '<p style="margin:14px 0 6px;font-size:13px;color:hsl(22,12%,44%);">Vägbeskrivning</p>'
      || '<a href="' || _maps_link || '" style="color:hsl(142,32%,34%);font-size:14px;text-decoration:underline;">📍 Öppna i Google Maps →</a>';
  END IF;

  _message_id := 'buyer-confirm-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', NEW.customer_email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Förfrågan mottagen: din äggbokning hos ' || COALESCE(_listing.swish_name, _listing.title, 'säljaren'),
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Tack ' || NEW.customer_name || '! 🥚</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Din förfrågan om <strong>' || NEW.packs || ' förpackning' || CASE WHEN NEW.packs>1 THEN 'ar' ELSE '' END || '</strong> hos <strong>' || COALESCE(_listing.title, 'säljaren') || '</strong> är mottagen. Säljaren bekräftar tillgång och hämtning och hör av sig – ingen betalning behövs förrän vid upphämtning.</p>'
        || '<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">'
        || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Pris (betalas vid upphämtning)</p>'
        || '<p style="margin:0 0 14px;font-size:18px;color:hsl(22,18%,12%);font-weight:700;">' || replace(_amount::text,'.',',') || ' kr</p>'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Swisha till</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || _listing.swish_number || ' (' || COALESCE(_listing.swish_name,'') || ')</p>'
             || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Meddelande i Swish</p>'
             || '<p style="margin:0 0 10px;font-size:14px;color:hsl(22,18%,12%);">' || _swish_msg || '</p>'
             || '<p style="margin:0 0 14px;font-size:12px;color:hsl(22,12%,44%);font-style:italic;">Swisha först vid upphämtning, efter att säljaren bekräftat din bokning.</p>'
           ELSE '' END
        || CASE WHEN _slot_text <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtningstid</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || _slot_text || '</p>'
           ELSE '' END
        || CASE WHEN _pickup_info <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtning</p>'
             || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);">' || _pickup_info || '</p>'
           ELSE '' END
        || _maps_html
        || '</div>'
        || CASE WHEN _cancel_token IS NOT NULL THEN
             '<a href="' || _order_link || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 0 0 16px;">Öppna din beställning →</a>'
             || '<p style="font-size:12px;color:hsl(22,12%,44%);margin:8px 0 0;">Här kan du när som helst se din bokning, byta upphämtningstid, hitta vägbeskrivningen eller avboka.</p>'
           ELSE '' END
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du gjort en bokning via Agdas bod på Hönsgården.</p>'
        || '</div>',
      'text', 'Tack ' || NEW.customer_name || '! Din förfrågan om ' || NEW.packs || ' förp. hos ' || COALESCE(_listing.title,'säljaren') || ' är mottagen. Säljaren bekräftar och hör av sig. Pris (betalas vid upphämtning): ' || replace(_amount::text,'.',',') || ' kr'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN '. Swisha först vid upphämtning till ' || _listing.swish_number ELSE '' END
        || CASE WHEN _slot_text <> '' THEN '. Hämtning: ' || _slot_text ELSE '' END
        || CASE WHEN _maps_link <> '' THEN '. Vägbeskrivning: ' || _maps_link ELSE '' END
        || CASE WHEN _cancel_token IS NOT NULL THEN '. Hantera din beställning: ' || _order_link ELSE '' END,
      'purpose', 'transactional',
      'label', 'buyer-booking-confirmation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  RETURN NEW;
END;
$function$;
commit;
