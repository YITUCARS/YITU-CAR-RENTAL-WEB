-- ============================================================================
-- Mapping rules added from the first A Rentals collection (Christchurch).
-- Written because a live listing came back unresolved or misclassified, not
-- guessed in advance.
-- ============================================================================

insert into market_intel.vehicle_class_mapping
  (match_type, pattern, source_code, vehicle_class, priority, confidence, created_by, notes) values

  -- ---- people movers a brand fallback was mislabelling as PREMIUM ---------
  ('contains','staria',      null,'VAN_8_SEAT', 30,0.94,'seed-a-rentals','Hyundai Staria 8-seat MPV'),
  ('contains','vito',        null,'VAN_8_SEAT', 30,0.92,'seed-a-rentals','Mercedes Vito Tourer'),
  ('contains','sprinter',    null,'VAN_12_SEAT',30,0.95,'seed-a-rentals','Mercedes Sprinter minibus'),
  ('contains','transit',     null,'VAN_12_SEAT',32,0.88,'seed-a-rentals','Ford Transit minibus'),
  ('contains','h1',          null,'VAN_8_SEAT', 34,0.80,'seed-a-rentals','Hyundai H1'),

  -- ---- this site's own category labels ------------------------------------
  -- Its cards carry a category class (compact / medium / suv / mpv-2 / van),
  -- which the collector passes through as the class hint.
  ('exact','medium',         null,'MIDSIZE',    60,0.82,'seed-a-rentals',null),
  ('exact','suv',            null,'MIDSIZE_SUV',64,0.75,'seed-a-rentals','bare "suv"; seat count and model names refine it'),
  ('contains','mpv',         null,'VAN_8_SEAT', 63,0.85,'seed-a-rentals','their MPV category, e.g. "mpv-2"'),

  -- ---- models seen in their fleet ------------------------------------------
  ('contains','x mode',      null,'MIDSIZE_SUV',44,0.80,'seed-a-rentals','Subaru Forester X-Mode trim'),
  ('contains','tourer',      null,'VAN_8_SEAT', 46,0.72,'seed-a-rentals','"-Tourer" naming on van variants')
on conflict (match_type, pattern, coalesce(source_code,'*')) do nothing;
