import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: { message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      const message = info?.message
        ? `Unauthorized: ${info.message}`
        : 'Unauthorized access';
      throw (err as Error) || new UnauthorizedException(message);
    }
    return user;
  }
}
