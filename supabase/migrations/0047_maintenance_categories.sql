-- Repair categories were free text, so the same job was typed many ways
-- ("แอร์", "air", "AC") and tickets could not be grouped. They are now a fixed
-- list of language-neutral keys, translated in the UI.
--
-- Existing free text is mapped by keyword where it is unambiguous; anything
-- else becomes 'other', with the old text kept at the front of the
-- description so nothing the owner typed is lost.

update maintenance_tickets
set
  description = case
    when category ~* '(แอร์|air|^ac$)' or category ~* '(ไฟ|electric)'
      or category ~* '(ประปา|น้ำ|plumb|water|leak)'
      then description
    else '[' || category || '] ' || description
  end,
  category = case
    when category ~* '(แอร์|air|^ac$)' then 'air_conditioning'
    when category ~* '(ไฟ|electric)' then 'electrical'
    when category ~* '(ประปา|น้ำ|plumb|water|leak)' then 'plumbing'
    else 'other'
  end
where category not in (
  'air_conditioning', 'electrical', 'plumbing', 'appliance',
  'furniture', 'door_lock', 'building', 'other'
);

alter table maintenance_tickets
  add constraint maintenance_category_ck check (category in (
    'air_conditioning', 'electrical', 'plumbing', 'appliance',
    'furniture', 'door_lock', 'building', 'other'
  ));
