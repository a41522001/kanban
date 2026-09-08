import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { UserService } from '@/user/user.service';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { FindMembershipResponse } from '@/workspaces/workspaces.type';

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
          useValue: {},
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
      // TODO: 無法邀請自己
    });
  });
});
