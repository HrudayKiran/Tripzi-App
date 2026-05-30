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
        }

        // Clock drift mitigation: Subtract 10 seconds from lastPulledAt
        const lookbackMs = 10000;
        const adjustedLastPulledAt = actualLastPulledAt ? Math.max(0, actualLastPulledAt - lookbackMs) : null;
        const lastPulledAtDate = adjustedLastPulledAt ? new Date(adjustedLastPulledAt).toISOString() : null;

        if (adjustedLastPulledAt) {
            console.log(`[Sync] Adjusted pull timestamp with 10s lookback: ${lastPulledAtDate}`);
        }

        // 1. Pull Itineraries
        let itinerariesData: any[] = [];
        if (user) {
            const { data: iData, error: itinerariesError } = await supabase
                .from('itineraries')
                .select('*')
                .or(`user_id.eq.${user.id},participants.cs.{"${user.id}"}`)
                .gt('updated_at', lastPulledAtDate || '1970-01-01');
            
            if (itinerariesError) {
                console.error('[Sync] Error pulling itineraries:', itinerariesError);
            } else {
                itinerariesData = iData || [];
                console.log(`[Sync] Pulled ${itinerariesData.length} itineraries.`);
            }
        }

        // 2. Pull Profiles
        let profilesData: any[] = [];

        // 2a. ALWAYS pull the current user's own profile from `profiles` table
        if (user) {
            const { data: ownProfile, error: ownProfileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (ownProfileError) {
                console.error('[Sync] Error pulling own profile:', ownProfileError);
            } else if (ownProfile) {
                profilesData.push(ownProfile);
                console.log('[Sync] Pulled current user\'s own profile.');
            }
        }

        // 2b. Pull public profiles for itinerary collaborators
        if (itinerariesData && itinerariesData.length > 0) {
            const uniqueUserIds = [...new Set(itinerariesData.flatMap(t => {
                try {
                  const arr = Array.isArray(t.participants) ? t.participants : JSON.parse(t.participants || '[]');
                  return [t.user_id, ...arr];
                } catch {
                  return [t.user_id];
                }
            }))].filter(uid => uid !== user?.id);
            
            if (uniqueUserIds.length > 0) {
                console.log(`[Sync] Fetching profiles for ${uniqueUserIds.length} unique collaborators...`);
                
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
        }
        console.log(`[Sync] Pulled ${profilesData.length} total profiles.`);

        // 3. Pull Chats & Messages (Conditional on Auth)
        let chatsData: any[] = [];
        let groupChatsData: any[] = [];
        let messagesData: any[] = [];

        if (user) {
            console.log(`[Sync] User authenticated (${user.id}), pulling private data...`);
            
            // Pull direct chats
            const { data: cData, error: chatsError } = await supabase.from('direct_chats')
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
        }

        // Mapping functions
        const mapItinerary = (t: any) => ({
          id: t.id,
          user_id: t.user_id,
          title: t.title,
          description: t.description,
          location: t.location,
          from_location: t.from_location,
          to_location: t.to_location,
          from_date: t.from_date,
          to_date: t.to_date,
          duration_days: t.duration_days,
          travel_style: t.travel_style,
          trip_types: Array.isArray(t.trip_types) ? JSON.stringify(t.trip_types) : (t.trip_types || null),
          transport_modes: Array.isArray(t.transport_modes) ? JSON.stringify(t.transport_modes) : (t.transport_modes || null),
          cost_per_person: t.cost_per_person,
          accommodation_type: t.accommodation_type,
          booking_status: t.booking_status,
          accommodation_days: t.accommodation_days,
          places_to_visit: Array.isArray(t.places_to_visit) ? JSON.stringify(t.places_to_visit) : (t.places_to_visit || null),
          itinerary: Array.isArray(t.itinerary) ? JSON.stringify(t.itinerary) : (t.itinerary || null),
          cover_image: t.cover_image,
          images: Array.isArray(t.images) ? JSON.stringify(t.images) : (t.images || null),
          participants: Array.isArray(t.participants) ? JSON.stringify(t.participants) : (t.participants || null),
          checklist: Array.isArray(t.checklist) ? JSON.stringify(t.checklist) : (t.checklist || null),
          notes: Array.isArray(t.notes) ? JSON.stringify(t.notes) : (t.notes || null),
          itinerary_map_view: t.itinerary_map_view ? (typeof t.itinerary_map_view === 'string' ? t.itinerary_map_view : JSON.stringify(t.itinerary_map_view)) : null,
          created_at: new Date(t.created_at).getTime(),
          updated_at: new Date(t.updated_at).getTime(),
        });

        const mapProfile = (p: any) => ({
          id: p.id,
          name: p.name || p.display_name || 'Traveler',
          username: p.username,
          photo_url: p.photo_url,
          bio: p.bio,
          push_notifications_enabled: p.push_notifications_enabled ?? false,
          save_to_gallery: p.save_to_gallery ?? false,
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
          itinerary_id: c.itinerary_id,
          group_name: c.group_name,
          group_description: c.group_description,
          group_icon: c.group_icon,
          itinerary_image: c.itinerary_image,
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

        // Map all records and deduplicate by ID to prevent SQLite UNIQUE constraint crashes
        const uniqById = (arr: any[]) => {
          const seen = new Set();
          return arr.filter(x => {
            if (!x.id || seen.has(x.id)) return false;
            seen.add(x.id);
            return true;
          });
        };

        const mappedItineraries = (itinerariesData || []).map(mapItinerary);
        const mappedProfiles = uniqById((profilesData || []).map(mapProfile));
        const mappedChats = uniqById((chatsData || []).map(mapChat));
        const mappedGroupChats = uniqById((groupChatsData || []).map(mapGroupChat));
        const mappedMessages = uniqById(messagesData.map(mapMessage));

        // Split into created vs updated based on local existence
        const itinerariesChanges = await splitCreatedUpdated('itineraries', mappedItineraries);
        const profilesChanges = await splitCreatedUpdated('profiles', mappedProfiles);
        const chatsChanges = await splitCreatedUpdated('direct_chats', mappedChats);
        const groupChatsChanges = await splitCreatedUpdated('group_chats', mappedGroupChats);
        const messagesChanges = await splitCreatedUpdated('messages', mappedMessages);

        return {
          changes: {
            itineraries: { ...itinerariesChanges, deleted: [] },
            profiles: { ...profilesChanges, deleted: [] },
            direct_chats: { ...chatsChanges, deleted: [] },
            group_chats: { ...groupChatsChanges, deleted: [] },
            messages: { ...messagesChanges, deleted: [] },
          },
          timestamp: Date.now(),
        };
      },
      pushChanges: async ({ changes }: { changes: any }) => {
        const prepareForSupabase = (record: any) => {
          const result = { ...record };
          delete result._status;
          delete result._changed;
          
          // List of fields that are arrays in Supabase but strings in WatermelonDB
          const arrayFields = [
              'places_to_visit', 'itinerary', 'images', 
              'participants', 'trip_types', 'transport_modes', 'read_by', 'delivered_to', 
              'deleted_for', 'mentions', 'checklist', 'notes'
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

          // Handle date fields (convert ms timestamp to ISO string)
          const dateFields = ['created_at', 'updated_at', 'edited_at'];
          dateFields.forEach(field => {
            if (typeof result[field] === 'number') {
              result[field] = new Date(result[field]).toISOString();
            }
          });

          // Handle specific object fields
          if (typeof result.itinerary_map_view === 'string') {
              try { result.itinerary_map_view = JSON.parse(result.itinerary_map_view); } catch(e) {}
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

        // Push Itineraries
        if (changes.itineraries) {
          const { created, updated } = changes.itineraries;
          if (created.length > 0) {
            console.log(`[Sync] Pushing ${created.length} new itineraries...`);
            const { error } = await supabase.from('itineraries').insert(created.map(prepareForSupabase));
            if (error) console.error('[Sync] Error pushing new itineraries:', error);
          }
          if (updated.length > 0) {
            console.log(`[Sync] Pushing ${updated.length} updated itineraries...`);
            for (const record of updated) {
              const { error } = await supabase.from('itineraries').update(prepareForSupabase(record)).eq('id', record.id);
              if (error) console.error(`[Sync] Error updating itinerary ${record.id}:`, error);
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

/**
 * Lightweight helper that syncs only the current user's profile.
 * Call this after profile edits, settings changes, etc.
 * Much faster than a full syncDatabase() call.
 */
export async function syncCurrentUserProfile(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) return;

    const mapped = {
      id: profile.id,
      name: profile.name || profile.display_name || 'Traveler',
      username: profile.username,
      photo_url: profile.photo_url,
      bio: profile.bio,
      push_notifications_enabled: profile.push_notifications_enabled ?? false,
      save_to_gallery: profile.save_to_gallery ?? false,
      created_at: new Date(profile.created_at).getTime(),
      updated_at: new Date(profile.updated_at).getTime(),
    };

    const { created, updated } = await splitCreatedUpdated('profiles', [mapped]);

    await database.write(async () => {
      const collection = database.get('profiles');
      const batch: any[] = [];

      for (const record of created) {
        batch.push(
          collection.prepareCreate((rec: any) => {
            rec._raw.id = record.id;
            Object.keys(record).forEach(key => {
              if (key !== 'id') rec._raw[key] = record[key];
            });
          })
        );
      }

      for (const record of updated) {
        const existing = await collection.find(record.id);
        batch.push(
          existing.prepareUpdate((rec: any) => {
            Object.keys(record).forEach(key => {
              if (key !== 'id') rec._raw[key] = record[key];
            });
          })
        );
      }

      await database.batch(...batch);
    });

    console.log('[Sync] Current user profile synced locally.');
  } catch (error) {
    console.error('[Sync] Failed to sync current user profile:', error);
  }
}
