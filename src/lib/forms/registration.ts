// The masterclass registration template: answers about the person go to their CHII record; the rest stay with the registration.
export const MASTERCLASS_TEMPLATE_ID = "masterclass_series";

// Form question ids that describe the person, and the name each one is saved under.
const PROFILE_FIELDS: Record<string, string> = {
  institution: "institution",
  student_email: "student_email",
  personal_email: "email",
  full_name: "full_name",
  whatsapp: "phone",
  gender: "gender",
  nationality: "nationality",
  country_of_residence: "country_of_residence",
  humanitarian: "humanitarian",
  disability: "disability",
  residence: "residence",
  enrolment_status: "enrolment_status",
  programme: "programme",
  consent: "consent",
};

// Splits validated answers into the person's details and the registration's own answers.
export function splitRegistration(answers: Record<string, unknown>) {
  const profile: Record<string, unknown> = {};
  const registration: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    if (key in PROFILE_FIELDS) profile[PROFILE_FIELDS[key]] = value;
    else registration[key] = value;
  }
  return { profile, registration };
}
