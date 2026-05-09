import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Trip from './models/Trip';
import Chat from './models/Chat';
import Message from './models/Message';
import Profile from './models/Profile';

const adapter = new SQLiteAdapter({
  schema,
  // (Optional) Database name
  dbName: 'tripzi_offline',
  // (Recommended) If you want to use the high-performance JSI adapter on Android
  jsi: true,
  onSetUpError: error => {
    // Database failed to load -- perform the default error handling or alerting.
    console.error('WatermelonDB setup error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Trip,
    Chat,
    Message,
    Profile,
  ],
});
