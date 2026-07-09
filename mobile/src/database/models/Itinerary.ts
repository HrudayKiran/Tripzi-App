import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Itinerary extends Model {
  static table = 'itineraries';

  @field('user_id') userId!: string;
  @field('trip_title') tripTitle!: string;
  @field('from_location') fromLocation?: string;
  @field('to_location') toLocation?: string;
  @field('from_date') fromDate!: string;
  @field('to_date') toDate!: string;
  @field('duration_days') durationDays?: number;
  @field('travel_style') travelStyle!: string;
  @field('trip_types') tripTypesRaw?: string; // JSON string array
  @field('transport_modes') transportModesRaw?: string; // JSON string array
  @field('cost_per_person') costPerPerson?: number;
  @field('accommodation_type') accommodationType?: string;
  @field('booking_status') bookingStatus?: string;
  @field('accommodation_days') accommodationDays?: number;
  @field('places_to_visit') placesToVisitRaw?: string; // JSON string array
  @field('itinerary') itineraryRaw?: string; // JSON string array
  @field('participants') participantsRaw?: string; // JSON string array
  @field('checklist') checklistRaw?: string; // JSON string array
  @field('notes') notesRaw?: string; // JSON string array
  @field('itinerary_map_view') itineraryMapViewRaw?: string; // JSON string object

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get tripTypes(): string[] {
    try {
      return this.tripTypesRaw ? JSON.parse(this.tripTypesRaw) : [];
    } catch {
      return [];
    }
  }

  get transportModes(): string[] {
    try {
      return this.transportModesRaw ? JSON.parse(this.transportModesRaw) : [];
    } catch {
      return [];
    }
  }

  get placesToVisit(): any[] {
    try {
      return this.placesToVisitRaw ? JSON.parse(this.placesToVisitRaw) : [];
    } catch {
      return [];
    }
  }

  get itinerary(): any[] {
    try {
      return this.itineraryRaw ? JSON.parse(this.itineraryRaw) : [];
    } catch {
      return [];
    }
  }


  get participants(): string[] {
    try {
      return this.participantsRaw ? JSON.parse(this.participantsRaw) : [];
    } catch {
      return [];
    }
  }

  get checklist(): any[] {
    try {
      return this.checklistRaw ? JSON.parse(this.checklistRaw) : [];
    } catch {
      return [];
    }
  }

  get notes(): any[] {
    try {
      return this.notesRaw ? JSON.parse(this.notesRaw) : [];
    } catch {
      return [];
    }
  }

  get itineraryMapView(): any {
    try {
      return this.itineraryMapViewRaw ? JSON.parse(this.itineraryMapViewRaw) : null;
    } catch {
      return null;
    }
  }
}
