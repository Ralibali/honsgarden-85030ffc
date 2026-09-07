import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { eggWeekCoverage, coverageInsights } from "@/lib/weeklyCoverage";
import { todayLocal } from "@/lib/datetime";

export function useWeeklyCoverage() {
  const { user } = useAuth();
  const eggs = useQuery({
    queryKey: ["eggs"],
    queryFn: () => api.getEggs(),
    staleTime: 60000,
  });
  const hens = useQuery({
    queryKey: ["hens"],
    queryFn: () => api.getHens(),
    staleTime: 60000,
  });
  const chores = useQuery({
    queryKey: ["daily-chores"],
    queryFn: () => api.getDailyChores(),
    staleTime: 30000,
  });
  const today = todayLocal();
  const coverage = eggWeekCoverage(eggs.data || [], today);
  const henCount =
    hens.data?.filter((hen) => hen.is_active && hen.hen_type !== "rooster")
      .length ?? null;
  const missingSources = [
    eggs.isError && "äggregistreringar",
    hens.isError && "flock",
    chores.isError && "sysslor",
  ].filter(Boolean) as string[];
  const loading = eggs.isPending || hens.isPending || chores.isPending;
  const ready = !loading && missingSources.length === 0;
  const completedToday =
    chores.data?.filter((chore) => chore.completed).length ?? null;
  const facts = coverageInsights(coverage);
  return {
    coverage,
    henCount,
    completedToday,
    choreCount: chores.data?.length ?? null,
    missingSources,
    loading,
    ready,
    facts,
    userId: user?.id,
    retry: async () => {
      await Promise.allSettled([
        eggs.refetch(),
        hens.refetch(),
        chores.refetch(),
      ]);
    },
  };
}
