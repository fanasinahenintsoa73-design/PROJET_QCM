-- ---------------------------------------------------------------------------
-- Renouvellement : effacer le cycle précédent pour libérer l'espace
-- ---------------------------------------------------------------------------
-- Le plan gratuit Supabase ne dispose que de 500 Mo. Chaque série conserve
-- une copie figée des questions (`question_snapshot`), soit environ 150 Ko
-- par étudiant et par cycle. Sans purge, les cycles s'empilent et dépassent
-- rapidement la limite.
--
-- Au renouvellement, on supprime donc l'historique du cycle précédent :
--   * les tentatives Pres Concours (et leurs avis, en cascade) ;
--   * les consommations MEDGAME ;
--   * les parcours et runs MEDGAME (et leurs réponses, en cascade).
--
-- Le ticket, le secret, le compte auth et le profil sont conservés : le
-- renouvellement reste possible et le quota repart à 30 séries grâce à la
-- nouvelle affectation insérée à la fin.
--
-- Tout se fait dans la même transaction : si une suppression échoue, le
-- renouvellement échoue aussi et rien n'est laissé à moitié nettoyé.
-- ---------------------------------------------------------------------------

create or replace function public.renew_ticket(p_code text)
returns table(code text, secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_user_id uuid;
  v_new_secret text;
begin
  if not public.is_professor() then
    raise exception 'Réservé au docteur.' using errcode = '42501';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'Ticket introuvable.' using errcode = 'P0001';
  end if;

  select t.*
  into v_ticket
  from public.tickets t
  where t.code = p_code;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0001';
  end if;

  if v_ticket.archived_at is not null then
    raise exception 'Désarchive le ticket avant de le renouveler.' using errcode = 'P0001';
  end if;

  v_user_id := v_ticket.user_id;

  -- Nouveau numéro d'enregistrement : 6 chiffres + 3 lettres mélangés.
  select string_agg(pick, '' order by rnd)
    into v_new_secret
  from (
    select substring('0123456789' from 1 + floor(random() * 10)::integer for 1) as pick,
           random() as rnd
      from generate_series(1, 6)
    union all
    select substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ' from 1 + floor(random() * 26)::integer for 1) as pick,
           random() as rnd
      from generate_series(1, 3)
  ) shuffled;

  -- L'ancien numéro est remplacé : il ne fonctionne plus.
  update public.ticket_secrets ts
    set secret = v_new_secret
    where ts.code = p_code;

  if not found then
    insert into public.ticket_secrets (code, secret)
    values (p_code, v_new_secret);
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(v_new_secret, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user_id;

  -- Purge du cycle précédent ------------------------------------------------
  -- Les avis (`series_feedback`) partent avec les tentatives (on delete cascade).
  delete from public.attempts
    where user_id = v_user_id;

  -- Les consommations MEDGAME du cycle précédent.
  delete from public.series_consumptions
    where user_id = v_user_id;

  -- Les parcours MEDGAME : la suppression entraîne les runs et leurs réponses.
  delete from public.medgame_progress
    where user_id = v_user_id;

  -- Nouvelle affectation : les séries repartent de zéro.
  insert into public.subject_assignments (user_id, subject_id, started_at, expires_at)
  values (v_user_id, null, now(), now() + interval '100 years');

  update public.tickets t
    set status = 'used'
    where t.code = p_code;

  return query select p_code, v_new_secret;
end;
$$;

revoke all on function public.renew_ticket(text) from public, anon;
grant execute on function public.renew_ticket(text) to authenticated;
