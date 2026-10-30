// Message templates from the prototype's notifyText(). Staff copy these to participants for now;
// sending is handled in milestone 7 (SPEC §9).
import type { EntryStatus } from "./sessions/status";

export type NotifyInput = {
  firstName: string;
  pid: string;
  sessionTitle: string;
  interventionName: string;
  pillar: string;
  datesText: string;
  venue: string | null;
  deadline: string | null;
  status: EntryStatus;
};

export function notifyText(i: NotifyInput) {
  const body: Partial<Record<EntryStatus, string>> = {
    selected: `Congratulations! You have been selected for ${i.sessionTitle} (${i.interventionName}, ${i.pillar}). The programme runs ${i.datesText}. Please confirm your place by replying to this message.`,
    shortlisted: `Thank you for applying to ${i.sessionTitle}. You have been shortlisted, and we will contact you with next steps shortly.`,
    waitlisted: `Thank you for your interest in ${i.sessionTitle}. You are currently on the waitlist, and we will let you know if a place becomes available.`,
    rejected: `Thank you for applying to ${i.sessionTitle}. After careful review we are not able to offer you a place this time. We encourage you to apply for future ${i.interventionName} opportunities.`,
    registered: `You are registered for ${i.sessionTitle} on ${i.datesText}${i.venue ? ` at ${i.venue}` : ""}. Please scan the check-in QR code when you arrive.`,
    applied: `Thank you for applying to ${i.sessionTitle}. We have received your application and will be in touch after ${i.deadline ?? "the deadline"}.`,
  };
  const text = body[i.status] ?? `Update on ${i.sessionTitle}.`;
  return `Dear ${i.firstName},\n\n${text}\n\nYour participant ID is ${i.pid}.\n\nBest regards,\n${i.pillar} team`;
}
