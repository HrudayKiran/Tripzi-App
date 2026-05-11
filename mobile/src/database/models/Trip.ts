import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Trip extends Model {
  static table = 'trips';

  @field('user_id') userId!: string;
  @field('title') title!: string;
  @field('description') description?: string;
  @field('location') location!: string;
  @field('from_location') fromLocation?: string;
  @field('to_location') toLocation?: string;
  @field('from_date') fromDate!: string;
  @field('to_date') toDate!: string;
  @field('max_travelers') maxTravelers!: number;
  @field('current_travelers') currentTravelers!: number;
  @field('gender_preference') genderPreference!: string;
  @field('status') status!: string;
  @field('trip_type') tripType!: string;
  @field('transport_mode') transportMode?: string;
  @field('accommodation_type') accommodationType?: string;
  @field('duration_days') durationDays?: number;
  @field('booking_status') bookingStatus?: string;
  @field('places_to_visit') placesToVisitRaw?: string; // JSON string
  @field('mandatory_items') mandatoryItemsRaw?: string; // JSON string
  @field('itinerary') itineraryRaw?: string; // JSON string
  @field('image_object_keys') imageObjectKeysRaw?: string; // JSON string
  @field('cancel_reason') cancelReason?: string;
  @field('cancelled_at') cancelledAt?: number;
  @field('completed_at') completedAt?: number;
  @field('delete_reason') deleteReason?: string;
  @field('deleted_at') deletedAt?: number;
  @field('last_leave_reason') lastLeaveReason?: string;
  @field('owner_profile_updated_at') ownerProfileUpdatedAt?: number;
  
  @field('is_expired') isExpired!: boolean;
  @field('is_cancelled') isCancelled!: boolean;
  @field('is_completed') isCompleted!: boolean;
  
  @field('owner_display_name') ownerDisplayName?: string;
  @field('owner_photo_url') ownerPhotoUrl?: string;
  @field('owner_username') ownerUsername?: string;
  @field('cost') cost?: number;
  @field('total_cost') totalCost?: number;
  @field('cost_per_person') costPerPerson?: number;
  @field('accommodation_days') accommodationDays?: number;
  @field('maps_link') mapsLink?: string;
  @field('duration') duration?: string;
  @field('trip_types') tripTypesRaw?: string; // JSON string
  @field('transport_modes') transportModesRaw?: string; // JSON string
  @field('image_locations') imageLocationsRaw?: string; // JSON string
  @field('cover_image') coverImage?: string;
  @field('images') imagesRaw?: string; // JSON string
  @field('participants') participantsRaw?: string; // JSON string

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get placesToVisit(): string[] {
    try {
      return this.placesToVisitRaw ? JSON.parse(this.placesToVisitRaw) : [];
    } catch {
      return [];
    }
  }

  get itinerary(): string[] {
    try {
      return this.itineraryRaw ? JSON.parse(this.itineraryRaw) : [];
    } catch {
      return [];
    }
  }

  get mandatoryItems(): string[] {
    try {
      return this.mandatoryItemsRaw ? JSON.parse(this.mandatoryItemsRaw) : [];
    } catch {
      return [];
    }
  }

  get images(): string[] {
    try {
      return this.imagesRaw ? JSON.parse(this.imagesRaw) : [];
    } catch {
      return [];
    }
  }

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

  get imageLocations(): string[] {
    try {
      return this.imageLocationsRaw ? JSON.parse(this.imageLocationsRaw) : [];
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
}
