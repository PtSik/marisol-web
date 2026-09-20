-- Retires the sales demo-number pool. The code that leased a number to a prospect, rewrote a pool
-- shop with their scraped name and hours, and swept the leases is gone; this drops the table that
-- fed it.
--
-- DO NOT APPLY BEFORE THE NUMBERS ARE DEALT WITH. Every row pairs a *paid* Twilio number with a
-- fixed shop row in voice-agent. This table is the only record of that pairing, so dropping it
-- first orphans numbers that keep billing. In order:
--   1. SELECT phone_e164, twilio_sid, shop_id FROM demo_numbers;  -- keep the output
--   2. Release or repurpose each number in Twilio, and retire or keep each pool shop in Supabase.
--      That is a billing decision for the owner, not part of this migration.
--   3. Apply this migration.
--
-- lead_state.demo_lang, demo_requested_at and demo_called_at are deliberately kept: they record
-- which prospects asked for a demo and which of them actually dialled, which is outreach history
-- rather than machinery. Nothing writes them any more.

DROP INDEX IF EXISTS demo_numbers_lead;
DROP INDEX IF EXISTS demo_numbers_state;
DROP TABLE IF EXISTS demo_numbers;
