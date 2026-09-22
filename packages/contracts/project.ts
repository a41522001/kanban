/** 專案目前的生命週期狀態。 */
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

/** 專案成員在專案中的權限角色。 */
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/** 可以指派給一般成員的專案角色，不包含 OWNER。 */
export type AssignableProjectRole = Exclude<ProjectRole, 'OWNER'>;

/** 建立專案時送出的請求資料。 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  workspaceId: string;
}
/** 新增專案成員時送出的請求資料。 */
export interface AddProjectMemberRequest {
  projectId: string;
  workspaceMemberId: string;
  role: AssignableProjectRole;
}

/** 專案成員列表中的成員資料。 */
export interface ProjectMemberDto {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ProjectRole;
}
/** 專案列表中的專案摘要資料。 */
export interface ProjectListItemDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
}

/** 可被加入目前專案的 Workspace 成員候選資料。 */
export interface MemberCandidate {
  workspaceMemberId: string;
  displayName: string;
  avatarUrl: string | null;
  projectRole: ProjectRole | null;
}

/** 被加入專案後，點擊通知時使用的詳細資料。 */
export interface ProjectMemberAddedNotificationDetail {
  role: ProjectRole;
  projectName: string;
  projectId: string;
  workspaceName: string;
  workspaceId: string;
  inviterName: string | null;
  joinedAt: string;
}

/** 置頂/取消置頂 專案請求 */
export interface PinnedProjectRequest {
  pinned: boolean;
}
