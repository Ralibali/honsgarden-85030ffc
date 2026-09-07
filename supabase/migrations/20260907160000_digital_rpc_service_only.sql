-- Paid fulfillment and token issuance are reachable only through verified edge handlers.
-- Both legacy and current overloads must be restricted. RLS alone does not protect
-- SECURITY DEFINER functions from their default PUBLIC execution privilege.
begin;
revoke execute on function public.digital_finalize_paid_order(uuid,integer,text,text) from public, anon, authenticated;
revoke execute on function public.digital_finalize_paid_order(uuid,integer,text,text,text,text,boolean) from public, anon, authenticated;
revoke execute on function public.digital_issue_receipt(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.digital_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke execute on function public.digital_register_download(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.digital_finalize_paid_order(uuid,integer,text,text), public.digital_finalize_paid_order(uuid,integer,text,text,text,text,boolean), public.digital_issue_receipt(uuid,text,text,jsonb), public.digital_rate_limit(text,text,integer,integer), public.digital_register_download(text,text,text,integer) to service_role;
commit;
