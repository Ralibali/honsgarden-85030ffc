-- 1) Nollställ endast tidigare hårdkodade defaults för leverans om admin inte ändrat dem.
update public.system_settings
   set value = '""'::jsonb,
       updated_at = now()
 where key = 'shop_delivery_method'
   and value::text in ('"Postnord"');

update public.system_settings
   set value = '""'::jsonb,
       updated_at = now()
 where key = 'shop_delivery_text'
   and value::text in (
     '"Vi packar din order inom 1–3 arbetsdagar och skickar med Postnord."'
   );

-- 2) Ersätt shop_finalize_paid_order med strikt beloppskontroll (subtotal + shipping - discount)
--    och radlås. Vid mismatch: ingen lagerändring, ingen paid-status, ok:false + reason.
drop function if exists public.shop_finalize_paid_order(uuid, integer, text, text, text, jsonb, text);
drop function if exists public.shop_finalize_paid_order(uuid, integer, integer, text, text, text, jsonb, text);

create or replace function public.shop_finalize_paid_order(
  p_order_id uuid,
  p_amount_total_ore integer,
  p_discount_ore integer default 0,
  p_customer_email text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_shipping_address jsonb default null,
  p_payment_intent_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_current_stock integer;
  v_expected integer;
  v_discount integer := greatest(0, coalesce(p_discount_ore, 0));
  v_stock_warning text := null;
begin
  if p_amount_total_ore is null or p_amount_total_ore < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_order.stock_applied then
    return jsonb_build_object('ok', true, 'reason', 'already_applied');
  end if;

  v_expected := coalesce(v_order.subtotal_ore, 0) + coalesce(v_order.shipping_ore, 0) - v_discount;

  if v_expected < 0 or p_amount_total_ore <> v_expected then
    update public.shop_orders
       set admin_note = coalesce(admin_note || E'\n', '')
           || 'KRITISKT: Belopp matchar inte. Stripe=' || p_amount_total_ore
           || ' öre, förväntat ' || v_expected || ' öre (subtotal '
           || coalesce(v_order.subtotal_ore, 0) || ' + frakt '
           || coalesce(v_order.shipping_ore, 0) || ' - rabatt ' || v_discount || ').'
     where id = p_order_id;
    return jsonb_build_object(
      'ok', false,
      'reason', 'amount_mismatch',
      'expected_ore', v_expected,
      'received_ore', p_amount_total_ore,
      'discount_ore', v_discount
    );
  end if;

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_product_id is null then continue; end if;

    if v_variant_id is not null then
      select stock into v_current_stock from public.shop_product_variants where id = v_variant_id for update;
      if v_current_stock is not null then
        if v_current_stock < v_qty then
          v_stock_warning := coalesce(v_stock_warning || ' ', '') || 'Variant ' || v_variant_id || ' understock (' || v_current_stock || '/' || v_qty || ').';
          update public.shop_product_variants set stock = 0 where id = v_variant_id;
        else
          update public.shop_product_variants set stock = stock - v_qty where id = v_variant_id;
        end if;
      end if;
    else
      select stock into v_current_stock from public.shop_products where id = v_product_id for update;
      if v_current_stock is not null then
        if v_current_stock < v_qty then
          v_stock_warning := coalesce(v_stock_warning || ' ', '') || 'Product ' || v_product_id || ' understock (' || v_current_stock || '/' || v_qty || ').';
          update public.shop_products set stock = 0 where id = v_product_id;
        else
          update public.shop_products set stock = stock - v_qty where id = v_product_id;
        end if;
      end if;
    end if;
  end loop;

  update public.shop_orders
     set status = 'paid',
         stock_applied = true,
         paid_at = coalesce(paid_at, now()),
         amount_total_ore = p_amount_total_ore,
         discount_ore = v_discount,
         customer_email = coalesce(p_customer_email, customer_email),
         customer_name = coalesce(p_customer_name, customer_name),
         customer_phone = coalesce(p_customer_phone, customer_phone),
         shipping_address = coalesce(p_shipping_address, shipping_address),
         payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
         admin_note = case
           when v_stock_warning is not null
             then coalesce(admin_note || E'\n', '') || 'STOCK WARNING: ' || v_stock_warning
           else admin_note
         end,
         fulfillment_status = case when v_stock_warning is not null then 'processing' else fulfillment_status end
   where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'stock_warning', v_stock_warning,
    'expected_ore', v_expected,
    'discount_ore', v_discount
  );
end;
$$;

revoke all on function public.shop_finalize_paid_order(uuid, integer, integer, text, text, text, jsonb, text) from public;
grant execute on function public.shop_finalize_paid_order(uuid, integer, integer, text, text, text, jsonb, text) to service_role;