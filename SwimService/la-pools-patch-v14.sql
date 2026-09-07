-- v14: keep only REAL(OSM tags.name) + ADDR(street+housenumber) = 120 rows; DELETE NOINFO #Hash 850 rows
DO $$
DECLARE
  v_la_city_id UUID;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT id INTO v_la_city_id FROM cities WHERE code = 'la';

  SELECT COUNT(*) INTO v_before
  FROM venues
  WHERE city_id = v_la_city_id AND data_source = 'OSM_OVERPASS';

  -- DELETE only NOINFO rows: name starts with 'Swimming Pool #'
  DELETE FROM venues
  WHERE city_id = v_la_city_id
    AND data_source = 'OSM_OVERPASS'
    AND name LIKE 'Swimming Pool #%';

  SELECT COUNT(*) INTO v_after
  FROM venues
  WHERE city_id = v_la_city_id AND data_source = 'OSM_OVERPASS';

  RAISE NOTICE '[v14] before=% after=% (keep only REAL OSM names + real addresses)', v_before, v_after;
END $$;
