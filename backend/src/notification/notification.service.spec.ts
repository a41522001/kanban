import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { DateTime } from 'luxon';
import type { Notification } from '@/generated/prisma/client';
describe('NotificationService', () => {
  let notificationService: NotificationService;
  let notificationRepository: NotificationRepository;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationRepository,
          useValue: {
            findByRecipient: jest.fn(),
            countUnreadByRecipient: jest.fn(),
            createNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
    notificationRepository = module.get<NotificationRepository>(
      NotificationRepository,
    );
  });

  it('should be defined', () => {
    expect(notificationService).toBeDefined();
    expect(notificationRepository).toBeDefined();
  });

  /** 取得所有通知 by Recipient */
  describe('findByRecipient', () => {
    let now: DateTime;
    let expiresAt: DateTime;
    let recipientUserId: string;
    let notifications: Notification[];

    beforeEach(() => {
      now = DateTime.fromISO('2026-09-07T12:00:00.000Z', {
        zone: 'utc',
      });
      expiresAt = now.plus({ days: 7 });
      recipientUserId = '1';
      notifications = [
        {
          id: 'testId1',
          recipientUserId,
          actorUserId: 'testActor',
          workspaceId: 'workspaceId1',
          type: 'WORKSPACE_INVITED',
          resourceType: 'WORKSPACE_INVITATION',
          resourceId: 'testResourceId1',
          dedupeKey: 'dedupeKey1',
          readAt: null,
          expiresAt: expiresAt.toJSDate(),
          createdAt: now.toJSDate(),
        },
      ];
    });

    it('取得通知(只有recipientUserId參數)', async () => {
      const findByRecipientSpy = jest
        .spyOn(notificationRepository, 'findByRecipient')
        .mockResolvedValue({ items: notifications, nextCursor: null });

      const result = await notificationService.findByRecipient({
        recipientUserId,
      });
      expect(result).toEqual({
        items: [
          {
            id: 'testId1',
            workspaceId: 'workspaceId1',
            type: 'WORKSPACE_INVITED',
            resourceType: 'WORKSPACE_INVITATION',
            resourceId: 'testResourceId1',
            readAt: null,
            expiresAt: expiresAt.toISO(),
            createdAt: now.toISO(),
          },
        ],
        nextCursor: null,
      });
      expect(findByRecipientSpy).toHaveBeenCalledTimes(1);
      expect(findByRecipientSpy).toHaveBeenCalledWith({
        recipientUserId,
      });
    });
  });
});
