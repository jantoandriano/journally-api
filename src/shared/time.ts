/**
 * Start of the server's current local day. The feeding log is a per-day
 * record: "fed" means "has a feeding entry since this instant".
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
