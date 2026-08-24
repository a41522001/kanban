import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from '@/session/session.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import type { Request } from 'express';
describe('UserController', () => {
  let controller: UserController;

  const userService = {
    getUserInfo: jest.fn(),
  };
  const createRequest = (userId?: string): Request => {
    return { userId } as Request;
  };
  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get(UserController);
  });

  /** 取得UserInfo */
  it('取得UserInfo', async () => {
    const userId = 'testId';
    const req = createRequest(userId);
    const res = {
      email: 'test@email.com',
      displayName: 'test',
      avatarUrl: null,
    };
    const spy = jest.spyOn(userService, 'getUserInfo').mockResolvedValue(res);
    const result = await controller.userInfo(req);
    expect(result).toEqual({ data: res });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(userId);
  });
});
