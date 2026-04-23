-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "telegram" TEXT,
    "telegramChatId" TEXT,
    "whatsapp" TEXT,
    "timezone" TEXT,
    "workHours" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "country" TEXT,
    "startDate" TIMESTAMP(3),
    "bio" TEXT,
    "avatarColor" TEXT NOT NULL,
    "icon" TEXT,
    "managerId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "roleLevel" TEXT NOT NULL DEFAULT 'member',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "deadline" TIMESTAMP(3),
    "column" TEXT NOT NULL DEFAULT 'todo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "supportTicketId" TEXT,
    "contactId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Operating Entity',
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "category" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lastViewedBy" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "attendees" TEXT[],
    "calendarOwner" TEXT NOT NULL,
    "location" TEXT,
    "meetLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "meetLink" TEXT,
    "attendees" TEXT[],
    "color" TEXT,
    "type" TEXT NOT NULL DEFAULT 'meeting',
    "recurring" TEXT,
    "recurringUntil" TIMESTAMP(3),
    "googleEventId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "noteData" JSONB,
    "eventId" TEXT,
    "internalEventId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiEntry" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "domain" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "hqCountry" TEXT,
    "hqCity" TEXT,
    "vertical" TEXT[],
    "subVertical" TEXT[],
    "geoZone" TEXT,
    "employeeCount" INTEGER,
    "revenueRange" TEXT,
    "fundingTotal" TEXT,
    "techStack" TEXT[],
    "linkedinUrl" TEXT,
    "socialProfiles" JSONB,
    "contactsCount" INTEGER NOT NULL DEFAULT 0,
    "activeDealsCount" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "jobTitle" TEXT,
    "companyId" TEXT,
    "vertical" TEXT[],
    "subVertical" TEXT[],
    "geoZone" TEXT,
    "dealOwner" TEXT,
    "acquisitionSource" TEXT,
    "acquisitionSourceDetail" TEXT,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'new_lead',
    "icpFit" TEXT,
    "icpScore" INTEGER DEFAULT 0,
    "icpScoredAt" TIMESTAMP(3),
    "icpScoreBreakdown" JSONB,
    "contactType" TEXT NOT NULL DEFAULT 'prospect',
    "outreachGroup" TEXT,
    "companySize" TEXT,
    "fundingStage" TEXT,
    "techStack" TEXT[],
    "annualRevenueRange" TEXT,
    "country" TEXT,
    "city" TEXT,
    "lastInteraction" TIMESTAMP(3),
    "daysSinceLastContact" INTEGER,
    "nextScheduledMeeting" TIMESTAMP(3),
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeHours" DOUBLE PRECISION,
    "relationshipStrength" TEXT,
    "relationshipScore" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "pinnedNote" TEXT,
    "createdBy" TEXT,
    "introducerId" TEXT,
    "introducerVertical" TEXT[],
    "introducerGeo" TEXT,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "successfulReferrals" INTEGER NOT NULL DEFAULT 0,
    "referralSuccessRate" DOUBLE PRECISION DEFAULT 0,
    "lemlistCampaignId" TEXT,
    "lemlistCampaignName" TEXT,
    "lemlistStatus" TEXT,
    "lemlistStep" INTEGER,
    "lemlistTotalSteps" INTEGER,
    "lemlistEnrolledAt" TIMESTAMP(3),
    "telegram" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "dealName" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new_lead',
    "dealValue" DOUBLE PRECISION,
    "dealOwner" TEXT NOT NULL,
    "acquisitionSource" TEXT,
    "acquisitionSourceDetail" TEXT,
    "vertical" TEXT[],
    "expectedCloseDate" TIMESTAMP(3),
    "winProbability" DOUBLE PRECISION,
    "weightedValue" DOUBLE PRECISION,
    "lostReason" TEXT,
    "lostNotes" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "daysInCurrentStage" INTEGER NOT NULL DEFAULT 0,
    "daysSinceLastActivity" INTEGER NOT NULL DEFAULT 0,
    "aiDealHealth" TEXT,
    "aiDealHealthReason" TEXT,
    "aiDealHealthScoredAt" TIMESTAMP(3),
    "introducerId" TEXT,
    "conferenceName" TEXT,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookStep" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFollowUp" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dealId" TEXT,
    "reason" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "draftMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignee" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "metadata" JSONB,
    "performedBy" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "assignee" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outcomeNote" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "filterLogic" TEXT NOT NULL DEFAULT 'and',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "date" TIMESTAMP(3) NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "amountEur" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPeriod" TEXT,
    "paymentSource" TEXT,
    "bankAccountName" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "reimbursedTo" TEXT,
    "reimbursedDate" TIMESTAMP(3),
    "contactId" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBudget" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT 'oxen',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "iban" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'operating',
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceGoal" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "period" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMetrics" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "posts" INTEGER NOT NULL DEFAULT 0,
    "entity" TEXT NOT NULL DEFAULT 'oxen',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentComplianceCheck" (
    "id" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "targetAudience" TEXT,
    "jurisdictions" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overallRisk" TEXT,
    "score" INTEGER,
    "findings" JSONB,
    "summary" TEXT,
    "checkedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "sourceType" TEXT,
    "sourceFileName" TEXT,
    "sourceDriveId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingIntel" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "summary" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'medium',
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingIntel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "assignedTo" TEXT,
    "contactId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "slaResponseMinutes" INTEGER,
    "slaResolutionMinutes" INTEGER,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyIntel" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "employeeCount" TEXT,
    "revenue" TEXT,
    "headquarters" TEXT,
    "keyPeople" JSONB,
    "recentNews" JSONB,
    "ownership" JSONB,
    "creditRating" TEXT,
    "lastResearched" TIMESTAMP(3),
    "dataSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyIntel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingBrief" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "attendees" TEXT[],
    "briefContent" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "sentVia" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contactId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "actionable" BOOLEAN NOT NULL DEFAULT true,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "linkedTaskId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayPeriod" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "totalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'request',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vacationTotal" INTEGER NOT NULL DEFAULT 25,
    "vacationUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vacationPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sickTotal" INTEGER NOT NULL DEFAULT 10,
    "sickUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oooTotal" INTEGER NOT NULL DEFAULT 15,
    "oooUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRules" (
    "id" TEXT NOT NULL,
    "generalPolicy" TEXT,
    "vacationQuota" INTEGER NOT NULL DEFAULT 25,
    "vacationMinNotice" INTEGER NOT NULL DEFAULT 14,
    "vacationMaxConsecutive" INTEGER NOT NULL DEFAULT 15,
    "vacationCarryOver" INTEGER NOT NULL DEFAULT 5,
    "sickQuota" INTEGER NOT NULL DEFAULT 10,
    "sickCertAfterDays" INTEGER NOT NULL DEFAULT 3,
    "oooQuota" INTEGER NOT NULL DEFAULT 15,
    "oooMinNotice" INTEGER NOT NULL DEFAULT 3,
    "oooReasonRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvalTimeline" INTEGER NOT NULL DEFAULT 2,
    "blackoutPeriods" JSONB,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "gmailId" TEXT NOT NULL,
    "threadId" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "bodyText" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "labelIds" TEXT[],
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "syncedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentSignal" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelResearch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "query" TEXT,
    "sources" TEXT[],
    "keywords" TEXT[],
    "companies" TEXT[],
    "regions" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'english',
    "type" TEXT NOT NULL,
    "frequency" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "scheduledDay" TEXT,
    "scheduledTime" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelResult" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT,
    "sourceType" TEXT,
    "sentiment" TEXT,
    "relevance" TEXT NOT NULL DEFAULT 'medium',
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "country" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT,
    "intelResultId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "color" TEXT,
    "calendarEventId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceAttendee" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "reportSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "ticketCost" DOUBLE PRECISION DEFAULT 0,
    "hotelCost" DOUBLE PRECISION DEFAULT 0,
    "flightCost" DOUBLE PRECISION DEFAULT 0,
    "taxiCost" DOUBLE PRECISION DEFAULT 0,
    "mealsCost" DOUBLE PRECISION DEFAULT 0,
    "otherCost" DOUBLE PRECISION DEFAULT 0,
    "budgetNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenceAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceContact" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedin" TEXT,
    "telegram" TEXT,
    "notes" TEXT,
    "interest" TEXT,
    "followUpAction" TEXT,
    "addedToCrm" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    "collectedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenceContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceReport" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyTakeaways" JSONB,
    "marketInsights" TEXT,
    "competitorSightings" TEXT,
    "opportunities" TEXT,
    "recommendations" TEXT,
    "rating" INTEGER,
    "wikiPageId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "content" TEXT,
    "entityId" TEXT,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changelog" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "riskScore" INTEGER NOT NULL DEFAULT 9,
    "status" TEXT NOT NULL DEFAULT 'open',
    "mitigation" TEXT,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualScore" INTEGER,
    "ownerId" TEXT,
    "entityId" TEXT,
    "reviewDate" TIMESTAMP(3),
    "lastAssessedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "durationHours" DOUBLE PRECISION,
    "frequency" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "entityId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCompletion" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "certificateUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryLicense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "regulator" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grantedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "conditions" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "description" TEXT,
    "rootCause" TEXT,
    "remediation" TEXT,
    "entityId" TEXT,
    "reportedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "reportedToRegulator" BOOLEAN NOT NULL DEFAULT false,
    "regulatorRef" TEXT,
    "reportedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "financialImpact" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningRecord" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "screeningType" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'clear',
    "provider" TEXT,
    "matchDetails" JSONB,
    "contactId" TEXT,
    "riskLevel" TEXT,
    "notes" TEXT,
    "screenedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "nextScreeningDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveLink" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "iconUrl" TEXT,
    "category" TEXT,
    "contactId" TEXT,
    "wikiPageId" TEXT,
    "entityId" TEXT,
    "conferenceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "difficulty" INTEGER,
    "currentPosition" INTEGER,
    "previousPosition" INTEGER,
    "targetPosition" INTEGER DEFAULT 10,
    "rankingUrl" TEXT,
    "trend" TEXT,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rssUrl" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScanned" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "snippet" TEXT,
    "publishedAt" TIMESTAMP(3),
    "relevanceScore" INTEGER,
    "vertical" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "clusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metaDescription" TEXT,
    "content" TEXT NOT NULL,
    "vertical" TEXT[],
    "primaryKeyword" TEXT,
    "secondaryKeywords" TEXT[],
    "wordCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "sourceArticles" TEXT[],
    "organicSessions7d" INTEGER DEFAULT 0,
    "organicSessions30d" INTEGER DEFAULT 0,
    "keywordsRanking" INTEGER DEFAULT 0,
    "bestPosition" INTEGER,
    "backlinksEarned" INTEGER DEFAULT 0,
    "aiCitations" INTEGER DEFAULT 0,
    "schemaJson" JSONB,
    "socialPost" TEXT,
    "socialPosted" BOOLEAN NOT NULL DEFAULT false,
    "generatedBy" TEXT NOT NULL DEFAULT 'ai',
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoTestPrompt" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "lastTested" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoTestPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoTestResult" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "oxenCited" BOOLEAN NOT NULL DEFAULT false,
    "citationContext" TEXT,
    "competitorsCited" TEXT[],
    "fullResponse" TEXT,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "keywordId" TEXT,
    "promptId" TEXT,
    "articleId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_workspace',
    "status" TEXT NOT NULL DEFAULT 'warmup',
    "warmupStartDate" TIMESTAMP(3),
    "activeDate" TIMESTAMP(3),
    "spfValid" BOOLEAN NOT NULL DEFAULT false,
    "dkimValid" BOOLEAN NOT NULL DEFAULT false,
    "dmarcValid" BOOLEAN NOT NULL DEFAULT false,
    "trackingDomain" TEXT,
    "trackingValid" BOOLEAN NOT NULL DEFAULT false,
    "openRate" DOUBLE PRECISION,
    "replyRate" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION,
    "spamRate" DOUBLE PRECISION,
    "inboxPlacement" DOUBLE PRECISION,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistDetails" TEXT,
    "lastHealthCheck" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lemlistCampaignId" TEXT,
    "vertical" TEXT,
    "owner" TEXT NOT NULL,
    "domainId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "platform" TEXT NOT NULL DEFAULT 'lemlist',
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalReplied" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "repliesInterested" INTEGER NOT NULL DEFAULT 0,
    "repliesNotInterested" INTEGER NOT NULL DEFAULT 0,
    "repliesOoo" INTEGER NOT NULL DEFAULT 0,
    "meetingsBooked" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "addedBy" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "domainId" TEXT,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "processedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_slug_key" ON "WikiPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_googleEventId_calendarOwner_key" ON "CalendarEvent"("googleEventId", "calendarOwner");

-- CreateIndex
CREATE UNIQUE INDEX "CallNote_eventId_key" ON "CallNote"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CallNote_internalEventId_key" ON "CallNote"("internalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_email_key" ON "CrmContact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudget_category_month_entityId_key" ON "FinanceBudget"("category", "month", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMetrics_platform_date_entity_key" ON "SocialMetrics"("platform", "date", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingBrief_eventId_key" ON "MeetingBrief"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_year_key" ON "LeaveBalance"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Email_gmailId_key" ON "Email"("gmailId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceReport_conferenceId_key" ON "ConferenceReport"("conferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_code_key" ON "Policy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_code_key" ON "Risk"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Training_code_key" ON "Training"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCompletion_trainingId_employeeId_key" ON "TrainingCompletion"("trainingId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceIncident_code_key" ON "ComplianceIncident"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_keyword_key" ON "Keyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_url_key" ON "NewsItem"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachDomain_domain_key" ON "OutreachDomain"("domain");

-- CreateIndex
CREATE INDEX "OutreachDomain_owner_idx" ON "OutreachDomain"("owner");

-- CreateIndex
CREATE INDEX "OutreachDomain_status_idx" ON "OutreachDomain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachCampaign_lemlistCampaignId_key" ON "OutreachCampaign"("lemlistCampaignId");

-- CreateIndex
CREATE INDEX "OutreachCampaign_owner_idx" ON "OutreachCampaign"("owner");

-- CreateIndex
CREATE INDEX "OutreachCampaign_status_idx" ON "OutreachCampaign"("status");

-- CreateIndex
CREATE INDEX "OutreachCampaign_domainId_idx" ON "OutreachCampaign"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_email_key" ON "SuppressionEntry"("email");

-- CreateIndex
CREATE INDEX "SuppressionEntry_email_idx" ON "SuppressionEntry"("email");

-- CreateIndex
CREATE INDEX "SuppressionEntry_reason_idx" ON "SuppressionEntry"("reason");

-- CreateIndex
CREATE INDEX "OutreachAlert_resolved_severity_idx" ON "OutreachAlert"("resolved", "severity");

-- CreateIndex
CREATE INDEX "OutreachAlert_domainId_idx" ON "OutreachAlert"("domainId");

-- CreateIndex
CREATE INDEX "Job_status_type_idx" ON "Job"("status", "type");

-- CreateIndex
CREATE INDEX "Job_type_status_priority_idx" ON "Job"("type", "status", "priority");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgEntity" ADD CONSTRAINT "OrgEntity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WikiPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiVersion" ADD CONSTRAINT "WikiVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallNote" ADD CONSTRAINT "CallNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallNote" ADD CONSTRAINT "CallNote_internalEventId_fkey" FOREIGN KEY ("internalEventId") REFERENCES "InternalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_introducerId_fkey" FOREIGN KEY ("introducerId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookStep" ADD CONSTRAINT "PlaybookStep_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFollowUp" ADD CONSTRAINT "AIFollowUp_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFollowUp" ADD CONSTRAINT "AIFollowUp_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyIntel" ADD CONSTRAINT "CompanyIntel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBrief" ADD CONSTRAINT "MeetingBrief_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentSignal" ADD CONSTRAINT "IntentSignal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelResult" ADD CONSTRAINT "IntelResult_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "IntelResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceAttendee" ADD CONSTRAINT "ConferenceAttendee_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceAttendee" ADD CONSTRAINT "ConferenceAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceContact" ADD CONSTRAINT "ConferenceContact_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceContact" ADD CONSTRAINT "ConferenceContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceReport" ADD CONSTRAINT "ConferenceReport_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryLicense" ADD CONSTRAINT "RegulatoryLicense_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_wikiPageId_fkey" FOREIGN KEY ("wikiPageId") REFERENCES "WikiPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OrgEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoTestResult" ADD CONSTRAINT "GeoTestResult_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "GeoTestPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "OutreachDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

