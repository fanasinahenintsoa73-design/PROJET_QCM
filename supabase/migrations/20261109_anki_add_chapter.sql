-- ============================================================
-- MEDQCM : ajouter un chapitre Anki un par un (max 5 au total)
-- ============================================================

create or replace function public.anki_add_chapter(p_chapter_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_type text;
  v_status text;
  v_expires timestamptz;
  v_selected_count integer;
  v_position integer;
begin
  select t.code, t.type, t.status, t.expires_at
    into v_code, v_type, v_status, v_expires
  from public.tickets t
  where t.user_id = auth.uid();

  if v_code is null or v_type <> 'anki' then
    raise exception 'Ticket Anki introuvable.';
  end if;

  if v_status = 'suspended' then
    raise exception 'Ce ticket est suspendu.';
  end if;

  if v_expires is not null and v_expires < now() then
    raise exception 'Ticket Anki expiré.';
  end if;

  if p_chapter_id is null or btrim(p_chapter_id) = '' then
    raise exception 'Chapitre invalide.';
  end if;

  if exists (
    select 1 from public.anki_ticket_chapters c
    where c.ticket_code = v_code and c.chapter_id = p_chapter_id
  ) then
    return;
  end if;

  select count(*)::integer into v_selected_count
  from public.anki_ticket_chapters c
  where c.ticket_code = v_code;

  if v_selected_count >= 5 then
    raise exception '5 chapitres maximum.';
  end if;

  v_position := v_selected_count + 1;

  insert into public.anki_ticket_chapters (ticket_code, chapter_id, position)
  values (v_code, p_chapter_id, v_position);

  insert into public.anki_chapter_progress (ticket_code, chapter_id)
  values (v_code, p_chapter_id)
  on conflict (ticket_code, chapter_id) do nothing;
end;
$$;

revoke all on function public.anki_add_chapter(text) from public;
grant execute on function public.anki_add_chapter(text) to authenticated;
