import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'username', type: 'string', isOptional: true },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'bio', type: 'string', isOptional: true },
        { name: 'push_notifications_enabled', type: 'boolean' },
        { name: 'save_to_gallery', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'trips',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'location', type: 'string' },
        { name: 'from_date', type: 'string' },
        { name: 'to_date', type: 'string' },
        { name: 'max_travelers', type: 'number' },
        { name: 'current_travelers', type: 'number' },
        { name: 'gender_preference', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'trip_type', type: 'string' },
        { name: 'transport_mode', type: 'string', isOptional: true },
        { name: 'accommodation_type', type: 'string', isOptional: true },
        { name: 'duration_days', type: 'number', isOptional: true },
        { name: 'booking_status', type: 'string', isOptional: true },
        { name: 'places_to_visit', type: 'string', isOptional: true }, // JSON string
        { name: 'mandatory_items', type: 'string', isOptional: true }, // JSON string
        { name: 'is_expired', type: 'boolean' },
        { name: 'is_cancelled', type: 'boolean' },
        { name: 'is_completed', type: 'boolean' },
        { name: 'owner_display_name', type: 'string', isOptional: true },
        { name: 'owner_photo_url', type: 'string', isOptional: true },
        { name: 'owner_username', type: 'string', isOptional: true },
        { name: 'cost', type: 'number', isOptional: true },
        { name: 'total_cost', type: 'number', isOptional: true },
        { name: 'cost_per_person', type: 'number', isOptional: true },
        { name: 'accommodation_days', type: 'number', isOptional: true },
        { name: 'maps_link', type: 'string', isOptional: true },
        { name: 'duration', type: 'string', isOptional: true },
        { name: 'trip_types', type: 'string', isOptional: true }, // JSON string
        { name: 'transport_modes', type: 'string', isOptional: true }, // JSON string
        { name: 'image_locations', type: 'string', isOptional: true }, // JSON string
        { name: 'cover_image', type: 'string', isOptional: true },
        { name: 'images', type: 'string', isOptional: true }, // JSON string
        { name: 'participants', type: 'string', isOptional: true }, // JSON string
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chats',
      columns: [
        { name: 'type', type: 'string' },
        { name: 'participants', type: 'string' }, // JSON string (array of IDs)
        { name: 'last_message', type: 'string', isOptional: true },
        { name: 'last_message_at', type: 'number', isOptional: true },
        { name: 'unread_count', type: 'string', isOptional: true }, // JSON string (map of UID -> count)
        { name: 'cleared_at', type: 'string', isOptional: true }, // JSON string (map of UID -> ISO date)
        { name: 'deleted_for', type: 'string', isOptional: true }, // JSON string (array of IDs)
        { name: 'typing', type: 'string', isOptional: true }, // JSON string (map of UID -> boolean)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'chat_id', type: 'string', isIndexed: true },
        { name: 'sender_id', type: 'string', isIndexed: true },
        { name: 'sender_name', type: 'string' },
        { name: 'text', type: 'string', isOptional: true },
        { name: 'type', type: 'string' },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'media_thumbnail', type: 'string', isOptional: true },
        { name: 'location', type: 'string', isOptional: true }, // JSON string
        { name: 'voice_duration', type: 'number', isOptional: true },
        { name: 'reply_to', type: 'string', isOptional: true }, // JSON string
        { name: 'status', type: 'string' },
        { name: 'read_by', type: 'string', isOptional: true }, // JSON string
        { name: 'delivered_to', type: 'string', isOptional: true }, // JSON string
        { name: 'deleted_for', type: 'string', isOptional: true }, // JSON string
        { name: 'deleted_for_everyone_at', type: 'number', isOptional: true },
        { name: 'mentions', type: 'string', isOptional: true }, // JSON string
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'edited_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
