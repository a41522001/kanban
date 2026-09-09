import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { UserService } from '@/user/user.service';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { FindMembershipResponse } from '@/workspaces/workspaces.type';
import {
  type Prisma,
  User,
  WorkspaceInvitation,
} from '@/generated/prisma/client';
import { DateTime } from 'luxon';

describe('WorkspaceInvitationService', () => {
  let workspaceInvitationService: WorkspaceInvitationService;
  let workspacesService: WorkspacesService;
  let userService: UserService;
  let notificationService: NotificationService;
  let workspaceInvitationRepository: WorkspaceInvitationRepository;
  let prismaService: PrismaService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationService,
        {
          provide: WorkspacesService,
          useValue: {
            findMembership: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getByEmail: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createNotification: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
        {
          provide: WorkspaceInvitationRepository,
          useValue: {},
        },
      ],
    }).compile();

    workspaceInvitationService = module.get<WorkspaceInvitationService>(
      WorkspaceInvitationService,
    );
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
    userService = module.get<UserService>(UserService);
    notificationService = module.get<NotificationService>(NotificationService);
    workspaceInvitationRepository = module.get<WorkspaceInvitationRepository>(
      WorkspaceInvitationRepository,
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(workspaceInvitationService).toBeDefined();
    expect(workspacesService).toBeDefined();
    expect(userService).toBeDefined();
    expect(notificationService).toBeDefined();
    expect(workspaceInvitationRepository).toBeDefined();
  });

  // /** 取得工作區所有成員的邀請*/
  // describe('getMemberInvitationByWorkspace', () => {

  // });

  /** 尋找Status為 PENDING的資料 by workspaceId & invitee */
  describe('findPendingByWorkspaceAndInvitee', () => {});

  /** 邀請成員 */
  describe('inviteMember', () => {
    describe('你沒有邀請此工作區成員的權限ERROR', () => {
      const inviterUserId = 'inviterUserId';
      const workspaceId = 'workspaceId';
      const inviteeEmail = 'invitee@gmail.com';
      let member: FindMembershipResponse | null;
      beforeEach(() => {
        member = {
          memberId: '1',
          memberName: '邀請人',
          role: 'MEMBER',
          workspaceName: '測試工作區',
          workspaceArchivedAt: null,
        };
      });

      it('邀請人不在此工作區', async () => {
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValue(null);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');
        const transactionSpy = jest.spyOn(prismaService, '$transaction');
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('你沒有邀請此工作區成員的權限');
        expect(findMembershipSpy).toHaveBeenCalledTimes(1);
        expect(findMembershipSpy).toHaveBeenCalledWith(
          inviterUserId,
          workspaceId,
        );
        expect(getByEmailSpy).not.toHaveBeenCalled();
        expect(transactionSpy).not.toHaveBeenCalled();
      });

      it('邀請人非OWNER', async () => {
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValue(member);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');
        const transactionSpy = jest.spyOn(prismaService, '$transaction');
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('你沒有邀請此工作區成員的權限');
        expect(findMembershipSpy).toHaveBeenCalledTimes(1);
        expect(findMembershipSpy).toHaveBeenCalledWith(
          inviterUserId,
          workspaceId,
        );
        expect(getByEmailSpy).not.toHaveBeenCalled();
        expect(transactionSpy).not.toHaveBeenCalled();
      });

      it('工作區已封存', async () => {
        member!.role = 'OWNER';
        member!.workspaceArchivedAt = new Date('2026-09-09T12:00:00.000Z');
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValue(member);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');
        const transactionSpy = jest.spyOn(prismaService, '$transaction');
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('你沒有邀請此工作區成員的權限');
        expect(findMembershipSpy).toHaveBeenCalledTimes(1);
        expect(findMembershipSpy).toHaveBeenCalledWith(
          inviterUserId,
          workspaceId,
        );
        expect(getByEmailSpy).not.toHaveBeenCalled();
        expect(transactionSpy).not.toHaveBeenCalled();
      });
    });

    describe('只允許邀請已註冊使用者', () => {
      const inviterUserId = 'inviterUserId';
      const workspaceId = 'workspaceId';
      const inviteeEmail = 'invitee@gmail.com';
      let member: FindMembershipResponse | null;
      const invitee = {
        id: 'inviterUserId',
        email: 'inviter@gmail.com',
        displayName: 'inviter',
        passwordHash: 'inviterHashPassword',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      beforeEach(() => {
        member = {
          memberId: '1',
          memberName: '邀請人',
          role: 'OWNER',
          workspaceName: '測試工作區',
          workspaceArchivedAt: null,
        };
      });

      it('此帳號不存在', async () => {
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValue(member);
        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(null);
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('此帳號不存在');
        expect(findMembershipSpy).toHaveBeenCalledTimes(1);
        expect(findMembershipSpy).toHaveBeenCalledWith(
          inviterUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
      });

      it('無法邀請自己', async () => {
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValue(member);
        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(invitee);
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('無法邀請自己');
        expect(findMembershipSpy).toHaveBeenCalledTimes(1);
        expect(findMembershipSpy).toHaveBeenCalledWith(
          inviterUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
      });

      it('受邀者已是工作區成員時應拒絕', async () => {
        const existingMember: FindMembershipResponse = {
          memberId: '1',
          memberName: '受邀者',
          role: 'MEMBER',
          workspaceName: '測試工作區',
          workspaceArchivedAt: null,
        };
        const registeredInvitee = {
          ...invitee,
          id: 'inviteeUserId',
          email: inviteeEmail,
          displayName: 'invitee',
        };
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValueOnce(member)
          .mockResolvedValueOnce(existingMember);

        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(registeredInvitee);
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('此使用者已是工作區成員');
        expect(findMembershipSpy).toHaveBeenCalledTimes(2);
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          1,
          inviterUserId,
          workspaceId,
        );

        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          2,
          registeredInvitee.id,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
      });
    });

    describe('查看邀請是否存在或過期', () => {
      const inviterUserId = 'inviterUserId';
      const inviteeUserId = 'inviteeUserId';
      const inviteeEmail = 'invitee@gmail.com';
      const workspaceId = 'workspaceId';
      let inviter: FindMembershipResponse | null;
      let invitee: User | null;
      let pendingInvitation: WorkspaceInvitation | null;
      const now = new Date('2026-09-09T00:00:00.000Z');
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(now);
        inviter = {
          memberId: '1',
          memberName: 'inviter',
          role: 'OWNER',
          workspaceName: '測試工作區',
          workspaceArchivedAt: null,
        };
        invitee = {
          id: inviteeUserId,
          email: inviteeEmail,
          displayName: 'invitee',
          passwordHash: 'inviteeHashPassword',
          avatarUrl: null,
          createdAt: now,
          updatedAt: now,
        };
        pendingInvitation = {
          inviterUserId: inviterUserId,
          workspaceId: workspaceId,
          inviteeUserId: inviteeUserId,
          id: '1',
          createdAt: now,
          updatedAt: now,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: now,
          respondedAt: null,
        };
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('已經邀請過此使用者(未過期)', async () => {
        const expiredExpiresAt = DateTime.fromJSDate(now)
          .plus({ seconds: 1 })
          .toJSDate();
        pendingInvitation!.expiresAt = expiredExpiresAt;
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValueOnce(inviter)
          .mockResolvedValueOnce(null);

        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(invitee);

        const findPendingByWorkspaceAndInviteeSpy = jest
          .spyOn(workspaceInvitationService, 'findPendingByWorkspaceAndInvitee')
          .mockResolvedValue(pendingInvitation);

        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('已經邀請過此使用者');

        expect(findMembershipSpy).toHaveBeenCalledTimes(2);
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          1,
          inviterUserId,
          workspaceId,
        );
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          2,
          inviteeUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledTimes(1);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledWith(
          workspaceId,
          inviteeUserId,
        );
      });

      it('已過期但更新狀態發生問題', async () => {
        const expiredExpiresAt = DateTime.fromJSDate(now)
          .minus({ seconds: 1 })
          .toJSDate();
        pendingInvitation!.expiresAt = expiredExpiresAt;
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValueOnce(inviter)
          .mockResolvedValueOnce(null);

        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(invitee);

        const findPendingByWorkspaceAndInviteeSpy = jest
          .spyOn(workspaceInvitationService, 'findPendingByWorkspaceAndInvitee')
          .mockResolvedValue(pendingInvitation);
        const markExpiredSpy = jest
          .spyOn(workspaceInvitationService, 'markExpired')
          .mockResolvedValueOnce(0);
        await expect(
          workspaceInvitationService.inviteMember(
            inviterUserId,
            workspaceId,
            inviteeEmail,
          ),
        ).rejects.toThrow('邀請狀態已發生變更，請重新操作');
        expect(findMembershipSpy).toHaveBeenCalledTimes(2);
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          1,
          inviterUserId,
          workspaceId,
        );
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          2,
          inviteeUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledTimes(1);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledWith(
          workspaceId,
          inviteeUserId,
        );
        expect(markExpiredSpy).toHaveBeenCalledTimes(1);
        expect(markExpiredSpy).toHaveBeenCalledWith(pendingInvitation!.id, now);
      });
    });

    describe('邀請成功', () => {
      const inviterUserId = 'inviterUserId';
      const inviteeUserId = 'inviteeUserId';
      const inviteeEmail = 'invitee@gmail.com';
      const workspaceId = 'workspaceId';
      let inviter: FindMembershipResponse | null;
      let invitee: User | null;
      let pendingInvitation: WorkspaceInvitation | null;
      const now = new Date('2026-09-09T00:00:00.000Z');
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(now);
        inviter = {
          memberId: '1',
          memberName: 'inviter',
          role: 'OWNER',
          workspaceName: '測試工作區',
          workspaceArchivedAt: null,
        };
        invitee = {
          id: inviteeUserId,
          email: inviteeEmail,
          displayName: 'invitee',
          passwordHash: 'inviteeHashPassword',
          avatarUrl: null,
          createdAt: now,
          updatedAt: now,
        };
        pendingInvitation = {
          inviterUserId: inviterUserId,
          workspaceId: workspaceId,
          inviteeUserId: inviteeUserId,
          id: '1',
          createdAt: now,
          updatedAt: now,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: now,
          respondedAt: null,
        };
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('成功創建邀請(原有的邀請已過期)', async () => {
        const expiredExpiresAt = DateTime.fromJSDate(now)
          .minus({ seconds: 1 })
          .toJSDate();
        const newExpiresAt = DateTime.fromJSDate(now)
          .plus({ day: 7 })
          .toJSDate();
        const invitation: WorkspaceInvitation = {
          role: 'MEMBER',
          id: '2',
          createdAt: now,
          updatedAt: now,
          inviteeUserId: inviteeUserId,
          workspaceId: workspaceId,
          inviterUserId: inviterUserId,
          status: 'PENDING',
          expiresAt: DateTime.fromJSDate(now).plus({ day: 7 }).toJSDate(),
          respondedAt: null,
        };

        pendingInvitation!.expiresAt = expiredExpiresAt;
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValueOnce(inviter)
          .mockResolvedValueOnce(null);

        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(invitee);

        const findPendingByWorkspaceAndInviteeSpy = jest
          .spyOn(workspaceInvitationService, 'findPendingByWorkspaceAndInvitee')
          .mockResolvedValue(pendingInvitation);
        const markExpiredSpy = jest
          .spyOn(workspaceInvitationService, 'markExpired')
          .mockResolvedValueOnce(1);
        const tx = {} as Prisma.TransactionClient;
        const transactionSpy = jest
          .spyOn(prismaService, '$transaction')
          .mockImplementation(async (callback) => {
            if (typeof callback !== 'function') {
              throw new Error('預期使用 interactive transaction');
            }

            return callback(tx);
          });
        const createInvitationSpy = jest
          .spyOn(workspaceInvitationService, 'createInvitation')
          .mockResolvedValue(invitation);
        const createNotificationSpy = jest.spyOn(
          notificationService,
          'createNotification',
        );
        const result = await workspaceInvitationService.inviteMember(
          inviterUserId,
          workspaceId,
          inviteeEmail,
        );
        expect(result.workspaceId).toEqual(workspaceId);
        expect(result.inviteeUserId).toEqual(inviteeUserId);
        expect(result.inviterUserId).toEqual(inviterUserId);
        expect(result.role).toEqual('MEMBER');
        expect(result.status).toEqual('PENDING');
        expect(result.expiresAt).toEqual(newExpiresAt);
        expect(findMembershipSpy).toHaveBeenCalledTimes(2);
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          1,
          inviterUserId,
          workspaceId,
        );
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          2,
          inviteeUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledTimes(1);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledWith(
          workspaceId,
          inviteeUserId,
        );
        expect(markExpiredSpy).toHaveBeenCalledTimes(1);
        expect(markExpiredSpy).toHaveBeenCalledWith(pendingInvitation!.id, now);
        expect(transactionSpy).toHaveBeenCalledTimes(1);
        expect(createInvitationSpy).toHaveBeenCalledTimes(1);
        expect(createInvitationSpy).toHaveBeenCalledWith(
          {
            workspaceId,
            inviteeUserId,
            inviterUserId,
            expiresAt: newExpiresAt,
          },
          tx,
        );
        expect(createNotificationSpy).toHaveBeenCalledTimes(1);
        expect(createNotificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientUserId: inviteeUserId,
            actorUserId: inviterUserId,
            workspaceId,
            type: 'WORKSPACE_INVITED',
            resourceType: 'WORKSPACE_INVITATION',
            resourceId: invitation.id,
          }),
          tx,
        );
      });

      it('成功創建邀請(無過期的邀請)', async () => {
        const expiredExpiresAt = DateTime.fromJSDate(now)
          .minus({ seconds: 1 })
          .toJSDate();
        const newExpiresAt = DateTime.fromJSDate(now)
          .plus({ day: 7 })
          .toJSDate();
        pendingInvitation!.expiresAt = expiredExpiresAt;
        const invitation: WorkspaceInvitation = {
          role: 'MEMBER',
          id: '2',
          createdAt: now,
          updatedAt: now,
          inviteeUserId: inviteeUserId,
          workspaceId: workspaceId,
          inviterUserId: inviterUserId,
          status: 'PENDING',
          expiresAt: newExpiresAt,
          respondedAt: null,
        };
        const findMembershipSpy = jest
          .spyOn(workspacesService, 'findMembership')
          .mockResolvedValueOnce(inviter)
          .mockResolvedValueOnce(null);

        const getByEmailSpy = jest
          .spyOn(userService, 'getByEmail')
          .mockResolvedValue(invitee);

        const findPendingByWorkspaceAndInviteeSpy = jest
          .spyOn(workspaceInvitationService, 'findPendingByWorkspaceAndInvitee')
          .mockResolvedValue(null);
        const markExpiredSpy = jest.spyOn(
          workspaceInvitationService,
          'markExpired',
        );
        const tx = {} as Prisma.TransactionClient;
        const transactionSpy = jest
          .spyOn(prismaService, '$transaction')
          .mockImplementation(async (callback) => {
            if (typeof callback !== 'function') {
              throw new Error('預期使用 interactive transaction');
            }

            return callback(tx);
          });
        const createInvitationSpy = jest
          .spyOn(workspaceInvitationService, 'createInvitation')
          .mockResolvedValue(invitation);
        const createNotificationSpy = jest.spyOn(
          notificationService,
          'createNotification',
        );
        const result = await workspaceInvitationService.inviteMember(
          inviterUserId,
          workspaceId,
          inviteeEmail,
        );
        expect(result.workspaceId).toEqual(workspaceId);
        expect(result.inviteeUserId).toEqual(inviteeUserId);
        expect(result.inviterUserId).toEqual(inviterUserId);
        expect(result.role).toEqual('MEMBER');
        expect(result.status).toEqual('PENDING');
        expect(result.expiresAt).toEqual(newExpiresAt);
        expect(findMembershipSpy).toHaveBeenCalledTimes(2);
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          1,
          inviterUserId,
          workspaceId,
        );
        expect(findMembershipSpy).toHaveBeenNthCalledWith(
          2,
          inviteeUserId,
          workspaceId,
        );
        expect(getByEmailSpy).toHaveBeenCalledTimes(1);
        expect(getByEmailSpy).toHaveBeenCalledWith(inviteeEmail);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledTimes(1);
        expect(findPendingByWorkspaceAndInviteeSpy).toHaveBeenCalledWith(
          workspaceId,
          inviteeUserId,
        );
        expect(markExpiredSpy).toHaveBeenCalledTimes(0);
        expect(transactionSpy).toHaveBeenCalledTimes(1);
        expect(createInvitationSpy).toHaveBeenCalledTimes(1);
        expect(createInvitationSpy).toHaveBeenCalledWith(
          {
            workspaceId,
            inviteeUserId,
            inviterUserId,
            expiresAt: newExpiresAt,
          },
          tx,
        );
        expect(createNotificationSpy).toHaveBeenCalledTimes(1);
        expect(createNotificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientUserId: inviteeUserId,
            actorUserId: inviterUserId,
            workspaceId,
            type: 'WORKSPACE_INVITED',
            resourceType: 'WORKSPACE_INVITATION',
            resourceId: invitation.id,
          }),
          tx,
        );
      });
    });
  });
});
