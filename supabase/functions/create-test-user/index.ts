import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create an anonymous user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `testuser_${Date.now()}@tripzi.test`,
      password: 'TestUser123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Priya Sharma',
        phone_number: '+91 9876543210'
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    const userId = authData.user.id;
    console.log('Created user:', userId);

    // Update profile with more details
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: 'Priya Sharma',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        bio: 'Travel enthusiast | Adventure seeker | Love exploring new places 🌍✈️',
        kyc_status: 'verified'
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile error:', profileError);
    }

    // Create trips
    const trips = [
      {
        user_id: userId,
        title: 'Goa Beach Adventure',
        description: 'Join me for an amazing beach vacation in Goa! We will explore beautiful beaches, try water sports, and enjoy the nightlife. Perfect for adventure seekers!',
        destination: 'Goa, India',
        cost: 15000,
        start_date: '2025-01-15',
        end_date: '2025-01-20',
        max_travelers: 5,
        current_travelers: 1,
        status: 'open',
        transport_type: 'Flight',
        gender_preference: 'both'
      },
      {
        user_id: userId,
        title: 'Manali Snow Trek',
        description: 'Experience the magic of snow-capped mountains in Manali. Includes trekking, camping, and bonfires. Warm clothes essential!',
        destination: 'Manali, Himachal Pradesh',
        cost: 20000,
        start_date: '2025-02-01',
        end_date: '2025-02-07',
        max_travelers: 8,
        current_travelers: 2,
        status: 'open',
        transport_type: 'Bus',
        gender_preference: 'both'
      },
      {
        user_id: userId,
        title: 'Kerala Backwaters Tour',
        description: 'Explore the serene backwaters of Kerala on a houseboat. Traditional cuisine, ayurvedic spa, and peaceful vibes await!',
        destination: 'Alleppey, Kerala',
        cost: 25000,
        start_date: '2025-01-25',
        end_date: '2025-01-30',
        max_travelers: 4,
        current_travelers: 1,
        status: 'open',
        transport_type: 'Train',
        gender_preference: 'both'
      },
      {
        user_id: userId,
        title: 'Rajasthan Heritage Tour',
        description: 'Discover the rich culture and heritage of Rajasthan. Visit Jaipur, Udaipur, and Jodhpur. Camel safari included!',
        destination: 'Rajasthan, India',
        cost: 30000,
        start_date: '2025-02-15',
        end_date: '2025-02-22',
        max_travelers: 6,
        current_travelers: 3,
        status: 'open',
        transport_type: 'Car',
        gender_preference: 'both'
      }
    ];

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .insert(trips)
      .select();

    if (tripsError) {
      console.error('Trips error:', tripsError);
      throw tripsError;
    }

    console.log('Created trips:', tripsData?.length);

    // Add images to trips
    const tripImages = tripsData?.map((trip, index) => ({
      trip_id: trip.id,
      image_url: [
        'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800',
        'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800',
        'https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=800',
        'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800'
      ][index]
    }));

    if (tripImages) {
      const { error: imagesError } = await supabase
        .from('trip_images')
        .insert(tripImages);

      if (imagesError) {
        console.error('Images error:', imagesError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: 'Test user "Priya Sharma" created with 4 trips!',
        trips: tripsData?.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});