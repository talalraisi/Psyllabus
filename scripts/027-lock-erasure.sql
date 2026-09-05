-- Take EXECUTE on delete_my_account away from anon.
--
-- REVOKE ALL FROM public in 026 did not cover it: Supabase grants EXECUTE to
-- anon and authenticated on new functions in the public schema by default, and
-- a role-level grant survives a revoke from PUBLIC.
--
-- The function already refuses a caller with no auth.uid(), so nothing could
-- be deleted through it. But a signed-out caller should not be able to reach a
-- SECURITY DEFINER function that deletes accounts at all, guarded or not.

BEGIN;

REVOKE ALL ON FUNCTION delete_my_account() FROM anon;
REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

-- Same reasoning for the code redemption function.
REVOKE ALL ON FUNCTION redeem_access_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION redeem_access_code(text) TO authenticated;

COMMIT;
