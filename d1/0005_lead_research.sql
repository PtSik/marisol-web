-- The rep's own write-up of one location: what its site and socials show, and everything it needs.
-- We pitch more than the receptionist, so the call opens from a doc rather than from a one-line note.
--
-- On `lead_state`, not `leads`, for the reason 0001_outreach.sql's header gives: a scraper run
-- replaces every `leads` row, and hours of research must survive that. `note` stays what it was —
-- the line that goes out with a call result — because a paste from a doc would bury it.

ALTER TABLE lead_state ADD COLUMN research TEXT;
