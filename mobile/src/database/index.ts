import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Trip from './models/Trip';
import Chat from './models/Chat';
import GroupChat from './models/GroupChat';
import Message from './models/Message';
import Profile from './models/Profile';

const adapter = new SQLiteAdapter({
  schema,
  // (Optional) Database name
  dbName: 'tripzi_offline',
  // (Recommended) If you want to use the high-performance JSI adapter on Android
  jsi: true,
  onSetUpError: error => {
    // Database failed to load
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Trip,
    Chat,
    GroupChat,
    Message,
    Profile,
  ],
});

/**
 * Selectively clears private data (chats, messages) on logout.
 * Keeps public trips and profiles to make account switching faster.
 */
export const resetDatabase = async () => {
    console.log('[Database] Clearing private data for logout...');
    try {
        await database.write(async () => {
            // Clear private tables
            const chats = await database.get('chats').query().fetch();
            const groupChats = await database.get('group_chats').query().fetch();
            const messages = await database.get('messages').query().fetch();
            
            // Delete all records permanently
            // Using batches for better performance
            await Promise.all(chats.map(chat => chat.destroyPermanently()));
            await Promise.all(groupChats.map(chat => chat.destroyPermanently()));
            await Promise.all(messages.map(message => message.destroyPermanently()));
            
            console.log(`[Database] Cleared ${chats.length} chats, ${groupChats.length} group chats, and ${messages.length} messages.`);
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
