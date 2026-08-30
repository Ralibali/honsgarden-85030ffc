const DAY_MS = 24 * 60 * 60 * 1000;

export type GrowthStatus = 'active' | 'at_risk' | 'dormant' | 'never_activated';
export type RetentionKey = 'd1' | 'd7' | 'd30';

export interface GrowthProfile {
  user_id: string;
  created_at: string;
  subscription_status?: string | null;
}

export interface GrowthPageView {
  user_id: string | null;
  created_at: string;
  path?: string | null;
}

export interface GrowthEggLog {
  user_id: string;
  date: string;
  created_at?: string | null;
}

export interface GrowthHen {
  user_id: string;
  created_at: string;
}

export interface GrowthChoreCompletion {
  user_id: string;
  completed_date: string;
}

export interface GrowthChangeMarker {
  id: string;
  label: string;
  occurred_at: string;
  source: 'github' | 'manual';
  url?: string;
}

export interface RetentionSummary {
  eligible: number;
  retained: number;
  pct: number | null;
}

export interface CohortRow {
  week: string;
  signups: number;
  firstHen7Pct: number | null;
  firstEgg7Pct: number | null;
  d1: RetentionSummary;
  d7: RetentionSummary;
  d30: RetentionSummary;
}

export interface FunnelStep {
  key: 'signup' | 'first_hen' | 'first_egg' | 'active_7d';
  label: string;
  count: number;
  pctOfSignup: number;
  dropFromPreviousPct: number | null;
}

export interface WeeklyMetricPoint {
  weekStart: string;
  activeUsers: number;
  signups: number;
  firstEggActivations: number;
  eggLoggingUsers: number;
}

export interface GrowthAnomaly {
  metric: keyof Omit<WeeklyMetricPoint, 'weekStart'>;
  label: string;
  before: number;
  after: number;
  deltaPct: number;
  direction: 'up' | 'down';
  severity: 'medium' | 'high';
  confidence: 'medium' | 'high';
}

export interface ChangeCorrelation {
  id: string;
  label: string;
  occurredAt: string;
  source: GrowthChangeMarker['source'];
  url?: string;
  status: 'positive' | 'negative' | 'flat' | 'insufficient_data';
  activeUsersBefore: number | null;
  activeUsersAfter: number | null;
  deltaPct: number | null;
  confounded: boolean;
  note: string;
}

export interface GrowthBrief {
  headline: string;
  confidence: 'low' | 'medium' | 'high';
  signals: string[];
  actions: string[];
}

export interface GrowthIntelligenceInput {
  profiles: GrowthProfile[];
  pageViews: GrowthPageView[];
  eggLogs: GrowthEggLog[];
  hens: GrowthHen[];
  choreCompletions: GrowthChoreCompletion[];
  changes?: GrowthChangeMarker[];
  now?: string | Date;
  observationStart?: string | Date;
}

export interface GrowthIntelligenceResult {
  generatedAt: string;
  observationStart: string;
  summary: {
    totalUsers: number;
    cohortUsers: number;
    active7d: number;
    atRisk8to30d: number;
    dormant30dPlus: number;
    neverActivated: number;
    premiumAtRiskOrDormant: number;
  };
  retention: Record<RetentionKey, RetentionSummary>;
  cohorts: CohortRow[];
  funnel: FunnelStep[];
  biggestLeak: FunnelStep | null;
  weekly: WeeklyMetricPoint[];
  anomalies: GrowthAnomaly[];
  changeCorrelations: ChangeCorrelation[];
  brief: GrowthBrief;
  warnings: string[];
}

type ActivityKind = 'page_view' | 'egg' | 'hen' | 'chore';
interface ActivityPoint {
  userId: string;
  at: Date;
  kind: ActivityKind;
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnly(value: string): Date | null {
  return asDate(`${value}T12:00:00Z`);
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfIsoWeek(date: Date): Date {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function normalizeActivities(input: GrowthIntelligenceInput): ActivityPoint[] {
  const out: ActivityPoint[] = [];

  for (const pv of input.pageViews) {
    if (!pv.user_id || !pv.path?.startsWith('/app') || pv.path.startsWith('/app/admin')) continue;
    const at = asDate(pv.created_at);
    if (at) out.push({ userId: pv.user_id, at, kind: 'page_view' });
  }

  for (const egg of input.eggLogs) {
    const at = asDate(egg.created_at) ?? dateOnly(egg.date);
    if (at) out.push({ userId: egg.user_id, at, kind: 'egg' });
  }

  for (const hen of input.hens) {
    const at = asDate(hen.created_at);
    if (at) out.push({ userId: hen.user_id, at, kind: 'hen' });
  }

  for (const chore of input.choreCompletions) {
    const at = dateOnly(chore.completed_date);
    if (at) out.push({ userId: chore.user_id, at, kind: 'chore' });
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out;
}

function mapByUser(activities: ActivityPoint[]): Map<string, ActivityPoint[]> {
  const map = new Map<string, ActivityPoint[]>();
  for (const activity of activities) {
    const list = map.get(activity.userId) ?? [];
    list.push(activity);
    map.set(activity.userId, list);
  }
  return map;
}

function firstDateByUser<T extends { user_id: string }>(
  rows: T[],
  dateGetter: (row: T) => Date | null,
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const row of rows) {
    const date = dateGetter(row);
    if (!date) continue;
    const current = map.get(row.user_id);
    if (!current || date < current) map.set(row.user_id, date);
  }
  return map;
}

const RETENTION_WINDOWS: Record<RetentionKey, { min: number; maxExclusive: number }> = {
  d1: { min: 1, maxExclusive: 3 },
  d7: { min: 6, maxExclusive: 9 },
  d30: { min: 27, maxExclusive: 34 },
};

function retentionForProfiles(
  profiles: GrowthProfile[],
  key: RetentionKey,
  now: Date,
  activitiesByUser: Map<string, ActivityPoint[]>,
): RetentionSummary {
  const window = RETENTION_WINDOWS[key];
  let eligible = 0;
  let retained = 0;

  for (const profile of profiles) {
    const signup = asDate(profile.created_at);
    if (!signup) continue;
    const accountAge = daysBetween(now, signup);
    if (accountAge < window.maxExclusive) continue;
    eligible += 1;

    const activities = activitiesByUser.get(profile.user_id) ?? [];
    const hit = activities.some((activity) => {
      const age = daysBetween(activity.at, signup);
      return age >= window.min && age < window.maxExclusive;
    });
    if (hit) retained += 1;
  }

  return { eligible, retained, pct: pct(retained, eligible) };
}

function metricWindow(
  start: Date,
  end: Date,
  profiles: GrowthProfile[],
  activities: ActivityPoint[],
  firstEggByUser: Map<string, Date>,
): Omit<WeeklyMetricPoint, 'weekStart'> {
  const inside = (date: Date) => date >= start && date < end;
  const activeUsers = new Set(activities.filter((a) => inside(a.at)).map((a) => a.userId)).size;
  const signups = profiles.filter((p) => {
    const d = asDate(p.created_at);
    return d ? inside(d) : false;
  }).length;
  const firstEggActivations = [...firstEggByUser.values()].filter(inside).length;
  const eggLoggingUsers = new Set(
    activities.filter((a) => a.kind === 'egg' && inside(a.at)).map((a) => a.userId),
  ).size;

  return { activeUsers, signups, firstEggActivations, eggLoggingUsers };
}

function anomalyLabel(metric: GrowthAnomaly['metric']): string {
  const labels: Record<GrowthAnomaly['metric'], string> = {
    activeUsers: 'Aktiva användare',
    signups: 'Nya registreringar',
    firstEggActivations: 'Första ägget-aktiveringar',
    eggLoggingUsers: 'Användare som loggar ägg',
  };
  return labels[metric];
}

function buildAnomalies(previous: WeeklyMetricPoint, current: WeeklyMetricPoint): GrowthAnomaly[] {
  const metrics: GrowthAnomaly['metric'][] = [
    'activeUsers',
    'signups',
    'firstEggActivations',
    'eggLoggingUsers',
  ];
  const anomalies: GrowthAnomaly[] = [];

  for (const metric of metrics) {
    const before = previous[metric];
    const after = current[metric];
    const absDelta = after - before;
    if (Math.abs(absDelta) < 2) continue;
    if (before < 3 && after < 3) continue;
    const deltaPct = before === 0 ? (after > 0 ? 100 : 0) : Math.round((absDelta / before) * 100);
    if (Math.abs(deltaPct) < 25) continue;

    anomalies.push({
      metric,
      label: anomalyLabel(metric),
      before,
      after,
      deltaPct,
      direction: deltaPct >= 0 ? 'up' : 'down',
      severity: Math.abs(deltaPct) >= 40 ? 'high' : 'medium',
      confidence: Math.max(before, after) >= 10 ? 'high' : 'medium',
    });
  }

  return anomalies.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

function correlateChanges(
  changes: GrowthChangeMarker[],
  now: Date,
  observationStart: Date,
  profiles: GrowthProfile[],
  activities: ActivityPoint[],
  firstEggByUser: Map<string, Date>,
): ChangeCorrelation[] {
  const validChanges = changes
    .map((change) => ({ change, at: asDate(change.occurred_at) }))
    .filter((row): row is { change: GrowthChangeMarker; at: Date } => !!row.at)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return validChanges.map(({ change, at }) => {
    const beforeStart = new Date(at.getTime() - 7 * DAY_MS);
    const afterEnd = new Date(at.getTime() + 7 * DAY_MS);
    const confounded = validChanges.some(
      (other) => other.change.id !== change.id && Math.abs(other.at.getTime() - at.getTime()) <= 3 * DAY_MS,
    );

    if (beforeStart < observationStart || afterEnd > now) {
      return {
        id: change.id,
        label: change.label,
        occurredAt: change.occurred_at,
        source: change.source,
        url: change.url,
        status: 'insufficient_data',
        activeUsersBefore: null,
        activeUsersAfter: null,
        deltaPct: null,
        confounded,
        note: 'Behöver en komplett 7-dagarsperiod både före och efter ändringen.',
      };
    }

    const before = metricWindow(beforeStart, at, profiles, activities, firstEggByUser);
    const after = metricWindow(at, afterEnd, profiles, activities, firstEggByUser);
    if (before.activeUsers < 3 && after.activeUsers < 3) {
      return {
        id: change.id,
        label: change.label,
        occurredAt: change.occurred_at,
        source: change.source,
        url: change.url,
        status: 'insufficient_data',
        activeUsersBefore: before.activeUsers,
        activeUsersAfter: after.activeUsers,
        deltaPct: null,
        confounded,
        note: 'För litet aktivitetsunderlag för en meningsfull före/efter-signal.',
      };
    }

    const deltaPct = before.activeUsers === 0
      ? (after.activeUsers > 0 ? 100 : 0)
      : Math.round(((after.activeUsers - before.activeUsers) / before.activeUsers) * 100);
    const status: ChangeCorrelation['status'] = deltaPct >= 20
      ? 'positive'
      : deltaPct <= -20
        ? 'negative'
        : 'flat';

    return {
      id: change.id,
      label: change.label,
      occurredAt: change.occurred_at,
      source: change.source,
      url: change.url,
      status,
      activeUsersBefore: before.activeUsers,
      activeUsersAfter: after.activeUsers,
      deltaPct,
      confounded,
      note: confounded
        ? 'Korrelation, inte kausalitet. Flera kodändringar ligger nära i tid.'
        : 'Korrelation, inte kausalitet. Använd som signal för vad som ska undersökas.',
    };
  });
}

function buildBrief(
  summary: GrowthIntelligenceResult['summary'],
  retention: GrowthIntelligenceResult['retention'],
  biggestLeak: FunnelStep | null,
  anomalies: GrowthAnomaly[],
  cohortUsers: number,
  activities: ActivityPoint[],
  now: Date,
): GrowthBrief {
  const recentActivity = new Set(
    activities.filter((a) => a.at >= new Date(now.getTime() - 14 * DAY_MS)).map((a) => a.userId),
  ).size;
  const confidence: GrowthBrief['confidence'] = cohortUsers >= 50 && recentActivity >= 20
    ? 'high'
    : cohortUsers >= 20 && recentActivity >= 8
      ? 'medium'
      : 'low';

  const negative = anomalies.find((a) => a.direction === 'down');
  const positive = anomalies.find((a) => a.direction === 'up');
  let headline = 'Tillräckligt stabilt för att fortsätta samla data utan panikändringar.';
  if (negative) headline = `${negative.label} har fallit ${Math.abs(negative.deltaPct)}% mot föregående avslutade vecka.`;
  else if (biggestLeak && (biggestLeak.dropFromPreviousPct ?? 0) >= 30) headline = `Största produktläckan är vid ${biggestLeak.label.toLowerCase()}.`;
  else if (positive) headline = `${positive.label} har ökat ${positive.deltaPct}% mot föregående avslutade vecka.`;

  const signals: string[] = [];
  if (biggestLeak?.dropFromPreviousPct != null) {
    signals.push(`${biggestLeak.dropFromPreviousPct}% tapp i steget till ${biggestLeak.label.toLowerCase()}.`);
  }
  if (retention.d7.pct != null) signals.push(`D7-retention: ${retention.d7.pct}% (${retention.d7.retained}/${retention.d7.eligible}).`);
  if (summary.atRisk8to30d > 0) signals.push(`${summary.atRisk8to30d} användare är i riskzonen 8–30 dagar utan aktivitet.`);
  if (summary.premiumAtRiskOrDormant > 0) signals.push(`${summary.premiumAtRiskOrDormant} Plus-användare är i risk/dormant-läge.`);
  for (const anomaly of anomalies.slice(0, 2)) {
    signals.push(`${anomaly.label}: ${anomaly.before} → ${anomaly.after} (${anomaly.deltaPct > 0 ? '+' : ''}${anomaly.deltaPct}%).`);
  }

  const actions: string[] = [];
  if (biggestLeak?.key === 'first_hen' && (biggestLeak.dropFromPreviousPct ?? 0) >= 25) {
    actions.push('Prioritera onboarding till första hönan före fler nya funktioner.');
  }
  if (biggestLeak?.key === 'first_egg' && (biggestLeak.dropFromPreviousPct ?? 0) >= 25) {
    actions.push('Attackera friktionen mellan första hönan och första äggloggen.');
  }
  if (retention.d7.eligible >= 10 && (retention.d7.pct ?? 100) < 35) {
    actions.push('Testa en starkare D3–D7-retentionloop och mät mot nästa mogna cohort.');
  }
  if (negative) actions.push(`Undersök vad som ändrades före fallet i ${negative.label.toLowerCase()} innan ny feature-build.`);
  if (summary.premiumAtRiskOrDormant > 0) actions.push('Prioritera varsam återaktivering av riskutsatta Plus-användare.');
  if (!actions.length) actions.push('Behåll nuvarande flöde och invänta mer data innan större produktändring.');

  return { headline, confidence, signals: signals.slice(0, 5), actions: actions.slice(0, 3) };
}

export function buildGrowthIntelligence(input: GrowthIntelligenceInput): GrowthIntelligenceResult {
  const now = asDate(input.now ?? new Date()) ?? new Date();
  const observationStart = asDate(input.observationStart)
    ?? new Date(now.getTime() - 365 * DAY_MS);
  const activities = normalizeActivities(input).filter((a) => a.at >= observationStart && a.at <= now);
  const activitiesByUser = mapByUser(activities);

  const firstHenByUser = firstDateByUser(input.hens, (row) => asDate(row.created_at));
  const firstEggByUser = firstDateByUser(input.eggLogs, (row) => asDate(row.created_at) ?? dateOnly(row.date));

  const validProfiles = input.profiles.filter((p) => {
    const created = asDate(p.created_at);
    return !!created && created <= now;
  });
  const cohortProfiles = validProfiles.filter((p) => {
    const created = asDate(p.created_at)!;
    return created >= observationStart;
  });

  const userStatus = new Map<string, GrowthStatus>();
  let active7d = 0;
  let atRisk8to30d = 0;
  let dormant30dPlus = 0;
  let neverActivated = 0;
  let premiumAtRiskOrDormant = 0;

  for (const profile of validProfiles) {
    const activated = firstHenByUser.has(profile.user_id) || firstEggByUser.has(profile.user_id);
    let status: GrowthStatus;
    if (!activated) {
      status = 'never_activated';
      neverActivated += 1;
    } else {
      const list = activitiesByUser.get(profile.user_id) ?? [];
      const last = list.length ? list[list.length - 1].at : null;
      const days = last ? daysBetween(now, last) : Number.POSITIVE_INFINITY;
      if (days <= 7) {
        status = 'active';
        active7d += 1;
      } else if (days <= 30) {
        status = 'at_risk';
        atRisk8to30d += 1;
      } else {
        status = 'dormant';
        dormant30dPlus += 1;
      }
    }
    if (profile.subscription_status === 'premium' && (status === 'at_risk' || status === 'dormant')) {
      premiumAtRiskOrDormant += 1;
    }
    userStatus.set(profile.user_id, status);
  }

  const retention: Record<RetentionKey, RetentionSummary> = {
    d1: retentionForProfiles(cohortProfiles, 'd1', now, activitiesByUser),
    d7: retentionForProfiles(cohortProfiles, 'd7', now, activitiesByUser),
    d30: retentionForProfiles(cohortProfiles, 'd30', now, activitiesByUser),
  };

  const cohortMap = new Map<string, GrowthProfile[]>();
  for (const profile of cohortProfiles) {
    const created = asDate(profile.created_at)!;
    const key = isoDay(startOfIsoWeek(created));
    const rows = cohortMap.get(key) ?? [];
    rows.push(profile);
    cohortMap.set(key, rows);
  }

  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, profiles]) => {
      let firstHen7 = 0;
      let firstEgg7 = 0;
      for (const profile of profiles) {
        const signup = asDate(profile.created_at)!;
        const hen = firstHenByUser.get(profile.user_id);
        const egg = firstEggByUser.get(profile.user_id);
        if (hen) {
          const age = daysBetween(hen, signup);
          if (age >= 0 && age < 7) firstHen7 += 1;
        }
        if (egg) {
          const age = daysBetween(egg, signup);
          if (age >= 0 && age < 7) firstEgg7 += 1;
        }
      }
      return {
        week,
        signups: profiles.length,
        firstHen7Pct: pct(firstHen7, profiles.length),
        firstEgg7Pct: pct(firstEgg7, profiles.length),
        d1: retentionForProfiles(profiles, 'd1', now, activitiesByUser),
        d7: retentionForProfiles(profiles, 'd7', now, activitiesByUser),
        d30: retentionForProfiles(profiles, 'd30', now, activitiesByUser),
      };
    });

  const signupCount = cohortProfiles.length;
  const firstHenCount = cohortProfiles.filter((p) => firstHenByUser.has(p.user_id)).length;
  const firstEggCount = cohortProfiles.filter((p) => firstEggByUser.has(p.user_id)).length;
  const activeActivatedCount = cohortProfiles.filter(
    (p) => firstEggByUser.has(p.user_id) && userStatus.get(p.user_id) === 'active',
  ).length;
  const funnelCounts = [signupCount, firstHenCount, firstEggCount, activeActivatedCount];
  const funnelKeys: FunnelStep['key'][] = ['signup', 'first_hen', 'first_egg', 'active_7d'];
  const funnelLabels = ['Registrerade', 'Första hönan', 'Första ägget', 'Aktiv senaste 7d'];
  const funnel: FunnelStep[] = funnelCounts.map((count, index) => ({
    key: funnelKeys[index],
    label: funnelLabels[index],
    count,
    pctOfSignup: signupCount ? Math.round((count / signupCount) * 100) : 0,
    dropFromPreviousPct: index === 0 || funnelCounts[index - 1] === 0
      ? null
      : Math.round(((funnelCounts[index - 1] - count) / funnelCounts[index - 1]) * 100),
  }));
  const biggestLeak = funnel.slice(1).reduce<FunnelStep | null>((best, step) => {
    if (step.dropFromPreviousPct == null) return best;
    if (!best || (step.dropFromPreviousPct ?? 0) > (best.dropFromPreviousPct ?? 0)) return step;
    return best;
  }, null);

  // Only COMPLETED calendar weeks feed anomaly detection. A partial Monday/Tuesday
  // must never be compared against a full prior week and generate a fake regression.
  const weekly: WeeklyMetricPoint[] = [];
  const currentWeekStart = startOfIsoWeek(now);
  for (let i = 8; i >= 1; i -= 1) {
    const start = new Date(currentWeekStart.getTime() - i * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    weekly.push({
      weekStart: isoDay(start),
      ...metricWindow(start, end, validProfiles, activities, firstEggByUser),
    });
  }
  const anomalies = weekly.length >= 2
    ? buildAnomalies(weekly[weekly.length - 2], weekly[weekly.length - 1])
    : [];

  const summary = {
    totalUsers: validProfiles.length,
    cohortUsers: cohortProfiles.length,
    active7d,
    atRisk8to30d,
    dormant30dPlus,
    neverActivated,
    premiumAtRiskOrDormant,
  };
  const changeCorrelations = correlateChanges(
    input.changes ?? [],
    now,
    observationStart,
    validProfiles,
    activities,
    firstEggByUser,
  );
  const brief = buildBrief(summary, retention, biggestLeak, anomalies, cohortProfiles.length, activities, now);

  const warnings: string[] = [];
  if (cohortProfiles.length < 20) warnings.push('Litet cohort-underlag: procenttal kan svänga kraftigt.');
  if (retention.d30.eligible < 10) warnings.push('D30-retention har ännu för få mogna användare för stark slutsats.');
  if (!input.pageViews.length) warnings.push('Page-view-data saknas; retention bygger då främst på produktaktiviteter.');
  warnings.push('“Dormant 30d+” är beteendemässig churn. Betald churn kräver historiska subscription/cancel-events.');
  if (input.changes?.length) warnings.push('Change correlation visar korrelation kring kodändringar — aldrig bevisad kausalitet.');

  return {
    generatedAt: now.toISOString(),
    observationStart: observationStart.toISOString(),
    summary,
    retention,
    cohorts,
    funnel,
    biggestLeak,
    weekly,
    anomalies,
    changeCorrelations,
    brief,
    warnings,
  };
}
