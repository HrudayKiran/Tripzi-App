import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 12,
  tables: [
    tableSchema({
      name: 'profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'username', type: 'string', isOptional: true },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'push_notifications_enabled', type: 'boolean' },
        { name: 'save_to_gallery', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'itineraries',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'trip_title', type: 'string' },
        { name: 'from_location', type: 'string', isOptional: true },
        { name: 'to_location', type: 'string', isOptional: true },
        { name: 'from_date', type: 'string' },
        { name: 'to_date', type: 'string' },
        { name: 'duration_days', type: 'number', isOptional: true },
        { name: 'travel_style', type: 'string' },
        { name: 'trip_types', type: 'string', isOptional: true }, // JSON string array
        { name: 'transport_modes', type: 'string', isOptional: true }, // JSON string array
        { name: 'cost_per_person', type: 'number', isOptional: true },
        { name: 'accommodation_type', type: 'string', isOptional: true },
        { name: 'booking_status', type: 'string', isOptional: true },
        { name: 'accommodation_days', type: 'number', isOptional: true },
        { name: 'places_to_visit', type: 'string', isOptional: true }, // JSON string array
        { name: 'itinerary', type: 'string', isOptional: true }, // JSON string array
        { name: 'participants', type: 'string', isOptional: true }, // JSON string array
        { name: 'checklist', type: 'string', isOptional: true }, // JSON string array
        { name: 'notes', type: 'string', isOptional: true }, // JSON string array
        { name: 'itinerary_map_view', type: 'string', isOptional: true }, // JSON string object
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'direct_chats',
      columns: [
        { name: 'participants', type: 'string' }, // JSON string (array of IDs)
        { name: 'participant_details', type: 'string', isOptional: true }, // JSON string
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
      name: 'group_chats',
      columns: [
        { name: 'group_name', type: 'string' },
        { name: 'group_description', type: 'string', isOptional: true },
        { name: 'group_icon', type: 'string', isOptional: true },
        { name: 'participants', type: 'string' }, // JSON string
        { name: 'participant_details', type: 'string', isOptional: true }, // JSON string
        { name: 'created_by', type: 'string', isOptional: true },
        { name: 'member_count', type: 'number', isOptional: true },
        { name: 'hidden', type: 'boolean' },
        { name: 'admins', type: 'string', isOptional: true }, // JSON string
        { name: 'last_message', type: 'string', isOptional: true }, // JSON string
        { name: 'unread_count', type: 'string', isOptional: true }, // JSON string
        { name: 'deleted_for', type: 'string', isOptional: true }, // JSON string
        { name: 'cleared_at', type: 'string', isOptional: true }, // JSON string
        { name: 'typing', type: 'string', isOptional: true }, // JSON string
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'chat_id', type: 'string', isIndexed: true },
        { name: 'chat_type', type: 'string' },
        { name: 'sender_id', type: 'string', isIndexed: true },
        { name: 'sender_name', type: 'string' },
        { name: 'text', type: 'string', isOptional: true },
        { name: 'type', type: 'string' },
        { name: 'media_url', type: 'string', isOptional: true },
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
