alter table threadcheck.browser_requests add column "matchedPlacements" text[] not null default '{}' check ("matchedPlacements" <@ array['head','body','feet']::text[] and cardinality("matchedPlacements") <= 3);
update threadcheck.browser_requests set "matchedPlacements"=(array['head','body','feet']::text[])[1:"matchedCount"];
alter table threadcheck.browser_requests drop column "matchedCount";
alter table threadcheck.browser_requests add column "matchedCount" integer generated always as (cardinality("matchedPlacements")) stored;
