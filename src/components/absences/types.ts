export interface Employee {
  id: string
  name: string
  initials: string
  avatarColor: string
  department?: string
  isAdmin?: boolean
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employee: Employee
  type: string
  startDate: string
  endDate: string
  halfDay: boolean
  halfDayPeriod: string | null
  reason: string | null
  status: string
  reviewedBy: { name: string } | null
  reviewedAt: string | null
  reviewNote: string | null
  totalDays: number
  source?: string
  createdAt: string
}

export interface LeaveBalance {
  id: string
  employeeId: string
  year: number
  vacationTotal: number
  vacationUsed: number
  vacationPending: number
  sickTotal: number
  sickUsed: number
  oooTotal: number
  oooUsed: number
}

export interface WhoIsOut {
  id: string
  employee: Employee
  type: string
  startDate: string
  endDate: string
  halfDay: boolean
  halfDayPeriod: string | null
  totalDays?: number
}

export interface LeaveRules {
  id: string
  generalPolicy: string | null
  vacationQuota: number
  vacationMinNotice: number
  vacationMaxConsecutive: number
  vacationCarryOver: number
  sickQuota: number
  sickCertAfterDays: number
  oooQuota: number
  oooMinNotice: number
  oooReasonRequired: boolean
  approvalTimeline: number
  blackoutPeriods: BlackoutPeriod[] | null
  updatedBy: string | null
  updatedAt: string
}

export interface BlackoutPeriod {
  startDate: string
  endDate: string
  reason: string
}
