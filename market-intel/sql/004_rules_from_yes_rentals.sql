-- ============================================================================
-- Mapping rules added from the first real collection (Yes Rentals, CHC).
--
-- Every rule here was written because a live listing came back unresolved, not
-- guessed in advance. That is the intended workflow: collect, look at
-- v_unresolved_vehicles, add rules.
-- ============================================================================

insert into market_intel.vehicle_class_mapping
  (match_type, pattern, source_code, vehicle_class, priority, confidence, created_by, notes) values

  -- ---- people movers / minibuses the NZ used-import fleet is full of -------
  ('contains','alphard',      null,'VAN_8_SEAT', 30,0.94,'seed-yes-rentals','7-8 seat MPV'),
  ('contains','vellfire',     null,'VAN_8_SEAT', 30,0.94,'seed-yes-rentals','Alphard twin'),
  ('contains','valente',      null,'VAN_8_SEAT', 30,0.92,'seed-yes-rentals','Mercedes Valente'),
  ('contains','preiva',       null,'VAN_8_SEAT', 30,0.88,'seed-yes-rentals','site spelling of Previa'),
  ('contains','previa',       null,'VAN_8_SEAT', 30,0.92,'seed-yes-rentals',null),
  ('contains','noah',         null,'VAN_8_SEAT', 32,0.88,'seed-yes-rentals',null),
  ('contains','voxy',         null,'VAN_8_SEAT', 32,0.88,'seed-yes-rentals',null),
  ('contains','serena',       null,'VAN_8_SEAT', 32,0.88,'seed-yes-rentals',null),
  ('contains','hiace',        null,'VAN_12_SEAT',35,0.85,'seed-yes-rentals','seat count overrides when smaller'),

  -- ---- sedans / wagons common to Japanese-import fleets --------------------
  ('contains','teana',        null,'MIDSIZE',    40,0.90,'seed-yes-rentals',null),
  ('contains','wish',         null,'MIDSIZE',    42,0.85,'seed-yes-rentals','Toyota Wish compact MPV'),
  ('contains','fielder',      null,'COMPACT',    42,0.88,'seed-yes-rentals','Corolla Fielder wagon'),
  ('contains','axio',         null,'COMPACT',    42,0.88,'seed-yes-rentals','Corolla Axio'),
  ('contains','sylphy',       null,'COMPACT',    42,0.88,'seed-yes-rentals',null),
  ('contains','tiida',        null,'COMPACT',    42,0.88,'seed-yes-rentals',null),
  ('contains','note',         null,'ECONOMY',    45,0.82,'seed-yes-rentals','Nissan Note'),
  ('contains','aqua',         null,'ECONOMY',    42,0.90,'seed-yes-rentals','Toyota Aqua / Prius C'),
  ('contains','prius',        null,'COMPACT',    42,0.88,'seed-yes-rentals',null),

  -- ---- ACRISS/SIPP derived labels ------------------------------------------
  -- The RCM collector turns a SIPP code into a label like 'fullsize van' or
  -- 'standard suv' and passes it as the class hint. These rules give that
  -- fallback somewhere to land, which is what makes the adapter work on a site
  -- that publishes no marketing class names at all.
  ('regex','van$',            null,'VAN_8_SEAT', 66,0.75,'seed-acriss','SIPP body type V/K/M; seat count promotes to 12-seat'),
  ('contains','mini suv',     null,'COMPACT_SUV',63,0.80,'seed-acriss',null),
  ('contains','economy suv',  null,'COMPACT_SUV',63,0.80,'seed-acriss',null),
  ('contains','fullsize suv', null,'LARGE_SUV',  61,0.85,'seed-acriss',null),
  ('contains','luxury suv',   null,'PREMIUM',    61,0.80,'seed-acriss',null),
  ('contains','oversize',     null,'LARGE_SUV',  68,0.70,'seed-acriss',null)
on conflict (match_type, pattern, coalesce(source_code,'*')) do nothing;
