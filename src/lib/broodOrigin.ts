import type { Tables } from '@/integrations/supabase/types';
export interface PossibleParent { hen_id: string; role: 'mother' | 'father'; name: string; origin_genbank_number: string | null }
export type BroodOrigin = Omit<Tables<'brood_origins'>, 'parents'> & { parents: PossibleParent[] };
export type BroodOriginInput = Pick<BroodOrigin, 'name' | 'date' | 'notes'> & {
  id?: string;
  hatching_id?: string | null;
  parents: Pick<PossibleParent, 'hen_id' | 'role'>[];
};
