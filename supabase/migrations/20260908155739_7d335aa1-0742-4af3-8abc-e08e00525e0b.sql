REVOKE ALL ON FUNCTION public.claim_achievement_reward(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_achievement_reward(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_achievement_reward(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_achievement_reward(text, text) TO service_role;