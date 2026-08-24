import { ADDREVENUEBYBENSON_1 } from '@/data/addRevenueByBenson1';
import { ADDREVENUE_DINTRADGARD } from '@/data/addRevenueDinTradgard';
import type { SmartAffiliateProduct } from '@/lib/smartAffiliate';

/**
 * Ett litet fallback-urval som fungerar direkt i frontend.
 * Hela Addrevenue-katalogen hämtas och uppdateras av sync-affiliate-feed.
 */
export const ADDREVENUE_PRODUCTS: SmartAffiliateProduct[] = [
  ...ADDREVENUEBYBENSON_1,
  ...ADDREVENUE_DINTRADGARD,
];
