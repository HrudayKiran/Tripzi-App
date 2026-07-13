import { schemaMigrations, createTable, addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

/**
 * WatermelonDB Migrations
 *
 * CRITICAL: Every time you increment schema version in schema.ts,
 * add a migration step here. Without this file, WatermelonDB WIPES
 * the local SQLite DB on every version bump, losing all cached user data.
 *
 * Note: WatermelonDB v0.28 does NOT export removeColumns.
 * Use unsafeExecuteSql to drop columns when needed.
 *
 * Current schema version: 13
 */
export default schemaMigrations({
  migrations: [
    // v1 -> v2: Initial schema
    {
      toVersion: 2,
      steps: [
        createTable({
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
        createTable({
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
            { name: 'trip_types', type: 'string', isOptional: true },
            { name: 'transport_modes', type: 'string', isOptional: true },
            { name: 'cost_per_person', type: 'number', isOptional: true },
            { name: 'accommodation_type', type: 'string', isOptional: true },
            { name: 'booking_status', type: 'string', isOptional: true },
            { name: 'accommodation_days', type: 'number', isOptional: true },
            { name: 'places_to_visit', type: 'string', isOptional: true },
            { name: 'itinerary', type: 'string', isOptional: true },
            { name: 'participants', type: 'string', isOptional: true },
            { name: 'checklist', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'itinerary_map_view', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // v2 -> v3: direct_chats table
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'direct_chats',
          columns: [
            { name: 'participants', type: 'string' },
            { name: 'participant_details', type: 'string', isOptional: true },
            { name: 'last_message', type: 'string', isOptional: true },
            { name: 'last_message_at', type: 'number', isOptional: true },
            { name: 'unread_count', type: 'string', isOptional: true },
            { name: 'cleared_at', type: 'string', isOptional: true },
            { name: 'deleted_for', type: 'string', isOptional: true },
            { name: 'typing', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // v3 -> v4: group_chats table
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'group_chats',
          columns: [
            { name: 'group_name', type: 'string' },
            { name: 'group_description', type: 'string', isOptional: true },
            { name: 'group_icon', type: 'string', isOptional: true },
            { name: 'participants', type: 'string' },
            { name: 'participant_details', type: 'string', isOptional: true },
            { name: 'created_by', type: 'string', isOptional: true },
            { name: 'member_count', type: 'number', isOptional: true },
            { name: 'hidden', type: 'boolean' },
            { name: 'admins', type: 'string', isOptional: true },
            { name: 'last_message', type: 'string', isOptional: true },
            { name: 'unread_count', type: 'string', isOptional: true },
            { name: 'deleted_for', type: 'string', isOptional: true },
            { name: 'cleared_at', type: 'string', isOptional: true },
            { name: 'typing', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // v4 -> v5: messages table
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'messages',
          columns: [
            { name: 'chat_id', type: 'string', isIndexed: true },
            { name: 'chat_type', type: 'string' },
            { name: 'sender_id', type: 'string', isIndexed: true },
            { name: 'sender_name', type: 'string' },
            { name: 'text', type: 'string', isOptional: true },
            { name: 'type', type: 'string' },
            { name: 'media_url', type: 'string', isOptional: true },
            { name: 'location', type: 'string', isOptional: true },
            { name: 'reply_to', type: 'string', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'read_by', type: 'string', isOptional: true },
            { name: 'delivered_to', type: 'string', isOptional: true },
            { name: 'deleted_for', type: 'string', isOptional: true },
            { name: 'deleted_for_everyone_at', type: 'number', isOptional: true },
            { name: 'mentions', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // v5 -> v6: edited_at added to messages
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'messages',
          columns: [{ name: 'edited_at', type: 'number', isOptional: true }],
        }),
      ],
    },
    // v6 -> v12: Intermediate normalization (no new columns)
    { toVersion: 7, steps: [] },
    { toVersion: 8, steps: [] },
    { toVersion: 9, steps: [] },
    { toVersion: 10, steps: [] },
    { toVersion: 11, steps: [] },
    { toVersion: 12, steps: [] },
    // v12 -> v13: Remove ephemeral typing column from chats (via unsafeExecuteSql — SQLite 3.35+);
    //             Add muted_by + pinned_by to both chat tables.
    {
      toVersion: 13,
      steps: [
        // Drop deprecated columns (SQLite 3.35+; safely no-ops on older versions due to IF EXISTS)
        unsafeExecuteSql('ALTER TABLE direct_chats DROP COLUMN IF EXISTS typing;'),
        unsafeExecuteSql('ALTER TABLE group_chats DROP COLUMN IF EXISTS typing;'),
        // Add new columns
        addColumns({
          table: 'direct_chats',
          columns: [
            { name: 'muted_by', type: 'string', isOptional: true },
            { name: 'pinned_by', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'group_chats',
          columns: [
            { name: 'muted_by', type: 'string', isOptional: true },
            { name: 'pinned_by', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
