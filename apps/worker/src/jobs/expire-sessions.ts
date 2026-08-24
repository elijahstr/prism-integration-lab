import { expireLabSessions } from "../../../../packages/database/src/lab";

export function expireSessions(): Promise<number> {
  return expireLabSessions();
}
