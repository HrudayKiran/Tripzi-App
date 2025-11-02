-- Add new columns to trips table for enhanced trip preferences
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS gender_preference text DEFAULT 'both' CHECK (gender_preference IN ('male', 'female', 'both')),
ADD COLUMN IF NOT EXISTS transport_type text DEFAULT 'other' CHECK (transport_type IN ('train', 'bus', 'bike', 'car', 'flight', 'other'));

-- Add kyc_status column to profiles if not exists (for booking restrictions)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'not_submitted' CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected'));

-- Update existing trips to have default values
UPDATE public.trips SET gender_preference = 'both' WHERE gender_preference IS NULL;
UPDATE public.trips SET transport_type = 'other' WHERE transport_type IS NULL;
