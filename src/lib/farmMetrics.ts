/** Active female birds; roosters and inactive birds are never counted as hens. */
export function isActiveHen(hen: { is_active?: boolean | null; hen_type?: string | null }): boolean {
  return hen.is_active === true && hen.hen_type !== 'rooster';
}

/** Productivity uses adult laying hens, while the flock total includes pullets. */
export function isLayingHen(hen: { is_active?: boolean | null; hen_type?: string | null }): boolean {
  return isActiveHen(hen) && (hen.hen_type ?? 'hen') === 'hen';
}
