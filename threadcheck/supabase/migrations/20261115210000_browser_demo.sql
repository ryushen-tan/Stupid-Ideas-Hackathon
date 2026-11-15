alter table threadcheck.browser_connections add column "demoMode" boolean not null default false;
create table threadcheck.browser_demo (
 singleton boolean primary key default true check(singleton),
 "sessionToken" text not null references threadcheck.sessions(token) on delete cascade
);
revoke all on threadcheck.browser_demo from public, anon, authenticated;
create index browser_connections_demo_pending on threadcheck.browser_connections("expiresAt") where "demoMode" and "sessionToken" is null;
