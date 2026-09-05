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
  if (!group || !group.displayIds || group.displayIds.length === 0) return false;
  if (!displayId) return false;

  const target = String(displayId).toLowerCase().trim();
  return group.displayIds.some((id) => {
    const raw = String(id).toLowerCase().trim();
    if (raw === target) return true;
    
    // Support matching display names like "Monitor 2" vs "disp-2" or "display-2"
    if (raw.replace(/\s+/g, '') === target.replace(/\s+/g, '')) return true;
    if (raw.includes('monitor 2') && (target.includes('2') || target.includes('secondary'))) return true;
    if (raw.includes('monitor 3') && target.includes('3')) return true;
    if (target.includes('monitor 2') && (raw.includes('2') || raw.includes('secondary'))) return true;
    if (target.includes('monitor 3') && raw.includes('3')) return true;
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
  groupStates: Record<string, PresentationState>,
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

  for (const displayId of displayIdSet) {
    // 1. Find all configured route groups targeting this physical display
    const configuredGroupsForDisplay = outputGroups.filter((g) => {
      return routeTargetsDisplay(g, displayId);
    });

    const candidateGroupIds = configuredGroupsForDisplay.map((g) => g.id);

    // 2. Zero candidate routes
    if (candidateGroupIds.length === 0) {
      result.set(displayId, {
        displayId,
        assignedGroupId: null,
        liveGroupIds: [],
      });
      continue;
    }

    // 3. Exactly one candidate route
    if (candidateGroupIds.length === 1) {
      result.set(displayId, {
        displayId,
        assignedGroupId: candidateGroupIds[0],
        liveGroupIds: candidateGroupIds,
      });
      continue;
    }

    // 4. Multiple candidate routes target this physical display
    // ACTIVE ROUTE OVERLAY PRIORITY:
    // If the currently active target router panel (activeControlGroupId) targets this display,
    // it OVERLAYS and TAKES DISPLAY PRIORITY on this monitor!
    let winningGroupId: string | null = null;
    if (activeControlGroupId && candidateGroupIds.includes(activeControlGroupId)) {
      winningGroupId = activeControlGroupId;
    } else {
      // Otherwise, fallback to the first configured route targeting this display
      winningGroupId = candidateGroupIds[0];
    }

    result.set(displayId, {
      displayId,
      assignedGroupId: winningGroupId,
      liveGroupIds: candidateGroupIds,
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
