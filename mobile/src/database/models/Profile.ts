import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Profile extends Model {
  static table = 'profiles';

  @field('name') name!: string;
  @field('username') username?: string;
  @field('photo_url') photoUrl?: string;
  @field('bio') bio?: string;
  @field('push_notifications_enabled') pushNotificationsEnabled!: boolean;
  @field('save_to_gallery') saveToGallery!: boolean;
  
  @readonly @date('updated_at') updatedAt!: Date;
}
