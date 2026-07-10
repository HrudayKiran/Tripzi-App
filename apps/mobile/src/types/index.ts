export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  max_travelers: number;
  current_travelers: number;
  status: string;
}

export interface Booking {
  id: string;
  status: string;
  trip_id: string;
  trip: Trip;
}
