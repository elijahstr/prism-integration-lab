import { expireLabSessions } from "@prism/database/lab";

export function expireSessions(): Promise<number> {
  return expireLabSessions();
}
