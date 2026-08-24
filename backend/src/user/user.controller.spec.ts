import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from '@/session/session.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;

  const userService = {
    getUserInfo: jest.fn(),
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

  it('應成功建立 Controller', () => {
    expect(controller).toBeDefined();
  });
});
