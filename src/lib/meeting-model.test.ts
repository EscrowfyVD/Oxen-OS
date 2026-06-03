import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — AIRA F2 PR0 (+ PR3a). The Meeting model's scalar fields are frozen:
 * payload-mapped (attendees primary/owner, start/end, _id → lemcalBookingId,
 * eventId, questions) PLUS internal markers (status, meetingBriefId,
 * briefRefreshedAt, timestamps). Adding/removing a field breaks this on purpose:
 * any change must come with a migration. PR3a added `briefRefreshedAt` (the
 * 1h-before refresh dedupe marker). Same spirit as CrmGroup / configVersion.
 */
describe("Meeting model (AIRA F2 PR0 + PR3a)", () => {
  it("scalar fields are exactly the frozen set (payload + internal markers)", () => {
    expect(Object.values(Prisma.MeetingScalarFieldEnum).sort()).toEqual([
      "attendeeTimezone",
      "briefRefreshedAt",
      "contactId",
      "createdAt",
      "endTime",
      "googleEventId",
      "id",
      "lemcalBookingId",
      "meetingBriefId",
      "meetingTypeId",
      "meetingTypeName",
      "ownerEmail",
      "primaryEmail",
      "primaryName",
      "questions",
      "raw",
      "startTime",
      "status",
      "updatedAt",
    ])
  })
})
