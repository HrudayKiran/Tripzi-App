import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Itinerary from './models/Itinerary';
import Chat from './models/Chat';
import GroupChat from './models/GroupChat';
import Message from './models/Message';
import Profile from './models/Profile';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';

// Pure JS implementation of UUID v4 to avoid adding dependencies
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

setGenerator(uuidv4);

const adapter = new SQLiteAdapter({
  schema,
  // (Optional) Database name - versioned to trigger automatic recreation on schema bumps
  dbName: `nxtvibes_offline_v${schema.version}`,
  // (Recommended) If you want to use the high-performance JSI adapter on Android
  jsi: true,
  onSetUpError: error => {
    // Database failed to load
    console.error('[Database] Adapter setup error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Itinerary,
    Chat,
    GroupChat,
    Message,
    Profile,
  ],
});

/**
 * Selectively clears private data (chats, messages) on logout.
 * Keeps public trips and profiles to make account switching faster.
 * Uses batch API for O(1) SQL operations instead of O(n).
 */
export const resetDatabase = async () => {
    if (__DEV__) console.log('[Database] Clearing private data for logout...');
    try {
        await database.write(async () => {
            // Fetch all private records
            const chats = await database.get('direct_chats').query().fetch();
            const groupChats = await database.get('group_chats').query().fetch();
            const messages = await database.get('messages').query().fetch();
            
            // Use batch API for a single SQL transaction instead of N separate ones
            const batch = [
                ...chats.map(chat => chat.prepareDestroyPermanently()),
                ...groupChats.map(chat => chat.prepareDestroyPermanently()),
                ...messages.map(message => message.prepareDestroyPermanently()),
            ];
            
            if (batch.length > 0) {
                await database.batch(...batch);
            }
            
            if (__DEV__) console.log(`[Database] Cleared ${chats.length} chats, ${groupChats.length} group chats, and ${messages.length} messages.`);
        });
    } catch (error) {
        console.error('[Database] Failed to clear private data:', error);
        // Fallback to full reset if selective clear fails
        try {
            await database.write(async () => {
                await database.unsafeResetDatabase();
            });
        } catch (e) {}
    }
};
