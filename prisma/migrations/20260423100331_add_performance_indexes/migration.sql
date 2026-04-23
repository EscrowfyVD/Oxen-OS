-- CreateIndex
CREATE INDEX "AIFollowUp_contactId_idx" ON "AIFollowUp"("contactId");

-- CreateIndex
CREATE INDEX "AIFollowUp_dealId_idx" ON "AIFollowUp"("dealId");

-- CreateIndex
CREATE INDEX "AIInsight_dismissed_idx" ON "AIInsight"("dismissed");

-- CreateIndex
CREATE INDEX "AIInsight_contactId_idx" ON "AIInsight"("contactId");

-- CreateIndex
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");

-- CreateIndex
CREATE INDEX "Activity_dealId_idx" ON "Activity"("dealId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_type_createdAt_idx" ON "Activity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BankAccount_entity_isActive_idx" ON "BankAccount"("entity", "isActive");

-- CreateIndex
CREATE INDEX "CalendarEvent_startTime_idx" ON "CalendarEvent"("startTime");

-- CreateIndex
CREATE INDEX "ComplianceIncident_status_idx" ON "ComplianceIncident"("status");

-- CreateIndex
CREATE INDEX "ComplianceIncident_type_idx" ON "ComplianceIncident"("type");

-- CreateIndex
CREATE INDEX "ConferenceAttendee_conferenceId_idx" ON "ConferenceAttendee"("conferenceId");

-- CreateIndex
CREATE INDEX "CrmContact_companyId_idx" ON "CrmContact"("companyId");

-- CreateIndex
CREATE INDEX "CrmContact_lifecycleStage_idx" ON "CrmContact"("lifecycleStage");

-- CreateIndex
CREATE INDEX "CrmTask_contactId_idx" ON "CrmTask"("contactId");

-- CreateIndex
CREATE INDEX "CrmTask_dealId_idx" ON "CrmTask"("dealId");

-- CreateIndex
CREATE INDEX "CrmTask_status_idx" ON "CrmTask"("status");

-- CreateIndex
CREATE INDEX "CrmTask_dueDate_idx" ON "CrmTask"("dueDate");

-- CreateIndex
CREATE INDEX "Deal_contactId_idx" ON "Deal"("contactId");

-- CreateIndex
CREATE INDEX "Deal_companyId_idx" ON "Deal"("companyId");

-- CreateIndex
CREATE INDEX "Deal_stage_idx" ON "Deal"("stage");

-- CreateIndex
CREATE INDEX "Deal_dealOwner_idx" ON "Deal"("dealOwner");

-- CreateIndex
CREATE INDEX "Deal_stage_dealOwner_idx" ON "Deal"("stage", "dealOwner");

-- CreateIndex
CREATE INDEX "Deal_closedAt_idx" ON "Deal"("closedAt");

-- CreateIndex
CREATE INDEX "Deal_expectedCloseDate_idx" ON "Deal"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "Deal_aiDealHealth_idx" ON "Deal"("aiDealHealth");

-- CreateIndex
CREATE INDEX "Email_contactId_idx" ON "Email"("contactId");

-- CreateIndex
CREATE INDEX "Email_direction_date_idx" ON "Email"("direction", "date");

-- CreateIndex
CREATE INDEX "FinanceEntry_date_idx" ON "FinanceEntry"("date");

-- CreateIndex
CREATE INDEX "FinanceEntry_type_idx" ON "FinanceEntry"("type");

-- CreateIndex
CREATE INDEX "FinanceEntry_entity_idx" ON "FinanceEntry"("entity");

-- CreateIndex
CREATE INDEX "FinanceTransaction_date_idx" ON "FinanceTransaction"("date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_type_idx" ON "FinanceTransaction"("type");

-- CreateIndex
CREATE INDEX "FinanceTransaction_entity_idx" ON "FinanceTransaction"("entity");

-- CreateIndex
CREATE INDEX "PlaybookStep_dealId_idx" ON "PlaybookStep"("dealId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "Task_column_idx" ON "Task"("column");

