
    SELECT 
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default,
      c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' 
      AND c.table_name = 'boarding_facilities'
    ORDER BY c.ordinal_position;
  