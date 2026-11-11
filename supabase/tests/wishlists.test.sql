-- pgTAP: wishlists, wishes and the wish-images bucket (`pnpm db:test`).
-- A (Hiba) owns wishes; B (Yassine) is the stranger.
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a501', 'hiba.wish@test.local',    '{"first_name": "Hiba"}'),
  ('00000000-0000-0000-0000-00000000b501', 'yassine.wish@test.local', '{"first_name": "Yassine"}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'a_bday', id from public.wishlists
  where owner_id = '00000000-0000-0000-0000-00000000a501' and kind = 'birthday';
insert into ids select 'a_treat', id from public.wishlists
  where owner_id = '00000000-0000-0000-0000-00000000a501' and kind = 'treat';
insert into ids select 'b_bday', id from public.wishlists
  where owner_id = '00000000-0000-0000-0000-00000000b501' and kind = 'birthday';

-- Structure -----------------------------------------------------------------------------
select is((select string_agg(kind || ':' || visibility, ',' order by kind) from public.wishlists
           where owner_id = '00000000-0000-0000-0000-00000000a501'),
  'birthday:connections,treat:private', 'a new person gets two lists: birthday (connections) and treat (private)');
select is(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.wishlists'::regclass, 'public.wishes'::regclass, 'public.invites'::regclass, 'public.connections'::regclass)),
  true, 'RLS is enabled on wishlists, wishes, invites and connections');
select is((select public from storage.buckets where id = 'wish-images'), false, 'the wish-images bucket is private');
select throws_ok($$ update public.wishlists set visibility = 'connections' where kind = 'treat' $$,
  '23514', null, '"Treat yourself" can never be shared');

-- A: add, edit, reorder ------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a501');
select lives_ok(format($$
  insert into public.wishes (wishlist_id, title, url, price_amount, currency, note, priority, position)
  values (%L, 'Ottolenghi cookbook', 'https://librairie.ma/ottolenghi', 420, 'MAD', 'The green one', 'love', 1),
         (%L, 'Little olive tree', null, 260, 'MAD', null, 'nice', 2),
         (%L, 'Fig candle', null, null, 'EUR', null, 'like', 3)
$$, (select id from ids where key = 'a_bday'), (select id from ids where key = 'a_bday'), (select id from ids where key = 'a_bday')),
  'A adds three wishes to her birthday list');
insert into ids select 'book', id from public.wishes where title = 'Ottolenghi cookbook';
insert into ids select 'tree', id from public.wishes where title = 'Little olive tree';
insert into ids select 'candle', id from public.wishes where title = 'Fig candle';
select is((select owner_id from public.wishes where id = (select id from ids where key = 'book')),
  '00000000-0000-0000-0000-00000000a501'::uuid, 'the wish belongs to A');
select lives_ok(format($$ update public.wishes set title = 'Ottolenghi Simple', priority = 'like' where id = %L $$,
  (select id from ids where key = 'book')), 'A edits her wish');
select lives_ok(format($$ select public.reorder_wishes(%L, array[%L, %L, %L]::uuid[]) $$,
  (select id from ids where key = 'a_bday'), (select id from ids where key = 'candle'),
  (select id from ids where key = 'book'), (select id from ids where key = 'tree')),
  'A reorders her list');
select is((select string_agg(title, ', ' order by position) from public.wishes
           where wishlist_id = (select id from ids where key = 'a_bday')),
  'Fig candle, Ottolenghi Simple, Little olive tree', 'the new order is saved');
select throws_ok(format($$ select public.reorder_wishes(%L, array[%L, %L]::uuid[]) $$,
  (select id from ids where key = 'a_bday'), (select id from ids where key = 'candle'), (select id from ids where key = 'book')),
  '22023', 'invalid_order', 'a reorder must list every wish exactly once');
select lives_ok(format($$ update public.wishes set removed_at = now() where id = %L $$, (select id from ids where key = 'tree')),
  'A removes a wish (Undo keeps it until then)');

-- Validation -------------------------------------------------------------------------------------
select throws_ok(format($$ insert into public.wishes (wishlist_id, title) values (%L, repeat('x', 81)) $$,
  (select id from ids where key = 'a_bday')), '23514', null, 'a title over 80 characters is refused');
select throws_ok(format($$ insert into public.wishes (wishlist_id, title, url) values (%L, 'Bad', 'javascript:alert(1)') $$,
  (select id from ids where key = 'a_bday')), '23514', null, 'only http(s) links are allowed');
select throws_ok(format($$ insert into public.wishes (wishlist_id, title, price_amount) values (%L, 'Bad', -1) $$,
  (select id from ids where key = 'a_bday')), '23514', null, 'a price can''t be negative');
select throws_ok(format($$ insert into public.wishes (wishlist_id, title, currency) values (%L, 'Bad', 'XYZ') $$,
  (select id from ids where key = 'a_bday')), '23514', null, 'only our currencies are allowed');
select throws_ok(format($$ insert into public.wishes (wishlist_id, title, image_path) values (%L, 'Bad', %L) $$,
  (select id from ids where key = 'a_bday'), '00000000-0000-0000-0000-00000000b501/x.webp'),
  '42501', null, 'a wish can''t use an image from someone else''s folder');
select throws_ok(format($$ insert into public.wishes (wishlist_id, title) values (%L, 'Sneaky') $$,
  (select id from ids where key = 'b_bday')), '42501', null, 'A can''t add a wish to B''s list');
select throws_ok($$ insert into public.wishlists (kind, title) values ('other', 'Mine') $$,
  '42501', null, 'lists can''t be created by hand (two fixed lists for now)');

-- Storage, as A ------------------------------------------------------------------------------------
select lives_ok($$ insert into storage.objects (bucket_id, name)
  values ('wish-images', '00000000-0000-0000-0000-00000000a501/book.webp') $$,
  'A uploads an image into her own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('wish-images', '00000000-0000-0000-0000-00000000b501/planted.webp') $$,
  '42501', null, 'A can''t upload into B''s folder');

-- B, the stranger ------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b501');
select is((select count(*)::int from public.wishes), 0, 'a stranger can''t read A''s wishes');
select is((select count(*)::int from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a501'),
  0, 'a stranger can''t see A''s lists');
update public.wishes set title = 'Hacked' where id = (select id from ids where key = 'book');
delete from public.wishes where id = (select id from ids where key = 'candle');
select is((select count(*)::int from storage.objects where bucket_id = 'wish-images'
           and name like '00000000-0000-0000-0000-00000000a501/%'), 0, 'a stranger can''t see A''s images');
select throws_ok(format($$ select public.reorder_wishes(%L, array[]::uuid[]) $$, (select id from ids where key = 'a_bday')),
  '22023', 'invalid_order', 'a stranger can''t reorder A''s list');

select pg_temp.act_as('00000000-0000-0000-0000-00000000a501');
select is((select title from public.wishes where id = (select id from ids where key = 'book')),
  'Ottolenghi Simple', 'B could not change A''s wish');
select is((select count(*)::int from public.wishes where id = (select id from ids where key = 'candle')),
  1, 'B could not delete A''s wish');
-- Supabase blocks direct deletes on storage tables (only the Storage API
-- deletes, applying this policy), so check the policy itself.
select is(
  (select qual from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'Wish images: delete own' and cmd = 'DELETE'),
  '((bucket_id = ''wish-images''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))',
  'deleting a wish image is limited to your own folder');

reset role;
select * from finish();
rollback;
