import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ApiResponse } from '@kanban/contracts/api';
import type { WorkspaceDto } from '@kanban/contracts/workspaces';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';

describe('markReadInvitation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('邀請人發送邀請後，受邀人可從通知已讀', async () => {
    const inviter = {
      email: 'mark-read-inviter@example.com',
      password: 'inviterinviter',
      name: 'mark-read-inviter',
    };

    const invitee = {
      email: 'mark-read-invitee@example.com',
      password: 'inviteeinvitee',
      name: 'mark-read-invitee',
    };
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
    const unreadCountResponse1 = await inviteeAgent
      .get('/notifications/unreadCount')
      .expect(200);
    const unreadCountResponseBody1 = unreadCountResponse1.body as ApiResponse<{
      count: number;
    }>;
    if (!unreadCountResponseBody1.data) {
      throw new Error('取得已讀數量成功，但 response data 為 null');
    }
    expect(unreadCountResponseBody1.data.count).toBe(1);
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
    expect(notifications[0]).toMatchObject({
      type: 'WORKSPACE_INVITED',
      resourceType: 'WORKSPACE_INVITATION',
      resourceId: expect.any(String),
    });
    expect(notifications[0]).not.toHaveProperty('payload');
    expect(notifications[0].readAt).toBeNull();
    await inviteeAgent
      .patch('/notifications/read')
      .send({
        notificationId: notifications[0].id,
      })
      .expect(200);
    const unreadCountResponse2 = await inviteeAgent
      .get('/notifications/unreadCount')
      .expect(200);
    const unreadCountResponseBody2 = unreadCountResponse2.body as ApiResponse<{
      count: number;
    }>;
    if (!unreadCountResponseBody2.data) {
      throw new Error('取得已讀數量成功，但 response data 為 null');
    }
    expect(unreadCountResponseBody2.data.count).toBe(0);
  });

  it('兩個邀請人發送給同一人邀請後，受邀人可從通知全部已讀', async () => {
    const inviter1 = {
      email: 'mark-read-inviter1@example.com',
      password: 'inviterinviter1',
      name: 'mark-read-inviter1',
    };
    const inviter2 = {
      email: 'mark-read-inviter2@example.com',
      password: 'inviterinviter2',
      name: 'mark-read-inviter2',
    };

    const invitee = {
      email: 'mark-read-invitee1@example.com',
      password: 'inviteeinvitee1',
      name: 'mark-read-invitee1',
    };
    const inviter1Agent = request.agent(app.getHttpServer());
    const inviter2Agent = request.agent(app.getHttpServer());
    const inviteeAgent = request.agent(app.getHttpServer());

    // 註冊
    await inviter1Agent.post('/auth/signup').send(inviter1).expect(201);
    await inviter2Agent.post('/auth/signup').send(inviter2).expect(201);
    await inviteeAgent.post('/auth/signup').send(invitee).expect(201);
    // 邀請人1登入
    await inviter1Agent
      .post('/auth/login')
      .send({
        email: inviter1.email,
        password: inviter1.password,
      })
      .expect(200);
    const createWorkspace1Response = await inviter1Agent
      .post('/workspaces/')
      .send({
        name: '測試工作區',
      });
    const createWorkspaceResponse1Body =
      createWorkspace1Response.body as ApiResponse<WorkspaceDto>;

    if (!createWorkspaceResponse1Body.data) {
      throw new Error('建立工作區成功，但 response data 為 null');
    }
    const workspace1Id = createWorkspaceResponse1Body.data.id;
    expect(workspace1Id).toBeDefined();
    await inviter1Agent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId: workspace1Id,
        email: invitee.email,
      })
      .expect(201);

    // 邀請人2登入
    await inviter2Agent
      .post('/auth/login')
      .send({
        email: inviter2.email,
        password: inviter2.password,
      })
      .expect(200);
    const createWorkspace2Response = await inviter2Agent
      .post('/workspaces/')
      .send({
        name: '測試工作區',
      });
    const createWorkspaceResponse2Body =
      createWorkspace2Response.body as ApiResponse<WorkspaceDto>;

    if (!createWorkspaceResponse2Body.data) {
      throw new Error('建立工作區成功，但 response data 為 null');
    }
    const workspace2Id = createWorkspaceResponse2Body.data.id;
    expect(workspace2Id).toBeDefined();
    await inviter2Agent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId: workspace2Id,
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
    const unreadCountResponse1 = await inviteeAgent
      .get('/notifications/unreadCount')
      .expect(200);
    const unreadCountResponseBody1 = unreadCountResponse1.body as ApiResponse<{
      count: number;
    }>;
    if (!unreadCountResponseBody1.data) {
      throw new Error('取得已讀數量成功，但 response data 為 null');
    }
    expect(unreadCountResponseBody1.data.count).toBe(2);
    const getNotificationResponse = await inviteeAgent
      .get('/notifications/')
      .expect(200);
    const getNotificationResponseBody =
      getNotificationResponse.body as ApiResponse<FindByRecipientResponse>;
    if (!getNotificationResponseBody.data) {
      throw new Error('取得所有通知成功，但 response data 為 null');
    }
    const notifications = getNotificationResponseBody.data.items;
    expect(notifications).toHaveLength(2);
    notifications.map((item) => {
      expect(item.readAt).toBeNull();
    });

    const readAllResponse = await inviteeAgent
      .patch('/notifications/readAll')
      .send()
      .expect(200);
    const readAllResponseBody = readAllResponse.body as ApiResponse<number>;
    if (!readAllResponseBody.data) {
      throw new Error('取得已讀數量成功，但 response data 為 null');
    }
    expect(readAllResponseBody.data).toBe(2);
    const unreadCountResponse2 = await inviteeAgent
      .get('/notifications/unreadCount')
      .expect(200);
    const unreadCountResponseBody2 = unreadCountResponse2.body as ApiResponse<{
      count: number;
    }>;
    if (!unreadCountResponseBody2.data) {
      throw new Error('取得已讀數量成功，但 response data 為 null');
    }
    expect(unreadCountResponseBody2.data.count).toBe(0);
  });

  afterAll(async () => {
    await app.close();
  });
});
