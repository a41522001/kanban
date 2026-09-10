import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ApiResponse } from '@kanban/contracts/api';
import type { WorkspaceDto } from '@kanban/contracts/workspaces';
import { FindByRecipientResponse } from '@kanban/contracts/notification';

describe('WorkspaceInvitation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  const inviter = {
    email: 'inviter@gmail.com',
    password: 'inviterinviter',
    name: 'inviter',
  };
  const invitee = {
    email: 'invitee@gmail.com',
    password: 'inviteeinvitee',
    name: 'invitee',
  };
  it('邀請人發送邀請後，受邀人可從通知接受並加入工作區', async () => {
    const inviterAgent = request.agent(app.getHttpServer());
    const inviteeAgent = request.agent(app.getHttpServer());

    // 註冊
    await inviterAgent.post('/auth/signup').send(inviter).expect(201);
    await inviteeAgent.post('/auth/signup').send(invitee).expect(201);
    // 邀請人登入
    await inviterAgent
      .post('/auth/login')
      .send({
        email: inviter.email,
        password: inviter.password,
      })
      .expect(200);
    const createWorkspaceResponse = await inviterAgent
      .post('/workspaces/')
      .send({
        name: '測試工作區',
      });
    const createWorkspaceResponseBody =
      createWorkspaceResponse.body as ApiResponse<WorkspaceDto>;

    if (!createWorkspaceResponseBody.data) {
      throw new Error('建立工作區成功，但 response data 為 null');
    }
    const workspaceId = createWorkspaceResponseBody.data.id;
    expect(workspaceId).toBeDefined();
    await inviterAgent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId: workspaceId,
        email: invitee.email,
      })
      .expect(201);

    // 受邀人登入
    await inviteeAgent
      .post('/auth/login')
      .send({
        email: invitee.email,
        password: invitee.password,
      })
      .expect(200);
    const getNotificationResponse = await inviteeAgent
      .get('/notifications/')
      .expect(200);
    const getNotificationResponseBody =
      getNotificationResponse.body as ApiResponse<FindByRecipientResponse>;
    if (!getNotificationResponseBody.data) {
      throw new Error('取得所有通知成功，但 response data 為 null');
    }
    const notifications = getNotificationResponseBody.data.items;
    expect(notifications).toHaveLength(1);
    const acceptWorkspaceInvitationResponse = await inviteeAgent
      .post('/workspaceInvitation/accept')
      .send({ invitationId: notifications[0].resourceId })
      .expect(200);
    const acceptWorkspaceInvitationResponseBody =
      acceptWorkspaceInvitationResponse.body as ApiResponse<void>;
    expect(acceptWorkspaceInvitationResponseBody.message).toBe('已接受邀請');
  });

  afterAll(async () => {
    await app.close();
  });
});
