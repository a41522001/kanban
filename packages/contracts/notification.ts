/** 系統支援的通知事件類型。 */
export type NotificationType =
  /// 使用者收到工作區邀請。
  | 'WORKSPACE_INVITED'
  /// 有使用者加入工作區。
  | 'WORKSPACE_MEMBER_JOINED'
  /// 使用者被加入 Project。
  | 'PROJECT_MEMBER_ADDED'
  /// 卡片被指派給使用者。
  | 'CARD_ASSIGNED'
  /// 使用者在卡片或其留言中被提及。
  | 'CARD_MENTIONED'
  /// 排程到期後建立的卡片提醒。
  | 'CARD_REMINDER';

/** 通知可以導向的 domain resource 類型。 */
export type NotificationResourceType =
  /// 指向尚待接受、拒絕或過期的工作區邀請。
  | 'WORKSPACE_INVITATION'
  /// 指向工作區本身。
  | 'WORKSPACE'
  /// 指向 Project。
  | 'PROJECT'
  /// 指向 Board。
  | 'BOARD'
  /// 指向 Card。
  | 'CARD';

/** 每一種通知允許導向的 domain resource。 */
export interface NotificationResourceTypeByNotification {
  WORKSPACE_INVITED: 'WORKSPACE_INVITATION';
  WORKSPACE_MEMBER_JOINED: 'WORKSPACE';
  PROJECT_MEMBER_ADDED: 'PROJECT';
  CARD_ASSIGNED: 'CARD';
  CARD_MENTIONED: 'CARD';
  CARD_REMINDER: 'CARD';
}

/** 收件者通知列表的分頁回應。 */
export interface FindByRecipientResponse {
  items: PublicNotification[];
  nextCursor: string | null;
}

/** 通知列表中對外公開的摘要資料。 */
export interface PublicNotification {
  id: string;
  resourceType: NotificationResourceType;
  resourceId: string | null;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  type: NotificationType;
}

/** 標記單一通知為已讀時的請求資料。 */
export interface MarkReadRequest {
  notificationId: string;
}
