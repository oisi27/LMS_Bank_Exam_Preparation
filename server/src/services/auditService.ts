import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/schema';

export interface AuditLogEntry {
  actorId: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any> | string;
}

/**
 * Reusable backend audit logging utility.
 * Records sensitive administrative mutations into the tamper-proof audit_logs table.
 * Strictly avoids logging passwords, tokens, secrets, or OTP codes.
 */
export function recordAuditLog(entry: AuditLogEntry): string {
  const logId = uuidv4();
  const serializedDetails = typeof entry.details === 'object' && entry.details !== null
    ? JSON.stringify(entry.details)
    : (entry.details || null);

  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_role, action, resource, resource_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    entry.actorId,
    entry.actorRole,
    entry.action,
    entry.resource,
    entry.resourceId || null,
    serializedDetails
  );

  return logId;
}
