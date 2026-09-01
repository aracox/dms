-- 0016_room_vehicle_plates.sql
-- Vehicle registration per room: at most 1 car + 1 motorcycle per room, so a
-- plain nullable column on rooms is enough -- no separate table needed.

alter table rooms
  add column car_plate text,
  add column motorcycle_plate text;

comment on column rooms.car_plate is
  'License plate of the room''s one registered car (ทะเบียนรถยนต์). Null if none.';
comment on column rooms.motorcycle_plate is
  'License plate of the room''s one registered motorcycle (ทะเบียนรถมอเตอร์ไซค์). Null if none.';
