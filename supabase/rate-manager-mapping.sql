-- Run this once in Supabase SQL Editor after the rate-manager tables exist.
-- These stable export names keep the current RCM Rate Export compatible.
update public.rate_vehicle_categories
set rcm_export_name = 'Toyota Vellfire 7 Seats'
where ota_group_id = '1003' and rcm_category_code = 'UVAR';

update public.rate_vehicle_categories
set rcm_export_name = 'Toyota Vellfire 8 Seats'
where ota_group_id = '37658' and rcm_category_code = 'GVAV';
