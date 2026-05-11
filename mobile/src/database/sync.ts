import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { supabase } from '../lib/supabase';
import { Q } from '@nozbe/watermelondb';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const LAST_SYNC_USER_KEY = 'last_sync_user_id';

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
    console.log('[Sync] Synchronization already in progress, skipping.');
    return;
  }

  isSyncing = true;
  console.log('[Sync] Starting synchronization...');

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        // User switching detection: If the current user is different from the last sync user,
        // we should ignore lastPulledAt to ensure a full pull of the new user's data.
        const lastSyncUserId = storage.getString(LAST_SYNC_USER_KEY);
        const { data: { user } } = await supabase.auth.getUser();
        
        let actualLastPulledAt = lastPulledAt;
        if (user && user.id !== lastSyncUserId) {
            console.log(`[Sync] User switched from ${lastSyncUserId} to ${user.id}. Forcing full pull.`);
            actualLastPulledAt = null;
            // Clear local private tables (optional but recommended for security)
            // Note: We don't clear public trips/profiles here as they are shared.
        }

        // Clock drift mitigation: Subtract 10 seconds from lastPulledAt
        const lookbackMs = 10000;
        const adjustedLastPulledAt = actualLastPulledAt ? Math.max(0, actualLastPulledAt - lookbackMs) : null;
        const lastPulledAtDate = adjustedLastPulledAt ? new Date(adjustedLastPulledAt).toISOString() : null;

        if (adjustedLastPulledAt) {
            console.log(`[Sync] Adjusted pull timestamp with 10s lookback: ${lastPulledAtDate}`);
        }

        // 1. Pull Trips
        // Optimization: For a full pull, only fetch trips from the last 90 days to keep it fast.
        let tripQuery = supabase.from('trips').select('*');
        if (lastPulledAtDate) {
            tripQuery = tripQuery.gt('updated_at', lastPulledAtDate);
        } else {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            tripQuery = tripQuery.gt('created_at', ninetyDaysAgo.toISOString());
            console.log(`[Sync] Full pull detected. Limiting trips to last 90 days (since ${ninetyDaysAgo.toISOString()})`);
        }

        const { data: tripsData, error: tripsError } = await tripQuery;
        if (tripsError) {
            console.error('[Sync] Error pulling trips:', tripsError);
            throw tripsError;
        }
        console.log(`[Sync] Pulled ${tripsData?.length || 0} trips.`);

        // 2. Pull Profiles (Public)
        // Optimization: Only pull profiles for users who actually have trips. 
        // This avoids pulling thousands of "empty" user profiles.
        let profilesData: any[] = [];
        if (tripsData && tripsData.length > 0) {
            const uniqueUserIds = [...new Set(tripsData.map(t => t.user_id))];
            console.log(`[Sync] Fetching profiles for ${uniqueUserIds.length} unique users...`);
            
            // We fetch in chunks of 50 to avoid URL length issues or Supabase limits
            for (let i = 0; i < uniqueUserIds.length; i += 50) {
                const chunk = uniqueUserIds.slice(i, i + 50);
                const { data: pData, error: profilesError } = await supabase
                    .from('public_profiles')
                    .select('*')
                    .in('id', chunk);
                
                if (profilesError) {
                    console.error('[Sync] Error pulling profiles chunk:', profilesError);
                } else if (pData) {
                    profilesData = [...profilesData, ...pData];
                }
            }
        }
        console.log(`[Sync] Pulled ${profilesData.length} relevant profiles.`);

        // 3. Pull Chats & Messages (Conditional on Auth)
        // Reuse the 'user' variable fetched at the start of pullChanges
        let chatsData: any[] = [];
        let groupChatsData: any[] = [];
        let messagesData: any[] = [];

        if (user) {
            console.log(`[Sync] User authenticated (${user.id}), pulling private data...`);
            
            // Pull direct chats
            const { data: cData, error: chatsError } = await supabase.from('chats')
              .select('*')
              .contains('participants', [user.id])
              .gt('updated_at', lastPulledAtDate || '1970-01-01');
            
            if (chatsError) {
                console.error('[Sync] Error pulling chats:', chatsError);
            } else {
                chatsData = cData || [];
                console.log(`[Sync] Pulled ${chatsData.length} direct chats.`);
            }

            // Pull group chats
            const { data: gcData, error: groupChatsError } = await supabase.from('group_chats')
              .select('*')
              .contains('participants', [user.id])
              .gt('updated_at', lastPulledAtDate || '1970-01-01');
            
            if (groupChatsError) {
                console.error('[Sync] Error pulling group chats:', groupChatsError);
            } else {
                groupChatsData = gcData || [];
                console.log(`[Sync] Pulled ${groupChatsData.length} group chats.`);
            }

            const allChatIds = [...chatsData.map(c => c.id), ...groupChatsData.map(c => c.id)];
            
            if (allChatIds.length > 0) {
              const { data: mData, error: messagesError } = await supabase.from('messages')
                .select('*')
                .in('chat_id', allChatIds)
                .gt('updated_at', lastPulledAtDate || '1970-01-01');
              
              if (messagesError) {
                  console.error('[Sync] Error pulling messages:', messagesError);
              } else {
                  messagesData = mData || [];
                  console.log(`[Sync] Pulled ${messagesData.length} messages.`);
              }
            }
        } else {
            console.log('[Sync] No authenticated user session. Skipping private data pull.');
        }

        // Mapping functions
        const mapTrip = (t: any) => ({
          id: t.id,
          user_id: t.user_id,
          title: t.title,
          description: t.description,
          location: t.location,
          from_location: t.from_location,
          to_location: t.to_location,
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
          places_to_visit: Array.isArray(t.places_to_visit) ? JSON.stringify(t.places_to_visit) : (t.places_to_visit || null),
          mandatory_items: Array.isArray(t.mandatory_items) ? JSON.stringify(t.mandatory_items) : (t.mandatory_items || null),
          itinerary: Array.isArray(t.itinerary) ? JSON.stringify(t.itinerary) : (t.itinerary || null),
          image_object_keys: Array.isArray(t.image_object_keys) ? JSON.stringify(t.image_object_keys) : (t.image_object_keys || null),
          cancel_reason: t.cancel_reason,
          cancelled_at: t.cancelled_at ? new Date(t.cancelled_at).getTime() : null,
          completed_at: t.completed_at ? new Date(t.completed_at).getTime() : null,
          delete_reason: t.delete_reason,
          deleted_at: t.deleted_at ? new Date(t.deleted_at).getTime() : null,
          last_leave_reason: t.last_leave_reason,
          owner_profile_updated_at: t.owner_profile_updated_at ? new Date(t.owner_profile_updated_at).getTime() : null,
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
          trip_types: Array.isArray(t.trip_types) ? JSON.stringify(t.trip_types) : (t.trip_types || null),
          transport_modes: Array.isArray(t.transport_modes) ? JSON.stringify(t.transport_modes) : (t.transport_modes || null),
          image_locations: Array.isArray(t.image_locations) ? JSON.stringify(t.image_locations) : (t.image_locations || null),
          cover_image: t.cover_image,
          images: Array.isArray(t.images) ? JSON.stringify(t.images) : (t.images || null),
          participants: Array.isArray(t.participants) ? JSON.stringify(t.participants) : (t.participants || null),
          created_at: new Date(t.created_at).getTime(),
          updated_at: new Date(t.updated_at).getTime(),
        });

        const mapProfile = (p: any) => ({
          id: p.id,
          name: p.display_name || p.name || 'Traveler',
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
          participants: Array.isArray(c.participants) ? JSON.stringify(c.participants) : (c.participants || null),
          last_message: c.last_message ? JSON.stringify(c.last_message) : null,
          unread_count: c.unread_count ? JSON.stringify(c.unread_count) : null,
          created_at: new Date(c.created_at).getTime(),
          updated_at: new Date(c.updated_at).getTime(),
        });

        const mapGroupChat = (c: any) => ({
          id: c.id,
          trip_id: c.trip_id,
          group_name: c.group_name,
          group_description: c.group_description,
          group_icon: c.group_icon,
          trip_image: c.trip_image,
          participants: Array.isArray(c.participants) ? JSON.stringify(c.participants) : (c.participants || null),
          participant_details: c.participant_details ? JSON.stringify(c.participant_details) : null,
          created_by: c.created_by,
          member_count: c.member_count,
          hidden: c.hidden,
          admins: Array.isArray(c.admins) ? JSON.stringify(c.admins) : (c.admins || null),
          last_message: c.last_message ? JSON.stringify(c.last_message) : null,
          unread_count: c.unread_count ? JSON.stringify(c.unread_count) : null,
          created_at: new Date(c.created_at).getTime(),
          updated_at: new Date(c.updated_at).getTime(),
        });

        const mapMessage = (m: any) => ({
          id: m.id,
          chat_id: m.chat_id,
          chat_type: m.chat_type,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          type: m.type,
          text: m.text,
          media_url: m.media_url,
          location: m.location ? (typeof m.location === 'string' ? m.location : JSON.stringify(m.location)) : null,
          voice_duration: m.voice_duration,
          reply_to: m.reply_to ? (typeof m.reply_to === 'string' ? m.reply_to : JSON.stringify(m.reply_to)) : null,
          status: m.status,
          read_by: m.read_by ? (typeof m.read_by === 'string' ? m.read_by : JSON.stringify(m.read_by)) : null,
          delivered_to: m.delivered_to ? (typeof m.delivered_to === 'string' ? m.delivered_to : JSON.stringify(m.delivered_to)) : null,
          edited_at: m.edited_at ? new Date(m.edited_at).getTime() : null,
          deleted_for: m.deleted_for ? (typeof m.deleted_for === 'string' ? m.deleted_for : JSON.stringify(m.deleted_for)) : null,
          deleted_for_everyone_at: m.deleted_for_everyone_at ? new Date(m.deleted_for_everyone_at).getTime() : null,
          mentions: m.mentions ? (typeof m.mentions === 'string' ? m.mentions : JSON.stringify(m.mentions)) : null,
          created_at: new Date(m.created_at).getTime(),
          updated_at: new Date(m.updated_at).getTime(),
        });

        // Map all records
        const mappedTrips = (tripsData || []).map(mapTrip);
        const mappedProfiles = (profilesData || []).map(mapProfile);
        const mappedChats = (chatsData || []).map(mapChat);
        const mappedGroupChats = (groupChatsData || []).map(mapGroupChat);
        const mappedMessages = messagesData.map(mapMessage);

        // Split into created vs updated based on local existence
        const tripsChanges = await splitCreatedUpdated('trips', mappedTrips);
        const profilesChanges = await splitCreatedUpdated('profiles', mappedProfiles);
        const chatsChanges = await splitCreatedUpdated('chats', mappedChats);
        const groupChatsChanges = await splitCreatedUpdated('group_chats', mappedGroupChats);
        const messagesChanges = await splitCreatedUpdated('messages', mappedMessages);

        return {
          changes: {
            trips: { ...tripsChanges, deleted: [] },
            profiles: { ...profilesChanges, deleted: [] },
            chats: { ...chatsChanges, deleted: [] },
            group_chats: { ...groupChatsChanges, deleted: [] },
            messages: { ...messagesChanges, deleted: [] },
          },
          timestamp: Date.now(),
        };
      },
      pushChanges: async ({ changes }: { changes: any }) => {
        const prepareForSupabase = (record: any) => {
          const result = { ...record, _status: undefined, _changed: undefined };
          
          // List of fields that are arrays in Supabase but strings in WatermelonDB
          const arrayFields = [
              'places_to_visit', 'mandatory_items', 'itinerary', 'images', 
              'image_object_keys', 'participants', 'image_locations', 
              'trip_types', 'transport_modes', 'read_by', 'delivered_to', 
              'deleted_for', 'mentions'
          ];
          
          arrayFields.forEach(field => {
            if (typeof result[field] === 'string') {
              try {
                result[field] = JSON.parse(result[field]);
              } catch (e) {
                // Not a JSON string or parse failed, keep as is
              }
            }
          });

          // Handle specific object fields
          if (typeof result.location === 'string') {
              try { result.location = JSON.parse(result.location); } catch(e) {}
          }
          if (typeof result.reply_to === 'string') {
              try { result.reply_to = JSON.parse(result.reply_to); } catch(e) {}
          }
          if (typeof result.last_message === 'string') {
              try { result.last_message = JSON.parse(result.last_message); } catch(e) {}
          }
          if (typeof result.unread_count === 'string') {
              try { result.unread_count = JSON.parse(result.unread_count); } catch(e) {}
          }

          return result;
        };

        // Push Trips
        if (changes.trips) {
          const { created, updated } = changes.trips;
          if (created.length > 0) {
              console.log(`[Sync] Pushing ${created.length} new trips...`);
              const { error } = await supabase.from('trips').insert(created.map(prepareForSupabase));
              if (error) console.error('[Sync] Error pushing new trips:', error);
          }
          if (updated.length > 0) {
            console.log(`[Sync] Pushing ${updated.length} trip updates...`);
            for (const t of updated) {
                const { error } = await supabase.from('trips').update(prepareForSupabase(t)).eq('id', t.id);
                if (error) console.error(`[Sync] Error updating trip ${t.id}:`, error);
            }
          }
        }

        // Push Messages
        if (changes.messages) {
          const { created } = changes.messages;
          if (created.length > 0) {
            console.log(`[Sync] Pushing ${created.length} new messages...`);
            const { error } = await supabase.from('messages').insert(created.map(prepareForSupabase));
            if (error) console.error('[Sync] Error pushing new messages:', error);
          }
        }
      },
    });

    // Update last sync user on success
    const { data: { user: finalUser } } = await supabase.auth.getUser();
    if (finalUser) {
      storage.set(LAST_SYNC_USER_KEY, finalUser.id);
    }
    console.log('[Sync] Synchronization completed successfully.');
  } catch (error: any) {
    // Don't re-throw concurrent sync errors — they're expected and harmless
    if (error?.message?.includes('Concurrent synchronization')) {
      console.log('[Sync] Concurrent synchronization detected, skipping.');
    } else {
      console.error('[Sync] Synchronization failed:', error);
    }
  } finally {
    isSyncing = false;
  }
}

