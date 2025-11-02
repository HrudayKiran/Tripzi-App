-- Complete fix for trip preferences - handle all edge cases
-- First, let's see what values exist and update them properly

-- Update any NULL values to default
UPDATE public.trips SET gender_preference = 'Male and Female' WHERE gender_preference IS NULL;
UPDATE public.trips SET transport_type = 'Other' WHERE transport_type IS NULL;

-- Handle case variations and edge cases
UPDATE public.trips SET gender_preference = 'Male and Female'
WHERE LOWER(TRIM(gender_preference)) IN ('both', 'male and female', 'male & female', 'any', 'all');

UPDATE public.trips SET gender_preference = 'Male'
WHERE LOWER(TRIM(gender_preference)) IN ('male', 'm', 'man', 'men');

UPDATE public.trips SET gender_preference = 'Female'
WHERE LOWER(TRIM(gender_preference)) IN ('female', 'f', 'woman', 'women', 'lady', 'ladies');

-- Handle transport type variations
UPDATE public.trips SET transport_type = 'Train'
WHERE LOWER(TRIM(transport_type)) IN ('train', 'rail', 'railway');

UPDATE public.trips SET transport_type = 'Bus'
WHERE LOWER(TRIM(transport_type)) IN ('bus', 'coach');

UPDATE public.trips SET transport_type = 'Bike'
WHERE LOWER(TRIM(transport_type)) IN ('bike', 'bicycle', 'cycle', 'motorcycle');

UPDATE public.trips SET transport_type = 'Car'
WHERE LOWER(TRIM(transport_type)) IN ('car', 'auto', 'automobile', 'vehicle');

UPDATE public.trips SET transport_type = 'Flight'
WHERE LOWER(TRIM(transport_type)) IN ('flight', 'plane', 'airplane', 'air');

UPDATE public.trips SET transport_type = 'Other'
WHERE LOWER(TRIM(transport_type)) NOT IN ('train', 'bus', 'bike', 'car', 'flight', 'other')
   OR transport_type IS NULL;

-- Drop existing constraints if they exist
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_gender_preference_check;
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_transport_type_check;

-- Update column defaults
ALTER TABLE public.trips ALTER COLUMN gender_preference SET DEFAULT 'Male and Female';
ALTER TABLE public.trips ALTER COLUMN transport_type SET DEFAULT 'Other';

-- Add new constraints with correct values
ALTER TABLE public.trips ADD CONSTRAINT trips_gender_preference_check
  CHECK (gender_preference IN ('Male', 'Female', 'Male and Female'));

ALTER TABLE public.trips ADD CONSTRAINT trips_transport_type_check
  CHECK (transport_type IN ('Train', 'Bus', 'Bike', 'Car', 'Flight', 'Other'));
