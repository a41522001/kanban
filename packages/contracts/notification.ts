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
