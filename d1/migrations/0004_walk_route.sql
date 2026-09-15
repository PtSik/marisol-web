-- The sort key for a market the team works on foot.
--
-- A walking route has to run ZIP by ZIP: the next shop on the same block is nearly free, while a
-- tier A lead twenty minutes away is not, which inverts the score-first order the call queue uses.
-- Neither half of that can be done at read time — `address` starts with a house number so ordering
-- by it is meaningless, SQLite has no user functions to pull the ZIP out of the text, and sorting
-- in JS would mean decorating every row, which the pagination suite exists to prevent.
--
-- Filled at import by `zipOf(address)`, the same function that decides a lead's neighbourhood, so
-- the column can never disagree with it. NULL for the handful of leads Places gave no address —
-- they stay in the call queue, which is the only place they are workable.

ALTER TABLE leads ADD COLUMN zip INTEGER;

-- Serves the block filter (`WHERE zip = ?`) and the block list, both verified on the live table.
-- It does NOT serve the whole-area ordering: that starts with `zip IS NULL` to sort unplaced leads
-- last, and an expression is not an index key, so SQLite sorts those ~400 rows in a temp B-tree.
-- The call queue has always done the same — its order starts with a CASE over tier.
CREATE INDEX IF NOT EXISTS leads_walk ON leads (zip, tier, score DESC);
