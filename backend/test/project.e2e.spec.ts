import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ApiResponse } from '@kanban/contracts/api';
import type { WorkspaceDto } from '@kanban/contracts/workspaces';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';
import type {
  MemberCandidate,
  ProjectListItemDto,
  ProjectMemberAddedNotificationDetail,
} from '@kanban/contracts/project';

describe('Project (e2e)', () => {
  let app: INestApplication<App>;
  const workspaceOwner = {
    email: 'owner@gmail.com',
    password: 'ownerowner',
    name: 'owner',
  };
  const workspaceMember1 = {
    email: 'member1@gmail.com',
    password: 'member1mebmer1',
    name: 'member1',
  };
  const workspaceMember2 = {
    email: 'member2@gmail.com',
    password: 'member2mebmer2',
    name: 'member2',
  };
  const workspaceMember3 = {
    email: 'member3@gmail.com',
    password: 'member3mebmer3',
    name: 'member3',
  };

  let workspaceId: string = '';
  let projectId: string = '';
  let ownerAgent: TestAgent;
  let member1Agent: TestAgent;
  let member2Agent: TestAgent;
  let member3Agent: TestAgent;
  let memberCandidate: MemberCandidate[] = [];
  const projectDetail = {
    name: 'kanban',
    description: '這是測試專案',
    workspaceId: '',
  };
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    member1Agent = request.agent(app.getHttpServer());
    member2Agent = request.agent(app.getHttpServer());
    member3Agent = request.agent(app.getHttpServer());
    // 註冊
    await ownerAgent.post('/auth/signup').send(workspaceOwner).expect(201);
    await member1Agent.post('/auth/signup').send(workspaceMember1).expect(201);
    await member2Agent.post('/auth/signup').send(workspaceMember2).expect(201);
    await member3Agent.post('/auth/signup').send(workspaceMember3).expect(201);
    // 邀請人登入
    await ownerAgent
      .post('/auth/login')
      .send({
        email: workspaceOwner.email,
        password: workspaceOwner.password,
      })
      .expect(200);
    // 建立工作區
    const createWorkspaceResponse = await ownerAgent.post('/workspaces/').send({
      name: '測試工作區',
    });
    const createWorkspaceResponseBody =
      createWorkspaceResponse.body as ApiResponse<WorkspaceDto>;
    workspaceId = createWorkspaceResponseBody.data!.id;
    projectDetail.workspaceId = createWorkspaceResponseBody.data!.id;
    // 邀請成員進工作區
    await ownerAgent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId,
        email: workspaceMember1.email,
      })
      .expect(201);
    await ownerAgent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId,
        email: workspaceMember2.email,
      })
      .expect(201);
    await ownerAgent
      .post('/workspaceInvitation/invite')
      .send({
        workspaceId,
        email: workspaceMember3.email,
      })
      .expect(201);
    // 成員1, 2, 3登入並接受工作區邀請
    // 成員1
    await member1Agent
      .post('/auth/login')
      .send({
        email: workspaceMember1.email,
        password: workspaceMember1.password,
      })
      .expect(200);
    const member1GetNotificationResponseBody = (
      await member1Agent.get('/notifications/').expect(200)
    ).body as ApiResponse<FindByRecipientResponse>;
    await member1Agent
      .post('/workspaceInvitation/accept')
      .send({
        invitationId:
          member1GetNotificationResponseBody.data!.items[0].resourceId!,
      })
      .expect(200);
    // 成員2
    await member2Agent
      .post('/auth/login')
      .send({
        email: workspaceMember2.email,
        password: workspaceMember2.password,
      })
      .expect(200);
    const member2GetNotificationResponseBody = (
      await member2Agent.get('/notifications/').expect(200)
    ).body as ApiResponse<FindByRecipientResponse>;
    await member2Agent
      .post('/workspaceInvitation/accept')
      .send({
        invitationId:
          member2GetNotificationResponseBody.data!.items[0].resourceId!,
      })
      .expect(200);
    // 成員3
    await member3Agent
      .post('/auth/login')
      .send({
        email: workspaceMember3.email,
        password: workspaceMember3.password,
      })
      .expect(200);
    const member3GetNotificationResponseBody = (
      await member3Agent.get('/notifications/').expect(200)
    ).body as ApiResponse<FindByRecipientResponse>;
    await member3Agent
      .post('/workspaceInvitation/accept')
      .send({
        invitationId:
          member3GetNotificationResponseBody.data!.items[0].resourceId!,
      })
      .expect(200);
  });

  it('在邀請專案成員列表會看到4位候選人', async () => {
    // 建立專案
    await ownerAgent.post('/project/').send(projectDetail).expect(201);
    const projectResponseBody = (
      await ownerAgent.get(`/project/${workspaceId}`).expect(200)
    ).body as ApiResponse<ProjectListItemDto[]>;
    if (!projectResponseBody.data) {
      throw new Error('取得專案成功，但 response data 為 null');
    }
    expect(projectResponseBody.data).toHaveLength(1);
    projectId = projectResponseBody.data[0].id;

    // 取得候選人
    const memberCandidatesBody = (
      await ownerAgent
        .get(`/project/${projectId}/memberCandidates/`)
        .expect(200)
    ).body as ApiResponse<MemberCandidate[]>;
    if (!memberCandidatesBody.data) {
      throw new Error('取得候選人成功，但 response data 為 null');
    }
    expect(memberCandidatesBody.data).toHaveLength(4);
    memberCandidate = memberCandidatesBody.data;
  });

  it('增加工作區成員1至測試專案', async () => {
    const targetCandidate = memberCandidate.find(
      (c) => c.displayName === workspaceMember1.name,
    );
    await ownerAgent
      .post('/project/addMember/')
      .send({
        projectId,
        workspaceMemberId: targetCandidate!.workspaceMemberId,
        role: 'EDITOR',
      })
      .expect(201);
  });

  it('成員1取得通知後可找到新增至Project的詳細資訊', async () => {
    const member1GetNotificationResponseBody = (
      await member1Agent.get('/notifications/').expect(200)
    ).body as ApiResponse<FindByRecipientResponse>;
    const notification = member1GetNotificationResponseBody.data!.items;
    expect(notification[0].type).toBe('PROJECT_MEMBER_ADDED');
    const notificationDetailBody = (
      await member1Agent.get(
        `/project/notificationDetail/${notification[0].id}/`,
      )
    ).body as ApiResponse<ProjectMemberAddedNotificationDetail>;
    if (!notificationDetailBody.data) {
      throw new Error('取得notification detail成功，但 response data 為 null');
    }
    expect(notificationDetailBody.data.projectName).toBe(projectDetail.name);
    expect(notificationDetailBody.data.projectId).toBe(projectId);
    expect(notificationDetailBody.data.workspaceId).toBe(workspaceId);
    expect(notificationDetailBody.data.role).toBe('EDITOR');
    expect(notificationDetailBody.data.inviterName).toBe(workspaceOwner.name);
  });

  it('重複將成員1加入專案應拋出 409 Conflict', async () => {
    const targetCandidate = memberCandidate.find(
      (c) => c.displayName === workspaceMember1.name,
    );
    await ownerAgent
      .post('/project/addMember/')
      .send({
        projectId,
        workspaceMemberId: targetCandidate!.workspaceMemberId,
        role: 'EDITOR',
      })
      .expect(409);
  });

  afterAll(async () => {
    await app.close();
  });
});
