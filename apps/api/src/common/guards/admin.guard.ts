import {
  Dependencies,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import type { AuthenticatedUser } from "@va/shared";

@Injectable()
@Dependencies()
export class AdminGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Missing authenticated user.");
    }

    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Administrator access is required.");
    }

    return true;
  }
}
