import { activityDatabase } from './activity-store';
import type { ActivityFilters } from './activity-model';
import type { SQLInputValue } from 'node:sqlite';
export function outreachReport(filters: ActivityFilters, includeStaff = false) {
  const values: SQLInputValue[] = [filters.from, filters.to];
  let where = `WHERE day>=? AND day<=? AND audience IN ('preview_entry','agency_preview'${includeStaff ? ",'rp_staff'" : ''})`;
  if (filters.agency) {
    where += ' AND agency=?';
    values.push(filters.agency);
  }
  const db = activityDatabase();
  const agencies = db
    .prepare(`SELECT agency, COUNT(DISTINCT visitId) visits,
    SUM(type='page_view') views, SUM(type='preview_login') logins,
    SUM(type='page_view' AND path LIKE '%/administration') editors,
    SUM(type='preview_save') saves, SUM(type='implementation_request') requests,
    GROUP_CONCAT(DISTINCT CASE WHEN type='page_view' AND layout!='' THEN layout END) layouts,
    MAX(createdAt) lastSeen FROM events ${where} GROUP BY agency`)
    .all(...values) as {
    agency: string;
    visits: number;
    views: number;
    logins: number;
    editors: number;
    saves: number;
    requests: number;
    layouts: string | null;
    lastSeen: number;
  }[];
  const pages = db
    .prepare(`SELECT agency,path,layout,SUM(type='page_view') views,COUNT(DISTINCT visitId) visits
    FROM events ${where} AND type='page_view' GROUP BY agency,path,layout ORDER BY views DESC LIMIT 100`)
    .all(...values) as {
    agency: string;
    path: string;
    layout: string;
    views: number;
    visits: number;
  }[];
  const sessions = db
    .prepare(`SELECT agency,visitId,MIN(createdAt) firstSeen,MAX(createdAt) lastSeen,
    SUM(type='page_view') views,SUM(type='preview_save') saves,SUM(type='implementation_request') requests,
    GROUP_CONCAT(DISTINCT source) sources, GROUP_CONCAT(DISTINCT campaign) campaigns,
    GROUP_CONCAT(DISTINCT audience) audiences FROM events ${where}
    GROUP BY agency,visitId ORDER BY lastSeen DESC LIMIT 50`)
    .all(...values) as {
    agency: string;
    visitId: string;
    firstSeen: number;
    lastSeen: number;
    views: number;
    saves: number;
    requests: number;
    sources: string;
    campaigns: string;
    audiences: string;
  }[];
  return { agencies, pages, sessions };
}
