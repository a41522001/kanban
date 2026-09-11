import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { SessionGuard } from '@/session/session.guard';
import type { Request } from 'express';
describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationService;
  // const createRequest = (userId?: string): Request => {
  //   return { userId } as Request;
  // };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            findByRecipient: jest.fn(),
            countUnreadByRecipient: jest.fn(),
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

    controller = module.get<NotificationController>(NotificationController);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(notificationService).toBeDefined();
  });
});
