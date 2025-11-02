-- Create atomic booking function to prevent race conditions
CREATE OR REPLACE FUNCTION public.book_trip(
  p_trip_id UUID,
  p_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_max integer;
  v_booking_id uuid;
  v_trip_status text;
BEGIN
  -- Lock the trip row for update to prevent race conditions
  SELECT current_travelers, max_travelers, status
  INTO v_current, v_max, v_trip_status
  FROM trips
  WHERE id = p_trip_id
  FOR UPDATE;
  
  -- Check if trip exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Trip not found');
  END IF;
  
  -- Check if trip is open
  IF v_trip_status != 'open' THEN
    RETURN jsonb_build_object('error', 'Trip is not available for booking');
  END IF;
  
  -- Check if trip is full
  IF v_current >= v_max THEN
    RETURN jsonb_build_object('error', 'Trip is full');
  END IF;
  
  -- Check for existing booking
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE trip_id = p_trip_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'You have already booked this trip');
  END IF;
  
  -- Insert booking
  INSERT INTO bookings (trip_id, user_id, status)
  VALUES (p_trip_id, p_user_id, 'confirmed')
  RETURNING id INTO v_booking_id;
  
  -- Update counter atomically
  UPDATE trips
  SET current_travelers = current_travelers + 1
  WHERE id = p_trip_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'booking_id', v_booking_id,
    'current_travelers', v_current + 1
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.book_trip(UUID, UUID) TO authenticated;