export type RoleLevel = "super_admin" | "admin" | "manager" | "member"

export const ROLE_HIERARCHY: Record<RoleLevel, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  member: 1,
}

export function canAccess(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export const PERMISSIONS = {
  view_all_calendars: "admin" as RoleLevel,
  view_all_tasks: "manager" as RoleLevel,
  manage_call_notes: "admin" as RoleLevel,
  manage_finance: "admin" as RoleLevel,
  manage_roles: "super_admin" as RoleLevel,
  approve_leaves: "admin" as RoleLevel,
  delete_employees: "super_admin" as RoleLevel,
  create_employees: "admin" as RoleLevel,
  view_agent_commissions: "admin" as RoleLevel,
  view_all_emails: "admin" as RoleLevel,
  team_view_toggle: "admin" as RoleLevel,
  manage_integrations: "admin" as RoleLevel,
}

/**
 * Department-based access rules (hybrid with role).
 * Each rule defines: who can access based on role OR department membership.
 */
export type DeptAccessRule = {
  minRole?: RoleLevel
  allowDepartments?: string[]
  denyDepartments?: string[]
}

export const PAGE_ACCESS: Record<string, DeptAccessRule> = {
  finance: { minRole: "admin", allowDepartments: ["Finance"] },
  marketing: { minRole: "admin", allowDepartments: ["Marketing"] },
  crm: { denyDepartments: ["Compliance"] },
  intel: { minRole: "manager" },
  compliance: { minRole: "manager", allowDepartments: ["Compliance", "Legal"] },
}

/**
 * Check if a user can access a page/feature based on hybrid role + department rules.
 */
export function canAccessPage(
  userRole: RoleLevel,
  userDepartment: string | null | undefined,
  pageKey: string
): boolean {
  const rule = PAGE_ACCESS[pageKey]
  if (!rule) return true

  // Deny-list check: if user's department is denied, block access
  if (rule.denyDepartments && userDepartment) {
    if (rule.denyDepartments.some((d) => d.toLowerCase() === userDepartment.toLowerCase())) {
      return false
    }
  }

  // If no minRole required and no deny hit, allow
  if (!rule.minRole) return true

  // Allow if user has sufficient role
  if (canAccess(userRole, rule.minRole)) return true

  // Allow if user's department is in the allow list
  if (rule.allowDepartments && userDepartment) {
    if (rule.allowDepartments.some((d) => d.toLowerCase() === userDepartment.toLowerCase())) {
      return true
    }
  }

  return false
}

export const ROLE_COLORS: Record<RoleLevel, { bg: string; text: string; gradient?: boolean }> = {
  super_admin: { bg: "linear-gradient(135deg, #C08B88, #D4A5A2)", text: "#060709", gradient: true },
  admin: { bg: "rgba(251,191,36,0.15)", text: "#FBBF24" },
  manager: { bg: "rgba(129,140,248,0.15)", text: "#818CF8" },
  member: { bg: "rgba(255,255,255,0.06)", text: "rgba(240,240,242,0.55)" },
}

export const ROLE_LABELS: Record<RoleLevel, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
}

export const ROLE_LEVELS: RoleLevel[] = ["super_admin", "admin", "manager", "member"]
