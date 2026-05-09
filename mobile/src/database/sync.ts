import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { supabase } from '../lib/supabase';
import { Q } from '@nozbe/watermelondb';

// Mutex to prevent concurrent synchronization
let isSyncing = false;

/**
 * Splits an array of mapped records into { created, updated } based on
 * which IDs already exist in the local WatermelonDB table.
 */
async function splitCreatedUpdated(tableName: string, records: any[]) {
  if (records.length === 0) return { created: [], updated: [] };

  const ids = records.map(r => r.id);
  const existing = await database.get(tableName)
    .query(Q.where('id', Q.oneOf(ids)))
    .fetch();
  const existingIds = new Set(existing.map(r => r.id));

  const created: any[] = [];
  const updated: any[] = [];

  for (const record of records) {
    if (existingIds.has(record.id)) {
      updated.push(record);
    } else {
      created.push(record);
    }
  }

  return { created, updated };
}

export async function syncDatabase() {
  // Guard against concurrent sync calls
  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        const lastPulledAtDate = lastPulledAt ? new Date(lastPulledAt).toISOString() : null;

        // 1. Pull Trips
        const { data: tripsData } = await supabase.from('trips').select('*').gt('updated_at', lastPulledAtDate || '1970-01-01');

        // 2. Pull Profiles (Public)
        const { data: profilesData } = await supabase.from('public_profiles').select('*').gt('updated_at', lastPulledAtDate || '1970-01-01');

        // 3. Pull Chats
        const { data: { user } } = await supabase.auth.getUser();
        const { data: chatsData } = await supabase.from('chats')
          .select('*')
          .contains('participants', [user?.id])
          .gt('updated_at', lastPulledAtDate || '1970-01-01');

        // 4. Pull Messages (for synced chats)
        const chatIds = chatsData?.map(c => c.id) || [];
        let messagesData: any[] = [];
        if (chatIds.length > 0) {
          const { data } = await supabase.from('messages')
            .select('*')
            .in('chat_id', chatIds)
            .gt('updated_at', lastPulledAtDate || '1970-01-01');
          messagesData = data || [];
        }

        // Mapping functions
        const mapTrip = (t: any) => ({
          id: t.id,
          user_id: t.user_id,
          title: t.title,
          description: t.description,
          location: t.location,
          from_date: t.from_date,
          to_date: t.to_date,
          max_travelers: t.max_travelers,
          current_travelers: t.current_travelers,
          gender_preference: t.gender_preference,
          status: t.status,
          trip_type: t.trip_type,
          transport_mode: t.transport_mode,
          accommodation_type: t.accommodation_type,
          duration_days: t.duration_days,
          booking_status: t.booking_status,
          places_to_visit: t.places_to_visit ? JSON.stringify(t.places_to_visit) : null,
          mandatory_items: t.mandatory_items ? JSON.stringify(t.mandatory_items) : null,
          is_expired: t.is_expired,
          is_cancelled: t.is_cancelled,
          is_completed: t.is_completed,
          owner_display_name: t.owner_display_name,
          owner_photo_url: t.owner_photo_url,
          owner_username: t.owner_username,
          cost: t.cost,
          total_cost: t.total_cost,
          cost_per_person: t.cost_per_person,
          accommodation_days: t.accommodation_days,
          maps_link: t.maps_link,
          duration: t.duration,
          trip_types: t.trip_types ? JSON.stringify(t.trip_types) : null,
          transport_modes: t.transport_modes ? JSON.stringify(t.transport_modes) : null,
          image_locations: t.image_locations ? JSON.stringify(t.image_locations) : null,
          cover_image: t.cover_image,
          images: t.images ? JSON.stringify(t.images) : null,
          participants: t.participants ? JSON.stringify(t.participants) : null,
          created_at: new Date(t.created_at).getTime(),
          updated_at: new Date(t.updated_at).getTime(),
        });

        const mapProfile = (p: any) => ({
          id: p.id,
          name: p.display_name,
          username: p.username,
          photo_url: p.photo_url,
          bio: p.bio,
          push_notifications_enabled: p.push_notifications_enabled,
          save_to_gallery: p.save_to_gallery,
          created_at: new Date(p.created_at).getTime(),
          updated_at: new Date(p.updated_at).getTime(),
        });

        const mapChat = (c: any) => ({
          id: c.id,
          participants: JSON.stringify(c.participants),
          last_message: c.last_message ? JSON.stringify(c.last_message) : null,
          unread_count: c.unread_count ? JSON.stringify(c.unread_count) : null,
          created_at: new Date(c.created_at).getTime(),
          updated_at: new Date(c.updated_at).getTime(),
        });

        const mapMessage = (m: any) => ({
          id: m.id,
          chat_id: m.chat_id,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          type: m.type,
          text: m.text,
          media_url: m.media_url,
          media_thumbnail: m.media_thumbnail,
          location: m.location ? JSON.stringify(m.location) : null,
          voice_duration: m.voice_duration,
          reply_to: m.reply_to ? JSON.stringify(m.reply_to) : null,
          status: m.status,
          read_by: m.read_by ? JSON.stringify(m.read_by) : null,
          delivered_to: m.delivered_to ? JSON.stringify(m.delivered_to) : null,
          edited_at: m.edited_at ? new Date(m.edited_at).getTime() : null,
          deleted_for: m.deleted_for ? JSON.stringify(m.deleted_for) : null,
          deleted_for_everyone_at: m.deleted_for_everyone_at ? new Date(m.deleted_for_everyone_at).getTime() : null,
          mentions: m.mentions ? JSON.stringify(m.mentions) : null,
          created_at: new Date(m.created_at).getTime(),
          updated_at: new Date(m.updated_at).getTime(),
        });

        // Map all records
        const mappedTrips = (tripsData || []).map(mapTrip);
        const mappedProfiles = (profilesData || []).map(mapProfile);
        const mappedChats = (chatsData || []).map(mapChat);
        const mappedMessages = messagesData.map(mapMessage);

        // Split into created vs updated based on local existence
        const tripsChanges = await splitCreatedUpdated('trips', mappedTrips);
        const profilesChanges = await splitCreatedUpdated('profiles', mappedProfiles);
        const chatsChanges = await splitCreatedUpdated('chats', mappedChats);
        const messagesChanges = await splitCreatedUpdated('messages', mappedMessages);

        return {
          changes: {
            trips: { ...tripsChanges, deleted: [] },
            profiles: { ...profilesChanges, deleted: [] },
            chats: { ...chatsChanges, deleted: [] },
            messages: { ...messagesChanges, deleted: [] },
          },
          timestamp: Date.now(),
        };
      },
      pushChanges: async ({ changes }: { changes: any }) => {
        // Push Trips
        if (changes.trips) {
          const { created, updated } = changes.trips;
          if (created.length > 0) await supabase.from('trips').insert(created.map((t: any) => ({ ...t, _status: undefined, _changed: undefined })));
          if (updated.length > 0) {
            for (const t of updated) await supabase.from('trips').update({ ...t, _status: undefined, _changed: undefined }).eq('id', t.id);
          }
        }

        // Push Messages
        if (changes.messages) {
          const { created } = changes.messages;
          if (created.length > 0) {
            await supabase.from('messages').insert(created.map((m: any) => ({
              ...m,
              _status: undefined,
              _changed: undefined,
              location: m.location ? JSON.parse(m.location) : null,
              reply_to: m.reply_to ? JSON.parse(m.reply_to) : null,
              read_by: m.read_by ? JSON.parse(m.read_by) : {},
              delivered_to: m.delivered_to ? JSON.parse(m.delivered_to) : [],
              deleted_for: m.deleted_for ? JSON.parse(m.deleted_for) : [],
              mentions: m.mentions ? JSON.parse(m.mentions) : [],
            })));
          }
        }
      },
    });
    // Sync completed successfully
  } catch (error: any) {
    // Don't re-throw concurrent sync errors — they're expected and harmless
    if (error?.message?.includes('Concurrent synchronization')) {
      // Concurrent sync detected, skipping
    } else {
      // Sync error
    }
  } finally {
    isSyncing = false;
  }
}
