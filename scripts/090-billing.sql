-- Paid plans, through Lemon Squeezy.
--
-- One row per student who has ever subscribed: the subscription Lemon
-- Squeezy holds for them and its state, written only by the webhook
-- (app/api/billing/webhook) with the service role. The student can read
-- their own row; nothing on the client can write it. profiles.plan follows
-- it: basic or premium while the subscription runs (cancelled ones until
-- the period they paid for ends), free once it has expired.

BEGIN;

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'lemonsqueezy',
  subscription_id text NOT NULL UNIQUE,
  customer_id text,
  variant_id text,
  plan text NOT NULL CHECK (plan IN ('basic', 'premium')),
  cycle text CHECK (cycle IN ('monthly', 'yearly')),
  status text NOT NULL,
  renews_at timestamptz,
  ends_at timestamptz,
  test_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own subscription" ON subscriptions;
CREATE POLICY "Students read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
