import { randomUUID } from "crypto";

export const VISITOR_COOKIE_NAME =
  "rugreflex_visitor_id";

export function createVisitorId(): string {
  return `rr_${randomUUID()}`;
}
