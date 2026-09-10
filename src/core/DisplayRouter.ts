import { OutputGroup, PresentationState } from '../types';

export interface DisplayAssignment {
  displayId: string;
  assignedGroupId: string | null;
  liveGroupIds: string[];
}

/**
 * Helper to normalize monitor label / ID for robust string matching
 */
function normalizeDisplayName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\(primary\)\s*/gi, '')
    .replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isPrimaryDescriptor(str: string): boolean {
  if (!str) return false;
  const s = str.toLowerCase().trim();
  return (
    s.includes('primary') ||
    s === 'monitor 1' ||
    s === 'monitor-1' ||
    s === 'display 1' ||
    s === 'display-1' ||
    s.startsWith('screen-0')
  );
}

/**
 * Checks if a route group is configured to target a given physical display.
 */
export function routeTargetsDisplay(group: OutputGroup, displayId: string): boolean {
  if (!group || !displayId) return false;
  const list = (group.displayIds && group.displayIds.length > 0) 
    ? group.displayIds 
    : (group.targetDisplayId ? [group.targetDisplayId] : []);

  const target = String(displayId).toLowerCase().trim();
  const targetNorm = normalizeDisplayName(displayId);
  const targetIsPrimary = isPrimaryDescriptor(displayId);

  // Default fallback when output group has no explicit display IDs set yet
  if (list.length === 0) {
    if ((group.role === 'broadcast' || group.id === 'group-congregation') && (targetIsPrimary || target === 'primary-display' || target === 'window')) {
      return true;
    }
    if ((group.role === 'confidence' || group.id === 'group-stage') && (target.includes('stage') || target.includes('confidence') || target.includes('foldback'))) {
      return true;
    }
    return false;
  }

  return list.some((id) => {
    if (!id) return false;
    const raw = String(id).toLowerCase().trim();
    if (raw === target) return true;
    
    // 1. Normalized comparison (strips punctuation, (Primary), resolutions)
    const rawNorm = normalizeDisplayName(raw);
    if (rawNorm && targetNorm) {
      if (rawNorm === targetNorm) return true;
      if (rawNorm.length >= 3 && targetNorm.length >= 3) {
        if (rawNorm.includes(targetNorm) || targetNorm.includes(rawNorm)) return true;
      }
    }

    // 2. Primary display identification
    const rawIsPrimary = isPrimaryDescriptor(raw);
    if (targetIsPrimary && rawIsPrimary) return true;

    // 3. Numbered monitor matching (e.g. "Monitor 2" vs "display-2")
    const targetDigits = target.match(/\d+/g);
    const rawDigits = raw.match(/\d+/g);
    if (targetDigits && rawDigits && targetDigits.length === 1 && rawDigits.length === 1) {
      if (targetDigits[0] === rawDigits[0]) {
        const isTargetGeneric = target.includes('monitor') || target.includes('display') || target.includes('screen') || target.includes('disp');
        const isRawGeneric = raw.includes('monitor') || raw.includes('display') || raw.includes('screen') || raw.includes('disp');
        if (isTargetGeneric && isRawGeneric) return true;
      }
    }

    // 4. Fallback keyword matching for roles
    const isTargetSecondary = target.includes('secondary') || target.includes('alternate');
    const isRawSecondary = raw.includes('secondary') || raw.includes('alternate');
    if (isTargetSecondary && isRawSecondary) return true;

    const isTargetStage = target.includes('foldback') || target.includes('stage') || target.includes('confidence');
    const isRawStage = raw.includes('foldback') || raw.includes('stage') || raw.includes('confidence');
    if (isTargetStage && isRawStage) return true;

    return false;
  });
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
  allTargetDisplayIds?: string[]
): Map<string, DisplayAssignment> {
  const result = new Map<string, DisplayAssignment>();

  // Collect all unique physical display IDs from output groups or provided display list
  const displayIdSet = new Set<string>();
  if (allTargetDisplayIds && allTargetDisplayIds.length > 0) {
    allTargetDisplayIds.forEach((id) => displayIdSet.add(id));
  }
  outputGroups.forEach((g) => {
    if (g.displayIds) {
      g.displayIds.forEach((id) => displayIdSet.add(id));
    }
  });

  const isRouteLive = (gid: string): boolean => {
    if (!groupStates) return false;
    const st = (groupStates as any)[gid];
    if (!st) return false;
    
    // If explicitly live, consider the route active
    if (st.isLiveEnabled) {
      return true;
    }
    
    return false;
  };

  for (const displayId of displayIdSet) {
    // 1. Find all configured route groups targeting this physical display
    const groupsForDisplay = outputGroups.filter((g) => {
      return routeTargetsDisplay(g, displayId);
    });
    const candidateGroupIds = groupsForDisplay.map((g) => g.id);
    const liveGroupIds = candidateGroupIds.filter((gid) => isRouteLive(gid));

    // 2. Zero candidate routes targeting this display
    if (candidateGroupIds.length === 0) {
      result.set(displayId, {
        displayId,
        assignedGroupId: null,
        liveGroupIds: [],
      });
      continue;
    }

    // 3. Resolve winning route for this physical display
    // RULE: "Route Panel 1 merong target monitor 1 tapos route panel 2 merong target monitor 1 and 2
    // kaya ang mangyayari ay ung monitor 1 makakatanggap ng 1 is to 1 galing sa route panel 1 and 2
    // at kung sino ung active siya ung naka overlay na display"
    let winningGroupId: string | null = null;
    if (activeControlGroupId && candidateGroupIds.includes(activeControlGroupId) && isRouteLive(activeControlGroupId)) {
      // Active route takes priority and overlays on this monitor when LIVE!
      winningGroupId = activeControlGroupId;
    } else if (liveGroupIds.length > 0) {
      winningGroupId = liveGroupIds[0];
    } else {
      winningGroupId = null;
    }

    // Build the ordered layer list for multi-layer presentation stacking:
    // All available live routes are included, with the WINNING/ACTIVE group placed LAST
    // so it renders on the highest z-index / top overlay in the presentation DOM.
    const orderedLiveGroupIds: string[] = [];
    if (winningGroupId) {
      const baseList = liveGroupIds.filter((id) => id !== winningGroupId);
      orderedLiveGroupIds.push(...baseList, winningGroupId);
    }

    result.set(displayId, {
      displayId,
      assignedGroupId: winningGroupId,
      liveGroupIds: orderedLiveGroupIds,
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
  fallbackGroupId?: string
): string | null {
  const assignments = resolveDisplayAssignments(
    outputGroups,
    groupStates,
    activeControlGroupId,
    [displayId]
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
