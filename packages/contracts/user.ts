/** 對外公開的使用者基本資料，不包含敏感資訊。 */
export interface PublicUser {
  email: string;
  displayName: string;
  avatarUrl: string | null;
}
