-- 0030_segment_property_names.sql
-- A separate property name per segment (หอพัก vs บ้านพัก), shown on that
-- segment's contract and receipt PDFs instead of the one whole-property name.
--
-- property_name is segment-scoped like the rates and fees in migration 0025,
-- so it gets both segment rows automatically (settings_seed_segments) --
-- seeded here from the current whole-property `dormitory` value, so existing
-- documents keep showing the same name until the owner customizes each
-- segment separately.

insert into settings (key, value, description)
select
  'property_name',
  value,
  'Segment-specific property name (name_th/name_en) shown on that segment''s contracts and receipts.'
from settings
where key = 'dormitory'
on conflict (key) do nothing;
