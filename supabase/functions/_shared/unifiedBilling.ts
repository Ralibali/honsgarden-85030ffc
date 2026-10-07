export function bundleAccess(
  subscription: {
    status: string;
    items: { data: { price: { id: string }; current_period_end?: number }[] };
  },
  allowedPrice: string | undefined,
  now = Date.now(),
) {
  const item = subscription.items.data.find((item) =>
    !!allowedPrice && item.price.id === allowedPrice
  );
  const end = item?.current_period_end;
  return {
    active: !!item && subscription.status === "active" &&
      typeof end === "number" && end * 1000 > now,
    until: typeof end === "number" ? new Date(end * 1000).toISOString() : null,
  };
}
