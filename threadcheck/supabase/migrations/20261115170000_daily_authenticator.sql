create schema if not exists threadcheck;
revoke all on schema threadcheck from public, anon, authenticated;
create table threadcheck.items (
 id text primary key, name text not null check(length(name) between 1 and 80),
 brand text not null, barcode text not null, color text not null, size text not null,
 serial text not null default '', category text not null check(category in ('Tops','Bottoms','Accessories','Shoes','Snacks')),
 kind text not null check(kind in ('shirt','hoodie','pants','hat','bag','shoe','can','snack')),
 photo text, "createdAt" text not null, unique(barcode,serial)
);
create index items_created on threadcheck.items("createdAt" desc,id);
create index items_category on threadcheck.items(category,"createdAt" desc,id);
create index items_search on threadcheck.items using gin(to_tsvector('simple',name || ' ' || brand || ' ' || barcode));
create table threadcheck.scans (
 id text primary key, "itemId" text references threadcheck.items(id) on delete set null,
 "itemName" text not null, kind text not null, source text not null,
 code text not null, tag text not null, photo text not null,
 explanation text not null, observations jsonb not null, "createdAt" text not null
);
create index scans_created on threadcheck.scans("createdAt" desc,id);
create index scans_item on threadcheck.scans("itemId");
create table threadcheck.sessions (token text primary key, "expiresAt" bigint not null);
create index sessions_expiry on threadcheck.sessions("expiresAt");
create table threadcheck.metadata (key text primary key,value text not null);
create table threadcheck.accounts (
 id text primary key, issuer text not null check(length(issuer) between 1 and 80),
 label text not null check(length(label) between 1 and 120),
 algorithm text not null check(algorithm in ('SHA1','SHA256','SHA512')),
 digits integer not null check(digits in (6,8)), period integer not null check(period between 15 and 120),
 "secretCiphertext" text not null, "createdAt" text not null, unique(issuer,label)
);
create index accounts_created on threadcheck.accounts("createdAt" desc,id);
create table threadcheck.daily_fits (
 id text primary key, day text not null unique, "expiresAt" bigint not null, "createdAt" text not null
);
create table threadcheck.daily_items (
 id text primary key, "dailyId" text not null references threadcheck.daily_fits(id) on delete cascade,
 "itemId" text not null references threadcheck.items(id), position integer not null,
 photo text, "photoDigest" text, unique("dailyId","itemId"), unique("dailyId",position)
);
create index daily_items_item on threadcheck.daily_items("itemId");
create table threadcheck.challenges (
 id text primary key, "accountId" text not null references threadcheck.accounts(id) on delete cascade,
 "dailyId" text not null references threadcheck.daily_fits(id) on delete cascade,
 "sessionToken" text not null references threadcheck.sessions(token) on delete cascade,
 "expiresAt" bigint not null, attempts integer not null default 0 check(attempts between 0 and 20),
 redeemed boolean not null default false
);
create index challenges_owner on threadcheck.challenges("sessionToken","accountId");
create index challenges_daily on threadcheck.challenges("dailyId");
create table threadcheck.proofs (
 "challengeId" text not null references threadcheck.challenges(id) on delete cascade,
 "dailyItemId" text not null references threadcheck.daily_items(id) on delete cascade,
 "photoDigest" text unique, primary key("challengeId","dailyItemId")
);
create index proofs_item on threadcheck.proofs("dailyItemId");
revoke all on all tables in schema threadcheck from public, anon, authenticated;
