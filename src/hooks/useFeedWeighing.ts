import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeedWeighing(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ["feed-weighing", userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_weighings")
        .select("day,kg,measured_at")
        .eq("user_id", userId!)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
