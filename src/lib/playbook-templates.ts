/* ── Guided Sales Playbook — Step Templates per Pipeline Stage ── */

export const PLAYBOOK_TEMPLATES: Record<
  string,
  Array<{ title: string; description?: string; isBlocking?: boolean }>
> = {
  new_lead: [
    { title: "Verify contact information is complete" },
    { title: "Check for duplicate contacts" },
    { title: "Assign correct vertical and geo zone" },
  ],
  sequence_active: [
    { title: "Verify Clay enrichment is complete" },
    { title: "Review outreach sequence content" },
    { title: "Confirm email deliverability" },
  ],
  replied: [
    { title: "Review reply within 24h", isBlocking: true },
    { title: "Classify reply sentiment (positive/neutral/negative)" },
    { title: "Draft personalized response" },
    { title: "Send response", isBlocking: true },
  ],
  meeting_booked: [
    { title: "Complete pre-meeting brief (or let Sentinel generate one)" },
    { title: "Review client's company profile" },
    { title: "Check for any support tickets" },
    { title: "Prepare talking points and proposal outline" },
  ],
  meeting_completed: [
    { title: "Log meeting summary notes within 24h", isBlocking: true },
    { title: "Send follow-up email within 48h", isBlocking: true },
    { title: "Update deal value if discussed" },
    { title: "Create follow-up tasks" },
  ],
  proposal_sent: [
    { title: "Confirm proposal received (email open/reply)" },
    { title: "Schedule follow-up call within 5 business days" },
    { title: "Prepare objection handling notes" },
  ],
  negotiation: [
    { title: "Document agreed terms" },
    { title: "Get internal approval on any custom pricing" },
    { title: "Prepare final agreement/contract", isBlocking: true },
    { title: "Set expected close date" },
  ],
  closed_won: [
    { title: "Initiate KYC onboarding handoff to compliance", isBlocking: true },
    { title: "Send welcome email to client" },
    { title: "Create onboarding task checklist" },
    { title: "Update CRM contact lifecycle to client" },
    { title: "Notify team via Telegram" },
  ],
  closed_lost: [
    { title: "Document lost reason and notes", isBlocking: true },
    { title: "Send professional close-out email" },
    { title: "Schedule re-engage task for 6 months" },
  ],
}
