import { Model } from '@nozbe/watermelondb';
import { field, date, children, readonly } from '@nozbe/watermelondb/decorators';

export default class Chat extends Model {
  static table = 'direct_chats';
  static associations = {
    messages: { type: 'has_many', foreignKey: 'chat_id' },
  } as const;

  @field('participants') participantsRaw!: string; // JSON string
  @field('participant_details') participantDetailsRaw?: string; // JSON string
  @field('last_message') lastMessage?: string;
  @field('last_message_at') lastMessageAt?: number;
  @field('unread_count') unreadCountRaw?: string; // JSON string
  @field('cleared_at') clearedAtRaw?: string; // JSON string
  @field('deleted_for') deletedForRaw?: string; // JSON string
  @field('typing') typingRaw?: string; // JSON string

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('messages') messages!: any;

  get participants(): string[] {
    try {
      return this.participantsRaw ? JSON.parse(this.participantsRaw) : [];
    } catch {
      return [];
    }
  }

  get unreadCount(): Record<string, number> {
    try {
      return this.unreadCountRaw ? JSON.parse(this.unreadCountRaw) : {};
    } catch {
      return {};
    }
  }
}
