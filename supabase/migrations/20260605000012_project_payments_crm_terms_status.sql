-- Link payments to a CRM contact + payment terms (שוטף+N) + reworked statuses.
alter table public.project_payments
  add column if not exists contact_id     uuid references public.contacts(id) on delete set null,
  add column if not exists terms_net_days integer,   -- שוטף+N (null/0 = מיידי)
  add column if not exists demand_date     date;      -- date the demand was sent/received

create index if not exists project_payments_contact_idx
  on public.project_payments (contact_id) where contact_id is not null;

-- Rework statuses: pending→draft, overdue→demand (a demand is its own status;
-- "overdue" is now DERIVED in the UI = demand + past due_date + unpaid).
alter table public.project_payments drop constraint if exists project_payments_status_check;
update public.project_payments set status = 'draft'  where status = 'pending';
update public.project_payments set status = 'demand' where status = 'overdue';
alter table public.project_payments
  add constraint project_payments_status_check
  check (status in ('draft','demand','paid','cancelled'));
alter table public.project_payments alter column status set default 'draft';
