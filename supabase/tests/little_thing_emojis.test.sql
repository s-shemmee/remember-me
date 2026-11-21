-- pgTAP: an emoji per little thing (`pnpm db:test`). Existing writers keep
-- working (hearts by default), the arrays never drift apart, only one emoji
-- is accepted, and RLS is unchanged (only the owner sees or changes them).
begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e801', 'emoji.owner@test.local', '{"first_name": "Nora"}'),
  ('00000000-0000-0000-0000-00000000e802', 'emoji.other@test.local', '{"first_name": "Omar"}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;

select has_column('public', 'people', 'little_thing_emojis', 'people.little_thing_emojis exists');
select ok(public.is_little_emoji('⚽') and public.is_little_emoji('👩🏽‍💻') and public.is_little_emoji('🇲🇦'),
  'single emoji are accepted (ZWJ sequences and flags too)');
select ok(not public.is_little_emoji('a') and not public.is_little_emoji(' ⚽')
  and not public.is_little_emoji('x☕') and not public.is_little_emoji('')
  and not public.is_little_emoji('🎂🎂🎂🎂🎂'),
  'letters, spaces, mixed text, empty and more than 16 bytes are refused');

-- The owner saves little things with emoji -------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000e801');
select lives_ok($$
  insert into ids select 'k', public.save_person(
    p_name => 'Khalid', p_relation_kind => 'Best friend',
    p_birthday_day => 3, p_birthday_month => 4,
    p_little_things => array[' Loves football ', '', 'Black coffee', 'Old records'],
    p_little_thing_emojis => array['⚽', '🍕', '☕', null])
$$, 'save_person takes an emoji per little thing');
select is(
  (select little_things || little_thing_emojis from public.people where id = (select id from ids where key = 'k')),
  array['Loves football', 'Black coffee', 'Old records', '⚽', '☕', '❤️'],
  'empty little things drop their emoji too; a missing emoji is a heart');

select throws_ok($$ select public.save_person(
    p_name => 'Bad', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
    p_little_things => array['Tea'], p_little_thing_emojis => array['tea']) $$,
  '22023', 'invalid_little_things', 'text instead of an emoji is refused');
select throws_ok($$ select public.save_person(
    p_name => 'Bad', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
    p_little_things => array['Tea', 'Cake'], p_little_thing_emojis => array['🍵']) $$,
  '22023', 'invalid_little_things', 'the two lists must be the same length');
select throws_ok($$ select public.save_person(
    p_name => 'Long', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
    p_little_things => array[repeat('x', 61)], p_little_thing_emojis => array['🍵']) $$,
  '22023', 'invalid_little_things', 'the 60-character text limit is unchanged');

-- Without emoji (onboarding, older callers): hearts ----------------------------------------------
select lives_ok($$
  insert into ids select 'y', public.save_person(
    p_name => 'Yasmine', p_relation_kind => 'Family', p_birthday_day => 5, p_birthday_month => 6,
    p_little_things => array['Sci-fi', 'Sunflowers'])
$$, 'save_person without emoji still works');
select is(
  (select little_thing_emojis from public.people where id = (select id from ids where key = 'y')),
  array['❤️', '❤️'], '...and every little thing gets a heart');

-- A direct update of the text keeps the arrays in step.
update public.people set little_things = array['Sci-fi'] where id = (select id from ids where key = 'y');
select is(
  (select cardinality(little_thing_emojis) from public.people where id = (select id from ids where key = 'y')),
  1, 'fewer little things: extra emoji go');
select throws_ok($$ update public.people set little_thing_emojis = array['nope']
  where id = (select id from ids where key = 'y') $$,
  '23514', null, 'a direct write of a non-emoji is refused by the check');

-- RLS unchanged -----------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000e802');
select is((select count(*)::int from public.people where id = (select id from ids where key = 'k')), 0,
  'someone else can''t see them');
update public.people set little_thing_emojis = array['💀', '💀', '💀']
  where id = (select id from ids where key = 'k');
reset role;
select is(
  (select little_thing_emojis from public.people where id = (select id from ids where key = 'k')),
  array['⚽', '☕', '❤️'], '...or change them');
select is(
  (select little_thing_emojis from public.people where id = (select id from ids where key = 'k')),
  array['⚽', '☕', '❤️'], 'the owner''s emoji are as saved');

select * from finish();
rollback;
