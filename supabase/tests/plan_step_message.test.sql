-- pgTAP: the message saved on a plan step (`pnpm db:test`). The owner saves
-- and ticks it; nobody else can read or change it; 400 characters at most.
begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000d901', 'msg.owner@test.local', '{"first_name": "Rania"}', now()),
  ('00000000-0000-0000-0000-00000000d902', 'msg.other@test.local', '{"first_name": "Samir"}', now());

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;

select has_column('public', 'plan_steps', 'message', 'plan_steps.message exists');

-- The birthday's next date, worked out before switching to the user.
create temp table next_day as select public.next_occurrence(3, 4, current_date) as d;
grant select on next_day to authenticated;

-- The owner's plan for a person's birthday, with its Message step.
select pg_temp.act_as('00000000-0000-0000-0000-00000000d901');
insert into ids select 'p', public.save_person(
  p_name => 'Khalid', p_relation_kind => 'Best friend', p_birthday_day => 3, p_birthday_month => 4);
insert into ids select 'plan', public.start_plan(
  (select o.id from public.occasions o where o.person_id = (select id from ids where key = 'p')),
  (select d from next_day));
insert into ids select 'step', s.id from public.plan_steps s
  where s.plan_id = (select id from ids where key = 'plan') and s.kind = 'message' limit 1;

select lives_ok($$
  update public.plan_steps set message = 'Happy birthday, Khalid! Coffee is on me.',
    done_at = now(), ticked_by = 'me'
  where id = (select id from ids where key = 'step')
$$, 'the owner saves a message on the step and ticks it');
select is((select message from public.plan_steps where id = (select id from ids where key = 'step')),
  'Happy birthday, Khalid! Coffee is on me.', '...and reads it back');

select throws_ok($$ update public.plan_steps set message = repeat('x', 401)
  where id = (select id from ids where key = 'step') $$, '23514', null, 'more than 400 characters is refused');
select throws_ok($$ update public.plan_steps set message = '  padded  '
  where id = (select id from ids where key = 'step') $$, '23514', null, 'untrimmed text is refused');
select lives_ok($$ update public.plan_steps set message = null
  where id = (select id from ids where key = 'step') $$, 'the message can be cleared');

-- Someone else ---------------------------------------------------------------------------------
update public.plan_steps set message = 'Saved' where id = (select id from ids where key = 'step');
select pg_temp.act_as('00000000-0000-0000-0000-00000000d902');
select is((select count(*)::int from public.plan_steps where id = (select id from ids where key = 'step')), 0,
  'someone else can''t see the step or its message');
update public.plan_steps set message = 'Hacked' where id = (select id from ids where key = 'step');
reset role;
select is((select message from public.plan_steps where id = (select id from ids where key = 'step')),
  'Saved', '...or change it');

select * from finish();
rollback;
