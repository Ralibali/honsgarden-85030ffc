import type { Json } from "./types";
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
type Rpc<Args, Returns> = { Args: Args; Returns: Returns };
type NoArgs = Record<never, never>;
export type FarmToolsTables = {
  flock_plans: Table<{
    id: string;
    user_id: string;
    breed: string;
    quantity: number;
    bird_price: number;
    setup_cost: number;
    arrived_at: string | null;
    flock_id: string | null;
    created_at: string;
  }>;
  hen_handoffs: Table<{
    token: string;
    hen_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>;
  farm_program_runs: Table<{
    user_id: string;
    program: string;
    start_day: string;
  }>;
  care_passes: Table<{
    id: string;
    user_id: string;
    token: string;
    starts_on: string;
    ends_on: string;
    morning: string;
    evening: string;
    contact: string;
    photo: string | null;
    revoked_at: string | null;
    created_at: string;
  }>;
  care_rounds: Table<{
    pass_id: string;
    care_day: string;
    round: string;
    eggs: number;
    note: string;
    created_at: string;
  }>;
  feed_weighings: Table<{
    user_id: string;
    day: string;
    kg: number;
    measured_at: string;
  }>;
};
export type FarmToolsFunctions = {
  save_flock_plan: Rpc<
    {
      p_id: string;
      p_breed: string;
      p_quantity: number;
      p_bird_price: number;
      p_setup_cost: number;
    },
    string
  >;
  receive_flock_plan: Rpc<
    { p_id: string; p_quantity: number; p_name: string },
    string
  >;
  confirm_hatch_outcome: Rpc<
    {
      p_id: string;
      p_count: number;
      p_day: string;
      p_flock: string | null;
      p_mother: string | null;
      p_father: string | null;
      p_add_birds: boolean;
    },
    string
  >;
  my_egg_basket: Rpc<NoArgs, Json>;
  configure_egg_basket: Rpc<
    {
      p_day: string;
      p_opening: number;
      p_household: number;
      p_listing: string | null;
    },
    undefined
  >;
  publish_basket_packs: Rpc<NoArgs, number>;
  basket_listing_packs: Rpc<{ p_listing: string }, number | null>;
  record_basket_use: Rpc<
    { p_id: string; p_eggs: number; p_reason: string },
    undefined
  >;
  read_care_pass: Rpc<{ p_token: string }, Json>;
  complete_care_round: Rpc<
    {
      p_token: string;
      p_day: string;
      p_round: string;
      p_eggs: number;
      p_note: string;
    },
    boolean
  >;
  save_feed_receipt: Rpc<
    {
      p_id: string;
      p_name: string;
      p_day: string;
      p_kg: number;
      p_cost: number;
      p_item: string | null;
    },
    string
  >;
  start_farm_program: Rpc<{ p_program: string; p_day: string }, boolean>;
  farm_growth_totals: Rpc<NoArgs, Json>;
  create_hen_handoff: Rpc<
    { p_hen: string; p_photo: boolean; p_parents: boolean },
    string
  >;
  read_hen_handoff: Rpc<{ p_token: string }, Json>;
  receive_hen_handoff: Rpc<{ p_token: string; p_flock: string | null }, string>;
};
