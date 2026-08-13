import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import envConfig from '../../config/env.config';

describe('AuthModule (Unit & Integration Tests)', () => {
  let sequelize: Sequelize;
  let authService: AuthService;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let jwtService: JwtService;
  let jwtStrategy: JwtStrategy;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      models: [User, Design],
    });
    await sequelize.sync({ force: true });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [envConfig],
        }),
        JwtModule.register({
          secret: 'test-jwt-secret-key-12345',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        PasswordService,
        JwtStrategy,
        UsersService,
        {
          provide: 'UserRepository',
          useValue: User,
        },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    usersService = moduleRef.get<UsersService>(UsersService);
    passwordService = moduleRef.get<PasswordService>(PasswordService);
    jwtService = moduleRef.get<JwtService>(JwtService);
    jwtStrategy = moduleRef.get<JwtStrategy>(JwtStrategy);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
  });

  describe('REGISTRATION', () => {
    it('should successfully register a user and return safe response with JWT', async () => {
      const result = await authService.register({
        email: '  NEWUSER@Example.com ',
        password: 'securePassword123',
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      const userRecord = result.user as unknown as Record<string, unknown>;
      expect(userRecord.password_hash).toBeUndefined();
      expect(result.accessToken).toBeDefined();

      // Verify database storage & password hashing
      const dbUser = await usersService.findByEmail('newuser@example.com');
      expect(dbUser).not.toBeNull();
      expect(dbUser?.password_hash).not.toBe('securePassword123');
      const isMatch = await passwordService.comparePassword(
        'securePassword123',
        dbUser!.password_hash,
      );
      expect(isMatch).toBe(true);
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      await authService.register({
        email: 'duplicate@example.com',
        password: 'password123',
      });

      await expect(
        authService.register({
          email: 'DUPLICATE@example.com',
          password: 'anotherPassword123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('LOGIN', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'authuser@example.com',
        password: 'correctPassword123',
      });
    });

    it('should login successfully with valid credentials and return token & user info', async () => {
      const result = await authService.login({
        email: 'AUTHUSER@example.com',
        password: 'correctPassword123',
      });

      expect(result.user.email).toBe('authuser@example.com');
      expect(result.accessToken).toBeDefined();
      const userRecord = result.user as unknown as Record<string, unknown>;
      expect(userRecord.password_hash).toBeUndefined();

      const decoded: unknown = jwtService.decode(result.accessToken);
      expect((decoded as { sub: string }).sub).toBe(result.user.id);
    });

    it('should reject login with wrong password returning 401 Unauthorized', async () => {
      await expect(
        authService.login({
          email: 'authuser@example.com',
          password: 'wrongPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login with unknown email returning 401 Unauthorized with identical error message', async () => {
      let errWrongPassword: UnauthorizedException | null = null;
      let errUnknownEmail: UnauthorizedException | null = null;

      try {
        await authService.login({
          email: 'authuser@example.com',
          password: 'wrongPassword123',
        });
      } catch (e) {
        if (e instanceof UnauthorizedException) {
          errWrongPassword = e;
        }
      }

      try {
        await authService.login({
          email: 'nonexistent@example.com',
          password: 'correctPassword123',
        });
      } catch (e) {
        if (e instanceof UnauthorizedException) {
          errUnknownEmail = e;
        }
      }

      expect(errWrongPassword).toBeInstanceOf(UnauthorizedException);
      expect(errUnknownEmail).toBeInstanceOf(UnauthorizedException);
      expect(errWrongPassword?.message).toBe(errUnknownEmail?.message);
      expect(errWrongPassword?.message).toBe('Invalid email or password');
    });
  });

  describe('JWT & STRATEGY VALIDATION', () => {
    it('should accept valid token in JwtStrategy', async () => {
      const reg = await authService.register({
        email: 'strategyuser@example.com',
        password: 'password123',
      });

      const validatedUser = await jwtStrategy.validate({ sub: reg.user.id });
      expect(validatedUser.id).toBe(reg.user.id);
      expect(validatedUser.email).toBe('strategyuser@example.com');
    });

    it('should reject non-existent user sub in JwtStrategy', async () => {
      await expect(
        jwtStrategy.validate({ sub: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject malformed or empty sub in JwtStrategy', async () => {
      await expect(jwtStrategy.validate({ sub: '' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('DATABASE INTERACTION WITH DESIGNS', () => {
    it('should allow designs to reference a registered user', async () => {
      const reg = await authService.register({
        email: 'designer@example.com',
        password: 'password123',
      });

      const design = await Design.create({
        user_id: reg.user.id,
        name: 'Auth Design',
        file_name: 'auth.zip',
        storage_key: 'uploads/auth.zip',
        file_size: 1024,
        status: DesignStatus.UPLOADED,
      });

      expect(design.user_id).toBe(reg.user.id);
    });
  });
});
