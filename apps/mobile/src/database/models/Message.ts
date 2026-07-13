import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Message extends Model {
  static table = 'messages';
  static associations = {
    direct_chats: { type: 'belongs_to', key: 'chat_id' },
    group_chats: { type: 'belongs_to', key: 'chat_id' },
  } as const;

  @field('chat_id') chatId!: string;
  @field('chat_type') chatType!: string;
  @field('sender_id') senderId!: string;
  @field('sender_name') senderName!: string;
  @field('text') text?: string;
  @field('type') type!: string;
  @field('media_url') mediaUrl?: string;
  @field('location') locationRaw?: string; // JSON string
  @field('reply_to') replyToRaw?: string; // JSON string (ReplyTo object)
  @field('status') status!: string;
  @field('read_by') readByRaw?: string; // JSON string
  @field('delivered_to') deliveredToRaw?: string; // JSON string
  @field('deleted_for') deletedForRaw?: string; // JSON string
  @field('deleted_for_everyone_at') deletedForEveryoneAt?: number;
  @field('mentions') mentionsRaw?: string; // JSON string
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @field('edited_at') editedAt?: number;

  get locationData(): any {
    try {
      return this.locationRaw ? JSON.parse(this.locationRaw) : null;
    } catch {
      return null;
    }
  }

  get replyToData(): any {
    try {
      return this.replyToRaw ? JSON.parse(this.replyToRaw) : null;
    } catch {
      return null;
    }
  }

  get readByData(): any {
    try {
      return this.readByRaw ? JSON.parse(this.readByRaw) : {};
    } catch {
      return {};
    }
  }

  get deliveredToData(): string[] {
    try {
      return this.deliveredToRaw ? JSON.parse(this.deliveredToRaw) : [];
    } catch {
      return [];
    }
  }

  get deletedForData(): string[] {
    try {
      return this.deletedForRaw ? JSON.parse(this.deletedForRaw) : [];
    } catch {
      return [];
    }
  }

  get mentionsData(): string[] {
    try {
      return this.mentionsRaw ? JSON.parse(this.mentionsRaw) : [];
    } catch {
      return [];
    }
  }
}
