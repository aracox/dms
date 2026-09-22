-- 0034_segment_owner_names.sql
-- A separate owner name per segment (หอพัก vs บ้านพัก), used as the lessor
-- party on that segment's contract PDF -- distinct from property_name
-- (migration 0030), which is the place name, not the person who signs.
--
-- owner_name is segment-scoped like property_name, so it gets both segment
-- rows automatically (settings_seed_segments). There is no existing value to
-- backfill from, so both segments start blank until the owner fills them in
-- from Settings; callers fall back to property_name until then.

insert into settings (key, value, description)
values (
  'owner_name',
  '{"name_th": "", "name_en": null}'::jsonb,
  'Segment-specific owner name (name_th/name_en), the lessor party shown on that segment''s contract.'
)
on conflict (key) do nothing;
