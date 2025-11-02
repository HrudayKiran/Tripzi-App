-- Fix trip preferences to match frontend values
-- Update existing data to match new format
UPDATE public.trips SET gender_preference = 'Male and Female' WHERE gender_preference = 'both';
UPDATE public.trips SET gender_preference = 'Male' WHERE gender_preference = 'male';
UPDATE public.trips SET gender_preference = 'Female' WHERE gender_preference = 'female';

UPDATE public.trips SET transport_type = 'Train' WHERE transport_type = 'train';
UPDATE public.trips SET transport_type = 'Bus' WHERE transport_type = 'bus';
UPDATE public.trips SET transport_type = 'Bike' WHERE transport_type = 'bike';
UPDATE public.trips SET transport_type = 'Car' WHERE transport_type = 'car';
UPDATE public.trips SET transport_type = 'Flight' WHERE transport_type = 'flight';
UPDATE public.trips SET transport_type = 'Other' WHERE transport_type = 'other';

-- Drop existing constraints
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
