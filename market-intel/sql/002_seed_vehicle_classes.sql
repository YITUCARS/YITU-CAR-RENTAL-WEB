-- ============================================================================
-- Seed: normalized vehicle classes + deterministic mapping rules.
-- Re-runnable. Rules added by a human later are preserved (created_by <> 'seed'
-- rows are never touched here).
-- ============================================================================

insert into market_intel.vehicle_classes (code, label, sort_order, typical_seats_min, typical_seats_max, description) values
  ('ECONOMY',     'Economy',          10, 4, 5, 'Smallest hatchbacks: Yaris, Swift, Picanto'),
  ('COMPACT',     'Compact',          20, 5, 5, 'Small hatch/sedan: Corolla, Mazda 3, i30'),
  ('MIDSIZE',     'Midsize',          30, 5, 5, 'Mid sedan/wagon: Camry, Mazda 6'),
  ('FULLSIZE',    'Full size',        40, 5, 5, 'Large sedan/wagon: Commodore, Aurion'),
  ('COMPACT_SUV', 'Compact SUV',      50, 5, 5, 'Small crossover: MG ZS, Qashqai, CX-3'),
  ('MIDSIZE_SUV', 'Midsize SUV',      60, 5, 5, 'Intermediate SUV: RAV4, CX-5, X-Trail'),
  ('LARGE_SUV',   'Large SUV',        70, 7, 8, '7-seat SUV: Highlander, Sorento, Prado'),
  ('PREMIUM',     'Premium / Luxury', 80, 4, 5, 'Prestige marques and luxury trims'),
  ('EV',          'Electric',         90, 4, 7, 'Battery electric, any body style'),
  ('VAN_8_SEAT',  '8 seat van',      100, 7, 8, 'People mover: Carnival, Odyssey, Multivan'),
  ('VAN_12_SEAT', '12 seat van',     110, 9,12, 'Minibus: Hiace Commuter and similar')
on conflict (code) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      typical_seats_min = excluded.typical_seats_min,
      typical_seats_max = excluded.typical_seats_max,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- Mapping rules.
-- Patterns are compared against a normalized key: lowercased, punctuation and
-- 'or similar' stripped, whitespace squashed. Lower priority number wins.
--
-- Priority bands:
--    10  electric models (must beat their petrol namesake, e.g. Kona Electric)
--    20  seat-count minibus/van signals
--    40  specific models
--    60  the source's own class label ('Intermediate SUV')
--    90  brand-level fallback (premium marques)
-- ---------------------------------------------------------------------------
insert into market_intel.vehicle_class_mapping
  (match_type, pattern, source_code, vehicle_class, priority, confidence, notes) values

  -- ---- 10: electric -------------------------------------------------------
  ('contains','tesla',            null,'EV',10,0.99,null),
  ('contains','nissan leaf',      null,'EV',10,0.99,null),
  ('contains','leaf',             null,'EV',15,0.90,null),
  ('contains','byd',              null,'EV',10,0.95,null),
  ('contains','polestar',         null,'EV',10,0.99,null),
  ('contains','kona electric',    null,'EV',10,0.99,null),
  ('contains','ioniq',            null,'EV',10,0.97,null),
  ('contains','ev6',              null,'EV',10,0.99,null),
  ('contains','niro ev',          null,'EV',10,0.97,null),
  ('contains','mg 4',             null,'EV',10,0.97,null),
  ('contains','mg4',              null,'EV',10,0.97,null),
  ('contains','id 4',             null,'EV',10,0.95,null),
  ('contains','e tron',           null,'EV',10,0.95,null),
  ('regex','\melectric\M',        null,'EV',18,0.85,'generic electric wording'),

  -- ---- 20: vans / minibuses ----------------------------------------------
  ('regex','\m(11|12) ?seat',     null,'VAN_12_SEAT',20,0.97,null),
  ('regex','\m(8|9|10) ?seat',    null,'VAN_8_SEAT',20,0.95,null),
  ('contains','hiace commuter',   null,'VAN_12_SEAT',20,0.97,null),
  ('contains','minibus',          null,'VAN_12_SEAT',22,0.90,null),
  ('contains','kia carnival',     null,'VAN_8_SEAT',25,0.95,null),
  ('contains','carnival',         null,'VAN_8_SEAT',30,0.90,null),
  ('contains','odyssey',          null,'VAN_8_SEAT',30,0.92,null),
  ('contains','multivan',         null,'VAN_8_SEAT',30,0.92,null),
  ('contains','starex',           null,'VAN_8_SEAT',30,0.90,null),
  ('contains','imax',             null,'VAN_8_SEAT',30,0.90,null),
  ('contains','previa',           null,'VAN_8_SEAT',30,0.90,null),
  ('contains','estima',           null,'VAN_8_SEAT',30,0.90,null),
  ('contains','people mover',     null,'VAN_8_SEAT',35,0.85,null),

  -- ---- 40: models, economy ------------------------------------------------
  ('contains','toyota yaris',     null,'ECONOMY',40,0.95,null),
  ('contains','yaris cross',      null,'COMPACT_SUV',38,0.95,'must beat plain yaris'),
  ('contains','yaris',            null,'ECONOMY',45,0.90,null),
  ('contains','vitz',             null,'ECONOMY',40,0.92,null),
  ('contains','suzuki swift',     null,'ECONOMY',40,0.95,null),
  ('contains','swift',            null,'ECONOMY',45,0.90,null),
  ('contains','picanto',          null,'ECONOMY',40,0.95,null),
  ('contains','mirage',           null,'ECONOMY',40,0.95,null),
  ('contains','micra',            null,'ECONOMY',40,0.95,null),
  ('contains','i20',              null,'ECONOMY',40,0.93,null),
  ('contains','mazda 2',          null,'ECONOMY',40,0.94,null),
  ('contains','mazda2',           null,'ECONOMY',40,0.94,null),
  ('contains','honda jazz',       null,'ECONOMY',40,0.94,null),
  ('contains','honda fit',        null,'ECONOMY',40,0.94,null),
  ('contains','baleno',           null,'ECONOMY',42,0.88,null),
  ('contains','rio',              null,'ECONOMY',42,0.88,null),

  -- ---- 40: models, compact ------------------------------------------------
  ('contains','corolla cross',    null,'COMPACT_SUV',38,0.95,'must beat plain corolla'),
  ('contains','corolla',          null,'COMPACT',40,0.94,null),
  ('contains','mazda 3',          null,'COMPACT',40,0.94,null),
  ('contains','mazda3',           null,'COMPACT',40,0.94,null),
  ('contains','i30',              null,'COMPACT',40,0.94,null),
  ('contains','cerato',           null,'COMPACT',40,0.94,null),
  ('contains','golf',             null,'COMPACT',40,0.92,null),
  ('contains','civic',            null,'COMPACT',40,0.92,null),
  ('contains','impreza',          null,'COMPACT',40,0.92,null),
  ('contains','pulsar',           null,'COMPACT',40,0.90,null),
  ('contains','astra',            null,'COMPACT',40,0.90,null),
  ('contains','focus',            null,'COMPACT',40,0.90,null),

  -- ---- 40: models, midsize / fullsize ------------------------------------
  ('contains','camry',            null,'MIDSIZE',40,0.95,null),
  ('contains','mazda 6',          null,'MIDSIZE',40,0.94,null),
  ('contains','mazda6',           null,'MIDSIZE',40,0.94,null),
  ('contains','altima',           null,'MIDSIZE',40,0.92,null),
  ('contains','sonata',           null,'MIDSIZE',40,0.92,null),
  ('contains','accord',           null,'MIDSIZE',40,0.92,null),
  ('contains','octavia',          null,'MIDSIZE',40,0.90,null),
  ('contains','allion',           null,'MIDSIZE',40,0.88,null),
  ('contains','premio',           null,'MIDSIZE',40,0.88,null),
  ('contains','commodore',        null,'FULLSIZE',40,0.92,null),
  ('contains','falcon',           null,'FULLSIZE',40,0.92,null),
  ('contains','aurion',           null,'FULLSIZE',40,0.92,null),
  ('contains','chrysler 300',     null,'FULLSIZE',40,0.90,null),

  -- ---- 40: models, compact SUV -------------------------------------------
  ('contains','mg zs',            null,'COMPACT_SUV',40,0.95,null),
  ('contains','qashqai',          null,'COMPACT_SUV',40,0.95,null),
  ('contains','cx 3',             null,'COMPACT_SUV',40,0.94,null),
  ('contains','cx 30',            null,'COMPACT_SUV',40,0.94,null),
  ('contains','c hr',             null,'COMPACT_SUV',40,0.93,null),
  ('contains','hr v',             null,'COMPACT_SUV',40,0.93,null),
  ('contains','kona',             null,'COMPACT_SUV',45,0.90,null),
  ('contains','seltos',           null,'COMPACT_SUV',40,0.93,null),
  ('contains','vitara',           null,'COMPACT_SUV',40,0.92,null),
  ('contains','subaru xv',        null,'COMPACT_SUV',40,0.92,null),
  ('contains','crosstrek',        null,'COMPACT_SUV',40,0.92,null),
  ('contains','asx',              null,'COMPACT_SUV',40,0.92,null),
  ('contains','jolion',           null,'COMPACT_SUV',40,0.90,null),
  ('contains','stonic',           null,'COMPACT_SUV',40,0.90,null),
  ('contains','ecosport',         null,'COMPACT_SUV',40,0.90,null),

  -- ---- 40: models, midsize SUV -------------------------------------------
  ('contains','rav4',             null,'MIDSIZE_SUV',40,0.96,'"Toyota RAV4 or similar"'),
  ('contains','cx 5',             null,'MIDSIZE_SUV',40,0.95,null),
  ('contains','x trail',          null,'MIDSIZE_SUV',40,0.95,null),
  ('contains','xtrail',           null,'MIDSIZE_SUV',40,0.95,null),
  ('contains','cr v',             null,'MIDSIZE_SUV',40,0.94,null),
  ('contains','tucson',           null,'MIDSIZE_SUV',40,0.94,null),
  ('contains','sportage',         null,'MIDSIZE_SUV',40,0.94,null),
  ('contains','outlander',        null,'MIDSIZE_SUV',42,0.88,'7-seat variants exist; seats override'),
  ('contains','forester',         null,'MIDSIZE_SUV',40,0.94,null),
  ('contains','outback',          null,'MIDSIZE_SUV',40,0.92,null),
  ('contains','escape',           null,'MIDSIZE_SUV',40,0.92,null),
  ('contains','tiguan',           null,'MIDSIZE_SUV',40,0.92,null),
  ('contains','mg hs',            null,'MIDSIZE_SUV',40,0.93,null),
  ('contains','haval h6',         null,'MIDSIZE_SUV',40,0.92,null),
  ('contains','equinox',          null,'MIDSIZE_SUV',40,0.90,null),

  -- ---- 40: models, large SUV ---------------------------------------------
  ('contains','highlander',       null,'LARGE_SUV',40,0.95,null),
  ('contains','land cruiser',     null,'LARGE_SUV',40,0.95,null),
  ('contains','landcruiser',      null,'LARGE_SUV',40,0.95,null),
  ('contains','prado',            null,'LARGE_SUV',40,0.95,null),
  ('contains','pathfinder',       null,'LARGE_SUV',40,0.94,null),
  ('contains','everest',          null,'LARGE_SUV',40,0.93,null),
  ('contains','santa fe',         null,'LARGE_SUV',40,0.94,null),
  ('contains','sorento',          null,'LARGE_SUV',40,0.94,null),
  ('contains','cx 8',             null,'LARGE_SUV',40,0.93,null),
  ('contains','cx 9',             null,'LARGE_SUV',40,0.93,null),
  ('contains','pajero',           null,'LARGE_SUV',40,0.92,null),
  ('contains','mu x',             null,'LARGE_SUV',40,0.90,null),
  ('contains','trailblazer',      null,'LARGE_SUV',40,0.90,null),

  -- ---- 60: the source's own class labels ----------------------------------
  ('exact','economy',             null,'ECONOMY',60,0.85,null),
  ('exact','mini',                null,'ECONOMY',60,0.80,null),
  ('exact','small',               null,'ECONOMY',60,0.75,null),
  ('exact','compact',             null,'COMPACT',60,0.85,null),
  ('exact','intermediate',        null,'MIDSIZE',60,0.85,null),
  ('exact','standard',            null,'MIDSIZE',60,0.80,null),
  ('exact','midsize',             null,'MIDSIZE',60,0.85,null),
  ('exact','mid size',            null,'MIDSIZE',60,0.85,null),
  ('exact','full size',           null,'FULLSIZE',60,0.85,null),
  ('exact','fullsize',            null,'FULLSIZE',60,0.85,null),
  ('exact','large',               null,'FULLSIZE',60,0.75,null),
  ('contains','compact suv',      null,'COMPACT_SUV',62,0.88,null),
  ('contains','small suv',        null,'COMPACT_SUV',62,0.85,null),
  ('contains','intermediate suv', null,'MIDSIZE_SUV',62,0.90,'"Intermediate SUV"'),
  ('contains','midsize suv',      null,'MIDSIZE_SUV',62,0.90,null),
  ('contains','standard suv',     null,'MIDSIZE_SUV',62,0.85,null),
  ('contains','medium suv',       null,'MIDSIZE_SUV',62,0.88,null),
  ('contains','full size suv',    null,'LARGE_SUV',61,0.88,null),
  ('contains','large suv',        null,'LARGE_SUV',61,0.90,null),
  ('contains','premium suv',      null,'PREMIUM',61,0.85,null),
  ('contains','7 seat suv',       null,'LARGE_SUV',58,0.90,null),
  ('contains','luxury',           null,'PREMIUM',62,0.85,null),
  ('contains','premium',          null,'PREMIUM',65,0.80,null),
  ('contains','prestige',         null,'PREMIUM',65,0.80,null),

  -- ---- 90: brand fallback -------------------------------------------------
  ('contains','mercedes',         null,'PREMIUM',90,0.75,null),
  ('contains','bmw',              null,'PREMIUM',90,0.75,null),
  ('contains','audi',             null,'PREMIUM',90,0.75,null),
  ('contains','lexus',            null,'PREMIUM',90,0.75,null),
  ('contains','jaguar',           null,'PREMIUM',90,0.75,null),
  ('contains','porsche',          null,'PREMIUM',90,0.80,null),
  ('contains','volvo',            null,'PREMIUM',92,0.70,null)
on conflict (match_type, pattern, coalesce(source_code,'*')) do nothing;
