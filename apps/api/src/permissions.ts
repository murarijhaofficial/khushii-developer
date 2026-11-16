import { Role } from '@prisma/client';
export const leadEditors: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE];
export const leadManagers: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER];
export function canAccessLead(role: Role, userId: string, assignedToId: string | null): boolean {
  return role !== Role.SALES_EXECUTIVE || assignedToId === userId;
}
