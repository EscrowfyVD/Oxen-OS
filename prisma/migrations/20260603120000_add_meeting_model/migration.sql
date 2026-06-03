-- AIRA F2 PR0 — add the Meeting model (LemCal bookings).
--
-- Purely ADDITIVE: a new table + two indexes + an FK to CrmContact
-- (ON DELETE SET NULL — a Meeting outlives a contact deletion; contactId is
-- nullable for the no-match "option (a)" path). 0-ROW-SAFE: new empty table,
-- no rewrite of any existing table, no locking column default. The webhook
-- that populates it is PR2.

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "lemcalBookingId" TEXT NOT NULL,
    "meetingTypeId" TEXT,
    "meetingTypeName" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "primaryEmail" TEXT NOT NULL,
    "primaryName" TEXT,
    "ownerEmail" TEXT,
    "attendeeTimezone" TEXT,
    "googleEventId" TEXT,
    "questions" JSONB,
    "contactId" TEXT,
    "meetingBriefId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_lemcalBookingId_key" ON "Meeting"("lemcalBookingId");

-- CreateIndex
CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
