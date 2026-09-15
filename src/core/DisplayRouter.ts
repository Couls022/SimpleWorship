import { OutputGroup, PresentationState } from '../types';

export interface DisplayAssignment {
  displayId: string;
  assignedGroupId: string | null;
  liveGroupIds: string[];
  candidateGroupIds?: string[];
  stackedGroupIds?: string[]; // Sorted MRU: index 0 is topmost (UNA), index 1 is 2nd (PANGALAWA)
}

/**
 * Helper to clean and normalize monitor label / ID for exact alphanumeric comparison
 * Strips resolutions (e.g. 1920x1080) and "(Primary)" labels, preserving the core monitor identity.
 */
export function cleanDisplayString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\(primary\)\s*/gi, '')
    .replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Enterprise-grade Physical Display Matching.
 * Strictly verifies whether two display references (such as a configured route display ID
 * and a detected physical display ID) refer to the EXACT same physical monitor hardware.
 * 
 * Rules:
 * 1. Direct string equality: exact match.
 * 2. Hardware canonical matching via display list:
 *    - Resolves both references to their physical display hardware records.
 *    - If both resolve to physical displays, they MATCH if and only if they are the SAME display!
 *    - If they resolve to DIFFERENT physical displays, they DEFINITIVELY DO NOT MATCH (no bleed).
 * 3. Never uses fuzzy substring or partial numeric matching to prevent routes from leaking onto other monitors.
 */
export function isSamePhysicalDisplay(a: string, b: string, cachedDisplays?: any[]): boolean {
  if (!a || !b) return false;
  const strA = String(a).trim();
  const strB = String(b).trim();
  if (strA.toLowerCase() === strB.toLowerCase()) return true;

  const cleanA = cleanDisplayString(strA);
  const cleanB = cleanDisplayString(strB);
  if (cleanA && cleanB && cleanA === cleanB) return true;

  const displays = cachedDisplays || 
    (typeof window !== 'undefined' ? (window as any).__simpleworship_cached_displays : undefined);

  if (displays && Array.isArray(displays) && displays.length > 0) {
    const findMatchingDisplay = (query: string) => {
      const qLower = query.toLowerCase().trim();
      const qClean = cleanDisplayString(query);

      return displays.find((d: any) => {
        if (!d) return false;
        // Direct string match on ID, displayId, name, or label
        if (d.id && String(d.id).toLowerCase() === qLower) return true;
        if (d.displayId !== undefined && String(d.displayId).toLowerCase() === qLower) return true;
        if (d.displayId !== undefined && `display-${d.displayId}`.toLowerCase() === qLower) return true;
        if (d.name && String(d.name).toLowerCase() === qLower) return true;
        if (d.label && String(d.label).toLowerCase() === qLower) return true;
        // Clean match (stripping resolutions & primary tags)
        if (qClean) {
          if (d.name && cleanDisplayString(d.name) === qClean) return true;
          if (d.label && cleanDisplayString(d.label) === qClean) return true;
          if (d.id && cleanDisplayString(d.id) === qClean) return true;
        }
        return false;
      });
    };

    const dispA = findMatchingDisplay(strA);
    const dispB = findMatchingDisplay(strB);

    // If both references resolve to known physical displays in the system:
    if (dispA && dispB) {
      if (dispA === dispB) return true;
      if (dispA.id && dispB.id && String(dispA.id).toLowerCase() === String(dispB.id).toLowerCase()) return true;
      if (dispA.displayId !== undefined && dispB.displayId !== undefined && String(dispA.displayId) === String(dispB.displayId)) return true;
      // Also match identical bounding coordinates if available
      if (dispA.bounds && dispB.bounds &&
          dispA.bounds.x === dispB.bounds.x &&
          dispA.bounds.y === dispB.bounds.y &&
          dispA.bounds.width === dispB.bounds.width &&
          dispA.bounds.height === dispB.bounds.height) {
        return true;
      }
      // They resolved to two distinct physical monitors - STRICT NO MATCH!
      return false;
    }

    // If only dispA resolved to a physical monitor, check if strB matches any of dispA's canonical attributes
    if (dispA) {
      const bLower = strB.toLowerCase();
      if (dispA.id && String(dispA.id).toLowerCase() === bLower) return true;
      if (dispA.displayId !== undefined && String(dispA.displayId).toLowerCase() === bLower) return true;
      if (dispA.displayId !== undefined && `display-${dispA.displayId}`.toLowerCase() === bLower) return true;
      if (dispA.name && String(dispA.name).toLowerCase() === bLower) return true;
      if (dispA.label && String(dispA.label).toLowerCase() === bLower) return true;
      if (cleanB && dispA.name && cleanDisplayString(dispA.name) === cleanB) return true;
      if (cleanB && dispA.label && cleanDisplayString(dispA.label) === cleanB) return true;
      return false;
    }

    // If only dispB resolved to a physical monitor, check if strA matches any of dispB's canonical attributes
    if (dispB) {
      const aLower = strA.toLowerCase();
      if (dispB.id && String(dispB.id).toLowerCase() === aLower) return true;
      if (dispB.displayId !== undefined && String(dispB.displayId).toLowerCase() === aLower) return true;
      if (dispB.displayId !== undefined && `display-${dispB.displayId}`.toLowerCase() === aLower) return true;
      if (dispB.name && String(dispB.name).toLowerCase() === aLower) return true;
      if (dispB.label && String(dispB.label).toLowerCase() === aLower) return true;
      if (cleanA && dispB.name && cleanDisplayString(dispB.name) === cleanA) return true;
      if (cleanA && dispB.label && cleanDisplayString(dispB.label) === cleanA) return true;
      return false;
    }
  }

  // Fallback: exact clean string match only
  return cleanA === cleanB;
}

/**
 * Checks if a route group is configured to target a given physical display.
 * Strictly enforces pipeline isolation: an output route will ONLY target the displays
 * explicitly selected in its configuration.
 */
export function routeTargetsDisplay(group: OutputGroup, displayId: string, cachedDisplays?: any[]): boolean {
  if (!group || !displayId) return false;
  const list = (group.displayIds && group.displayIds.length > 0) 
    ? group.displayIds 
    : (group.targetDisplayId ? [group.targetDisplayId] : []);

  // When output group has no explicit display IDs configured:
  if (list.length === 0) {
    const target = String(displayId).toLowerCase().trim();
    const isTargetStage = target.includes('stage') || target.includes('confidence') || target.includes('foldback');
    if (group.role === 'confidence' || group.id === 'group-stage') {
      return isTargetStage;
    }
    // Strict isolation: unconfigured routes do NOT target physical presentation displays
    return false;
  }

  const displays = cachedDisplays || 
    (typeof window !== 'undefined' ? (window as any).__simpleworship_cached_displays : undefined);

  // Strictly check if target display matches any of the explicitly configured displays in this route's list
  return list.some((id) => isSamePhysicalDisplay(id, displayId, displays));
}

/**
 * Deterministically resolves the winning route group for each physical display.
 *
 * Routing Rules:
 * 1. Find all LIVE routes targeting that physical display.
 * 2. If 0 LIVE routes:
 *    - assignedGroupId = null (Display standby/black/idle)
 * 3. If exactly 1 LIVE route:
 *    - assignedGroupId = that route's ID
 * 4. If multiple LIVE routes:
 *    - If ACTIVE ROUTE targets this display and is LIVE:
 *      ACTIVE ROUTE WINS.
 *    - Otherwise:
 *      The first LIVE route in outputGroups order targets this display wins.
 */
export function resolveDisplayAssignments(
  outputGroups: OutputGroup[],
  groupStates: Record<string, PresentationState | { isLiveEnabled?: boolean }>,
  activeControlGroupId: string | null | undefined,
  allTargetDisplayIds?: string[],
  cachedDisplays?: any[],
  routeActivationStack?: string[]
): Map<string, DisplayAssignment> {
  const result = new Map<string, DisplayAssignment>();

  const displays = cachedDisplays || 
    (typeof window !== 'undefined' ? (window as any).__simpleworship_cached_displays : undefined);

  // Collect all unique physical display IDs from output groups or provided display list
  const displayIdSet = new Set<string>();
  if (allTargetDisplayIds && allTargetDisplayIds.length > 0) {
    allTargetDisplayIds.forEach((id) => displayIdSet.add(id));
  }
  outputGroups.forEach((g) => {
    if (g.displayIds && g.displayIds.length > 0) {
      g.displayIds.forEach((id) => displayIdSet.add(id));
    } else if (g.targetDisplayId) {
      displayIdSet.add(g.targetDisplayId);
    }
  });

  const isRouteLive = (gid: string): boolean => {
    if (!groupStates) return false;
    const st = (groupStates as any)[gid];
    if (!st) return false;
    return Boolean(st.isLiveEnabled);
  };

  const stack = routeActivationStack || [];
  const stackRankMap = new Map<string, number>();
  stack.forEach((id, idx) => stackRankMap.set(id, idx));

  for (const displayId of displayIdSet) {
    // 1. Strictly find all configured route groups targeting this physical display
    const groupsForDisplay = outputGroups.filter((g) => {
      return routeTargetsDisplay(g, displayId, displays);
    });

    // Strictly isolated candidate routes targeting THIS physical display
    const candidateGroupIds = groupsForDisplay.map((g) => g.id);
    const liveGroupIds = candidateGroupIds.filter((gid) => isRouteLive(gid));

    // 2. Zero candidate routes targeting this display
    if (candidateGroupIds.length === 0) {
      result.set(displayId, {
        displayId,
        assignedGroupId: null,
        liveGroupIds: [],
        candidateGroupIds: [],
        stackedGroupIds: [],
      });
      continue;
    }

    // 3. Resolve overlay stacking order based on routeActivationStack
    // Most recently activated live route is index 0 (UNA / topmost)
    // The previous live route is index 1 (PANGALAWA / 2nd)
    // The one before is index 2 (PANGATLO / 3rd)
    const stackedGroupIds = [...liveGroupIds].sort((a, b) => {
      const rankA = stackRankMap.has(a) ? stackRankMap.get(a)! : 999;
      const rankB = stackRankMap.has(b) ? stackRankMap.get(b)! : 999;
      return rankA - rankB;
    });

    const winningGroupId = stackedGroupIds[0] || null;

    result.set(displayId, {
      displayId,
      assignedGroupId: winningGroupId,
      liveGroupIds,
      candidateGroupIds,
      stackedGroupIds,
    });
  }

  return result;
}

/**
 * Resolves the winning route for a single physical display.
 */
export function resolveWinningRouteForDisplay(
  displayId: string,
  outputGroups: OutputGroup[],
  groupStates: Record<string, PresentationState>,
  activeControlGroupId: string | null | undefined,
  fallbackGroupId?: string,
  cachedDisplays?: any[]
): string | null {
  const assignments = resolveDisplayAssignments(
    outputGroups,
    groupStates,
    activeControlGroupId,
    [displayId],
    cachedDisplays
  );
  const assignment = assignments.get(displayId);
  if (assignment && assignment.assignedGroupId) {
    return assignment.assignedGroupId;
  }
  return fallbackGroupId || null;
}

/**
 * Constructs standards-compliant URL for projector windows.
 * RFC 8089 compliant file:/// URLs on Windows in production.
 */
export function buildProjectorUrl(
  baseOriginOrFileUrl: string,
  displayId: string,
  groupId: string
): string {
  const query = `projector=true&displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;
  const hash = `#/projector?displayId=${encodeURIComponent(displayId)}&groupId=${encodeURIComponent(groupId)}`;

  if (baseOriginOrFileUrl.startsWith('http://') || baseOriginOrFileUrl.startsWith('https://')) {
    const cleanOrigin = baseOriginOrFileUrl.replace(/\/+$/, '');
    return `${cleanOrigin}/?${query}${hash}`;
  }

  // File protocol format: file:///path/to/index.html?...
  const cleanBase = baseOriginOrFileUrl.replace(/\\/g, '/');
  const filePrefix = cleanBase.startsWith('file:///')
    ? ''
    : cleanBase.startsWith('file://')
    ? 'file:///' + cleanBase.replace(/^file:\/\//, '').replace(/^\/+/, '')
    : 'file:///' + cleanBase.replace(/^\/+/, '');

  const normalizedBase = cleanBase.startsWith('file:') ? cleanBase : filePrefix;
  return `${normalizedBase}?${query}${hash}`;
}
