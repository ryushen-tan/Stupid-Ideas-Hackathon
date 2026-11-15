create table threadcheck.browser_connections (
 id text primary key,
 name text not null check(length(name) between 1 and 80),
 "tokenHash" text not null unique,
 "pairCode" text unique,
 "pairExpiresAt" bigint not null,
 "sessionToken" text references threadcheck.sessions(token) on delete cascade,
 "expiresAt" bigint not null
);
create index browser_connections_owner on threadcheck.browser_connections("sessionToken");
create index browser_connections_expiry on threadcheck.browser_connections("expiresAt");
create table threadcheck.browser_requests (
 id text primary key,
 "browserId" text not null references threadcheck.browser_connections(id) on delete cascade,
 origin text not null,
 "expiresAt" bigint not null,
 status text not null default 'pending' check(status in ('pending','prepared','checking','verified','ready','delivered','rejected')),
 setup jsonb,
 attempts integer not null default 0 check(attempts between 0 and 5),
 "codeCiphertext" text,
 "validUntil" bigint
);
create index browser_requests_owner on threadcheck.browser_requests("browserId","expiresAt");
create index browser_requests_expiry on threadcheck.browser_requests("expiresAt");
create table threadcheck.browser_photos (
 digest text primary key,
 "requestId" text not null references threadcheck.browser_requests(id) on delete cascade
);
create index browser_photos_request on threadcheck.browser_photos("requestId");
revoke all on threadcheck.browser_connections, threadcheck.browser_requests, threadcheck.browser_photos from public, anon, authenticated;
