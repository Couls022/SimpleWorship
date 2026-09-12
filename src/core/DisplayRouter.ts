import { OutputGroup, PresentationState } from '../types';

export interface DisplayAssignment {
  displayId: string;
  assignedGroupId: string | null;
  liveGroupIds: string[];
  candidateGroupIds?: string[];
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
export function routeTargetsDisplay(group: OutputGroup, displayId: string, cachedDisplays?: any[]): boolean {
  if (!group || !displayId) return false;
  const list = (group.displayIds && group.displayIds.length > 0) 
    ? group.displayIds 
    : (group.targetDisplayId ? [group.targetDisplayId] : []);

  const target = String(displayId).toLowerCase().trim();
  const targetNorm = normalizeDisplayName(displayId);
  const targetIsPrimary = isPrimaryDescriptor(displayId);

  // Default fallback when output group has no explicit display IDs set yet:
  if (list.length === 0) {
    const isTargetStage = target.includes('stage') || target.includes('confidence') || target.includes('foldback');
    if (isTargetStage) {
      return group.role === 'confidence' || group.id === 'group-stage';
    }
    // For standard presentation / projector displays:
    // Congregation presentation route and all router output panels (R1, R2, R3, R4...) target it as base or overlay
    return true;
  }

  const displays = cachedDisplays || (typeof window !== 'undefined' ? (window as any).__simpleworship_cached_displays : undefined);

  return list.some((id) => {
    if (!id) return false;
    const raw = String(id).toLowerCase().trim();
    if (raw === target) return true;

    // 1. Check physical cached displays (matches canonical ID, name, label, displayId)
    if (displays && Array.isArray(displays) && displays.length > 0) {
      const matchTarget = displays.find((d: any) => 
        d.id === displayId || 
        String(d.id).toLowerCase() === target ||
        String(d.name).toLowerCase() === target ||
        String(d.label).toLowerCase() === target ||
        String(d.displayId) === target ||
        `display-${d.displayId}` === target
      );
      const matchRaw = displays.find((d: any) => 
        d.id === id || 
        String(d.id).toLowerCase() === raw ||
        String(d.name).toLowerCase() === raw ||
        String(d.label).toLowerCase() === raw ||
        String(d.displayId) === raw ||
        `display-${d.displayId}` === raw
      );
      if (matchTarget && matchRaw && matchTarget.id === matchRaw.id) {
        return true;
      }
      if (matchTarget && (
        String(matchTarget.name).toLowerCase() === raw ||
        String(matchTarget.label).toLowerCase() === raw ||
        String(matchTarget.id).toLowerCase() === raw ||
        normalizeDisplayName(matchTarget.name) === normalizeDisplayName(raw)
      )) {
        return true;
      }
      if (matchRaw && (
        String(matchRaw.name).toLowerCase() === target ||
        String(matchRaw.label).toLowerCase() === target ||
        String(matchRaw.id).toLowerCase() === target ||
        normalizeDisplayName(matchRaw.name) === normalizeDisplayName(target)
      )) {
        return true;
      }
    }
    
    // 2. Normalized comparison (strips punctuation, (Primary), resolutions)
    const rawNorm = normalizeDisplayName(raw);
    if (rawNorm && targetNorm) {
      if (rawNorm === targetNorm) return true;
      if (rawNorm.length >= 3 && targetNorm.length >= 3) {
        if (rawNorm.includes(targetNorm) || targetNorm.includes(rawNorm)) return true;
      }
    }

    // 3. Primary display identification
    const rawIsPrimary = isPrimaryDescriptor(raw);
    if (targetIsPrimary && rawIsPrimary) return true;

    // 4. Numbered monitor matching (strip resolutions e.g. "Monitor 2 (1920x1080)" -> "Monitor 2")
    const cleanRaw = raw.replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*/gi, '').replace(/\s*\(primary\)\s*/gi, '');
    const cleanTarget = target.replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*/gi, '').replace(/\s*\(primary\)\s*/gi, '');
    const targetDigits = cleanTarget.match(/\d+/g);
    const rawDigits = cleanRaw.match(/\d+/g);
    if (targetDigits && rawDigits && targetDigits.length === 1 && rawDigits.length === 1) {
      if (targetDigits[0] === rawDigits[0]) {
        return true;
      }
    }

    // 5. Fallback keyword matching for roles
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

    // Include all groups targeting this display (both explicitly assigned and global/overlay router output groups).
    // This ensures secondary routers (R2, R3, R4...) are available to display and overlay on the projector!
    const candidateGroupIds = groupsForDisplay.map((g) => g.id);
    const liveGroupIds = candidateGroupIds.filter((gid) => isRouteLive(gid));

    // 2. Zero candidate routes targeting this display
    if (candidateGroupIds.length === 0) {
      result.set(displayId, {
        displayId,
        assignedGroupId: null,
        liveGroupIds: [],
        candidateGroupIds: [],
      });
      continue;
    }

    // 3. Resolve winning route for this physical display
    // RULE: If multiple routes target this display, the ACTIVE route takes priority over others.
    let winningGroupId: string | null = null;
    if (activeControlGroupId && candidateGroupIds.includes(activeControlGroupId) && isRouteLive(activeControlGroupId)) {
      winningGroupId = activeControlGroupId;
    } else if (liveGroupIds.length > 0) {
      winningGroupId = liveGroupIds[0];
    } else {
      winningGroupId = null;
    }

    // Ensure the winning group (active route) is the LAST element in liveGroupIds
    // so it renders on top as the active overlay.
    if (winningGroupId && liveGroupIds.includes(winningGroupId)) {
      const filtered = liveGroupIds.filter(id => id !== winningGroupId);
      filtered.push(winningGroupId);
      liveGroupIds.length = 0;
      liveGroupIds.push(...filtered);
    }

    result.set(displayId, {
      displayId,
      assignedGroupId: winningGroupId,
      liveGroupIds: liveGroupIds,
      candidateGroupIds,
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
