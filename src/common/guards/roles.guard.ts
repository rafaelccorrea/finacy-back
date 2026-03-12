import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserRole, Permission } from '../enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Acesso negado.');
    }

    // Super admin has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check roles
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    // Check permissions
    if (requiredPermissions) {
      const userPermissions = this.getUserPermissions(user.role);
      const hasPermission = requiredPermissions.every((p) =>
        userPermissions.includes(p),
      );

      if (!hasPermission) {
        throw new ForbiddenException('Permissão insuficiente para esta ação.');
      }
    }

    return true;
  }

  private getUserPermissions(role: UserRole): Permission[] {
    const rolePermissions: Record<UserRole, Permission[]> = {
      [UserRole.SUPER_ADMIN]: Object.values(Permission),
      [UserRole.ADMIN]: [
        Permission.DASHBOARD_VIEW,
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.SUBSCRIPTIONS_VIEW,
        Permission.SUBSCRIPTIONS_CREATE,
        Permission.SUBSCRIPTIONS_UPDATE,
        Permission.SUBSCRIPTIONS_CANCEL,
        Permission.PLANS_VIEW,
        Permission.CLEAN_NAME_VIEW,
        Permission.CLEAN_NAME_REQUEST,
        Permission.PAYMENTS_VIEW,
        Permission.ADMIN_PANEL,
      ],
      [UserRole.USER]: [
        Permission.DASHBOARD_VIEW,
        Permission.SUBSCRIPTIONS_VIEW,
        Permission.PLANS_VIEW,
        Permission.CLEAN_NAME_VIEW,
        Permission.CLEAN_NAME_REQUEST,
        Permission.PAYMENTS_VIEW,
      ],
    };

    return rolePermissions[role] || [];
  }
}
