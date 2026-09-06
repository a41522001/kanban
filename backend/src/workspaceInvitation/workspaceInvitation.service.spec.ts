import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceInvitationService } from './workspaceInvitation.service';

describe.skip('WorkspaceInvitationService', () => {
  let service: WorkspaceInvitationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceInvitationService],
    }).compile();

    service = module.get<WorkspaceInvitationService>(
      WorkspaceInvitationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
