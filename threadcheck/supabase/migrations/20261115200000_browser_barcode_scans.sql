alter table threadcheck.browser_requests add column "matchedCount" integer not null default 0 check ("matchedCount" between 0 and 3);
update threadcheck.browser_requests set status='rejected',setup=null where status in ('prepared','checking','verified');
alter table threadcheck.browser_requests drop constraint browser_requests_status_check;
alter table threadcheck.browser_requests add constraint browser_requests_status_check check (status in ('pending','prepared','verified','ready','delivered','rejected'));
alter table threadcheck.browser_requests drop column attempts;
drop table threadcheck.browser_photos;
