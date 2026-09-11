import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuditLogRow } from '@/types/database';

export interface AuditLogEntry extends AuditLogRow {
  /** null for a system job (no user_id) or a since-deleted profile. */
  actorName: string | null;
}

/**
 * The most recent audit_logs rows, newest first, with each row's actor name
 * resolved from profiles. Two queries rather than an embedded join --
 * PostgREST has no FK from audit_logs.user_id to profiles to embed through.
 */
export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!logs || logs.length === 0) return [];

  const userIds = [...new Set(logs.map((log) => log.user_id).filter((id) => id !== null))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return logs.map((log) => ({
    ...log,
    actorName: log.user_id ? (nameById.get(log.user_id) ?? null) : null,
  }));
}
