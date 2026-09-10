import { Test, type TestingModule } from '@nestjs/testing';
import { WorkspaceInvitationController } from './workspaceInvitation.controller';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import type { Request } from 'express';
import { SessionGuard } from '@/session/session.guard';

describe('WorkspaceInvitationController', () => {
  let controller: WorkspaceInvitationController;
  let workspaceInvitationService: WorkspaceInvitationService;
  const createRequest = (userId?: string): Request => {
    return { userId } as Request;
  };
  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [WorkspaceInvitationController],
      providers: [
        {
          provide: WorkspaceInvitationService,
          useValue: {
            acceptedInvitationAndCreateMember: jest.fn(),
            declineInvitation: jest.fn(),
            inviteMember: jest.fn(),
          },
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get(WorkspaceInvitationController);
    workspaceInvitationService = module.get(WorkspaceInvitationService);
  });
  it('defined', () => {
    expect(controller).toBeDefined();
    expect(workspaceInvitationService).toBeDefined();
  });

  /** 邀請工作區成員 */
  it('邀請工作區成員', async () => {
    const userId = 'testId';
    const payload = {
      workspaceId: 'workspaceId',
      email: 'test@test.com',
    };
    const request = createRequest(userId);
    const inviteMemberSpy = jest.spyOn(
      workspaceInvitationService,
      'inviteMember',
    );
    const result = await controller.inviteMember(request, payload);
    expect(result).toEqual({
      data: null,
      message: '邀請已送出',
    });
    expect(inviteMemberSpy).toHaveBeenCalledTimes(1);
    expect(inviteMemberSpy).toHaveBeenCalledWith(
      userId,
      payload.workspaceId,
      payload.email,
    );
  });

  /** 接受邀請 */
  it('接受邀請', async () => {
    const userId = 'testId';
    const invitationId = 'invitationId';
    const request = createRequest(userId);
    const acceptedInvitationAndCreateMemberSpy = jest.spyOn(
      workspaceInvitationService,
      'acceptedInvitationAndCreateMember',
    );
    const result = await controller.acceptInvitation(request, {
      invitationId,
    });
    expect(result).toEqual({ data: null, message: '已接受邀請' });
    expect(acceptedInvitationAndCreateMemberSpy).toHaveBeenCalledTimes(1);
    expect(acceptedInvitationAndCreateMemberSpy).toHaveBeenCalledWith(
      userId,
      invitationId,
    );
  });

  /** 拒絕邀請 */
  it('拒絕邀請', async () => {
    const userId = 'testId';
    const invitationId = 'invitationId';
    const request = createRequest(userId);
    const declineInvitationSpy = jest.spyOn(
      workspaceInvitationService,
      'declineInvitation',
    );
    const result = await controller.declineInvitation(request, {
      invitationId,
    });
    expect(result).toEqual({ data: null, message: '已拒絕邀請' });
    expect(declineInvitationSpy).toHaveBeenCalledTimes(1);
    expect(declineInvitationSpy).toHaveBeenCalledWith(userId, invitationId);
  });
});
