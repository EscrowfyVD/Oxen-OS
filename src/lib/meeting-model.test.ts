import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — AIRA F2 PR0. The Meeting model's scalar fields are frozen from the
 * real LemCal webhook payload (attendees primary/owner, start/end, _id →
 * lemcalBookingId, eventId, questions). Adding/removing a field breaks this on
 * purpose: any change must come with a migration + a matching PR2 webhook
 * mapping. Same spirit as the CrmGroup / configVersion sentinels.
 */
describe("Meeting model (AIRA F2 PR0)", () => {
  it("scalar fields are exactly the frozen LemCal-payload set", () => {
    expect(Object.values(Prisma.MeetingScalarFieldEnum).sort()).toEqual([
      "attendeeTimezone",
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
