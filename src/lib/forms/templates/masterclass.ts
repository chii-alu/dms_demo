// The masterclass registration template (Masterclass Series: Startup Finance).
// Branches on institution: ALU students give their student email, and the personal email and residence
// are always asked. ALX and Other answer all of "About you". Section B is the same for everyone.
import type { FieldSpec } from "../fields";

const ALU_ONLY = { id: "institution", equals: ["ALU"] };
const NOT_ALU = { id: "institution", equals: ["ALX", "Other"] };

export const MASTERCLASS_SESSIONS = [
  "Budgeting, Cash Flow & Startup Finance (Fri 30 Oct)",
  "Financial Projections & Decision Making (Fri 6 Nov)",
  "Funding Strategy & Investor/Grant Readiness (Fri 13 Nov)",
  "Financial Storytelling, Pitching & Finance Clinic (Fri 20 Nov)",
];

export const MASTERCLASS_TEMPLATE: FieldSpec[] = [
  // Section A: About you
  {
    id: "institution",
    label: "Which institution are you affiliated with?",
    type: "single",
    required: true,
    options: ["ALU", "ALX", "Other"],
  },
  { id: "institution_other", label: "Name of your institution", type: "text", required: true, showWhen: { id: "institution", equals: ["Other"] } },
  { id: "student_email", label: "Student email address", type: "email", required: true, showWhen: ALU_ONLY },

  // Asked of everyone, so ALU students give their personal email, WhatsApp number and residence too.
  { id: "personal_email", label: "Personal email address", type: "email", required: true },
  {
    id: "whatsapp",
    label: "WhatsApp phone number (with country code, e.g. +250 784 650 219)",
    type: "text",
    required: true,
  },
  {
    id: "residence",
    label: "Which best describes the location of your primary residence?",
    type: "single",
    required: true,
    options: ["Rural", "Urban", "Peri Urban"],
  },

  // The rest of About you: ALX and Other only.
  { id: "full_name", label: "Full name", type: "text", required: true, showWhen: NOT_ALU },
  {
    id: "gender",
    label: "How do you describe your gender?",
    type: "single",
    required: true,
    options: ["Female", "Male", "Non-binary"],
    showWhen: NOT_ALU,
  },
  { id: "year_of_birth", label: "Year of birth (yyyy)", type: "number", required: true, showWhen: NOT_ALU },
  {
    id: "enrolment_status",
    label: "What is your enrolment status?",
    type: "single",
    required: true,
    options: ["Current student", "Graduate"],
    showWhen: NOT_ALU,
  },
  { id: "programme", label: "Program / area of study", type: "text", required: true, showWhen: NOT_ALU },
  { id: "enrolment_year", label: "Enrolment year (yyyy)", type: "number", required: true, showWhen: NOT_ALU },
  { id: "nationality", label: "Nationality", type: "text", required: true, showWhen: NOT_ALU },
  { id: "country_of_residence", label: "Country of residence", type: "text", required: true, showWhen: NOT_ALU },

  // Inclusion
  {
    id: "disability",
    label: "Do you identify as a person living with a disability?",
    type: "single",
    required: true,
    options: ["Yes", "No"],
    showWhen: NOT_ALU,
  },
  {
    id: "humanitarian",
    label: "Which of the following humanitarian statuses do you identify with?",
    type: "single",
    required: true,
    options: ["Refugee", "Asylum seeker", "Internally Displaced Person (IDP)", "None"],
    showWhen: NOT_ALU,
  },
  {
    id: "current_status",
    label: "Which best describes your current status?",
    type: "single",
    required: true,
    options: ["Wage Employment", "Self-employed / Entrepreneur", "Freelance", "Unemployed", "Student", "Pursuing further education"],
    showWhen: NOT_ALU,
  },

  {
    id: "consent",
    label: "I consent to my information being used to run this programme and for monitoring, evaluation and learning.",
    type: "consent",
    required: true,
  },

  // Section B: The masterclass
  {
    id: "sessions",
    label: "Which masterclasses would you like to register for?",
    type: "multi",
    required: true,
    options: MASTERCLASS_SESSIONS,
  },
  {
    id: "knowledge",
    label: "How would you describe your current knowledge of startup finance?",
    type: "single",
    required: true,
    options: [
      "None: I have no experience with budgeting or financial planning",
      "Beginner: I understand the basics",
      "Intermediate: I have made a budget, cash flow plan or financial projection",
      "Advanced: I regularly manage budgets, projections or fundraising for a venture",
    ],
  },
  { id: "hope", label: "What is one thing you hope to gain from this masterclass series?", type: "long", required: true },
];
