-- 0013_houses.sql
-- Adds the 'house' room type. Houses are real, floor-less units (H101-H103)
-- placed on floor 1 by convention, so they render on the floor 1 view of the
-- floor plan alongside rooms 101-107. See src/config/floor-layout/floor-1.json.

alter type room_type add value 'house';

comment on table rooms is
  '25 rows: 24 real rooms (21 dorm rooms on floors 1-3 + 3 houses on floor 1) + mock room T01 (floor 0, is_test = true).';
comment on column rooms.floor is
  'Real dorm rooms: 1-3. Houses (room_type = ''house'') have no floor of their own and are placed on floor 1 by convention. Test rooms: 0, which keeps them off production floor plans.';
