import { OutputGroup, PresentationState } from '../types';

export interface DisplayAssignment {
  displayId: string;
  assignedGroupId: string | null;
  liveGroupIds: string[];
}

/**
 * Checks if a route group is configured to target a given physical display.
 */
export function routeTargetsDisplay(group: OutputGroup, displayId: string): boolean {
  if (!group || !displayId) return false;
  const list = (group.displayIds && group.displayIds.length > 0) 
    ? group.displayIds 
    : (group.targetDisplayId ? [group.targetDisplayId] : []);
  if (list.length === 0) return false;

  const target = String(displayId).toLowerCase().trim();
  return list.some((id) => {
    if (!id) return false;
    const raw = String(id).toLowerCase().trim();
    if (raw === target) return true;
    
    // Support matching display names like "Monitor 2" vs "disp-2" or "display-2"
    if (raw.replace(/\s+/g, '') === target.replace(/\s+/g, '')) return true;
    
    // Strict boundary-aware exact matching
    // Extract numbers from both strings and compare if they both have numbers
    const targetMatch = target.match(/\d+/);
    const rawMatch = raw.match(/\d+/);
    
    if (targetMatch && rawMatch) {
      if (targetMatch[0] === rawMatch[0]) {
         const isTargetPrimary = target.includes('primary') || target.includes('monitor-1') || target === 'monitor 1' || target.includes('display-1') || target.includes('display 1');
         const isRawPrimary = raw.includes('primary') || raw.includes('monitor-1') || raw === 'monitor 1' || raw.includes('display-1') || raw.includes('display 1');
         if (isTargetPrimary && isRawPrimary) return true;
         
         if (raw.includes('monitor') && target.includes('monitor') || raw.includes('display') && target.includes('display')) {
             return true;
         }
      }
    }
    
    // Lexical matching for known primary/secondary identifiers
    const isTargetPrimaryFallback = target.includes('primary');
    const isTarget2Fallback = target.includes('secondary') || target.includes('alternate');
    const isTarget3Fallback = target.includes('foldback') || target.includes('stage') || target.includes('tertiary');

    const isRawPrimaryFallback = raw.includes('primary');
    const isRaw2Fallback = raw.includes('secondary') || raw.includes('alternate');
    const isRaw3Fallback = raw.includes('foldback') || raw.includes('stage') || raw.includes('tertiary');

    if (isTargetPrimaryFallback && isRawPrimaryFallback) return true;
    if (isTarget2Fallback && isRaw2Fallback) return true;
    if (isTarget3Fallback && isRaw3Fallback) return true;

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
    return st.isLiveEnabled === true;
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
