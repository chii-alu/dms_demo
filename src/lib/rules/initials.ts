// Mirrors public.intervention_initials() in the migrations. Keep the two in step (tests check examples).
export function interventionInitials(name: string) {
  return name
    .replace(/&/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

export function formCode(
  pillar: string,
  interventionName: string,
  seq: number,
  suffix: "REG" | "APP" | "ATT" | "FBK",
) {
  return `${pillar}-${interventionInitials(interventionName)}-${String(seq).padStart(3, "0")}-${suffix}`;
}
