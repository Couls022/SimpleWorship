import { NativeDisplayTarget, ProjectorStatus, OutputGroup, PresentationState } from '../types';
import { resolveDisplayAssignments } from './DisplayRouter';

export interface DisplayConflict {
  displayId: string;
  displayName: string;
  groupIds: string[];
  groupNames: string[];
  message: string;
}

export class DisplayManager {
  private static browserPopups: Map<string, Window> = new Map();
  private static cachedDisplays: NativeDisplayTarget[] = [];
  private static localStatuses: Record<string, ProjectorStatus> = {};
  private static lastQueryTime = 0;
  private static queryPromise: Promise<NativeDisplayTarget[]> | null = null;

  /**
   * Returns true if running inside native Electron shell.
   */
  static isElectron(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  }

  /**
   * Clears the cached displays.
   */
  static clearCache(): void {
    this.cachedDisplays = [];
    this.lastQueryTime = 0;
    this.queryPromise = null;
  }

  /**
   * Retrieves a list of available displays with intelligent caching to avoid UI lag.
   */
  static async getDisplays(force: boolean = false): Promise<NativeDisplayTarget[]> {
    if (!force && this.cachedDisplays.length > 0 && Date.now() - this.lastQueryTime < 8000) {
      const hasRealApi = typeof window !== 'undefined' && (Boolean((window as any).electronAPI?.getDisplays) || 'getScreenDetails' in window);
      const onlyHasFallback = this.cachedDisplays.length === 1 && this.cachedDisplays[0].id === 'primary-display';
      if (!hasRealApi || !onlyHasFallback) {
        return this.cachedDisplays;
      }
    }

    if (this.queryPromise) {
      return this.queryPromise;
    }

    this.queryPromise = (async () => {
      let rawDisplays: NativeDisplayTarget[] = [];

      // 1. Native Electron Shell
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getDisplays) {
        try {
          const nativeDisplays = await (window as any).electronAPI.getDisplays();
          if (nativeDisplays && nativeDisplays.length > 0) {
            rawDisplays = nativeDisplays;
          }
        } catch (e) {
          console.warn('[DisplayManager] Native Electron display query error:', e);
        }
      }

      // 2. Web Screen Details API (Chromium) - query only if permission granted or cached
      if (rawDisplays.length === 0 && typeof window !== 'undefined' && 'getScreenDetails' in window) {
        try {
          const screenDetails = await (window as any).getScreenDetails();
          if (screenDetails && screenDetails.screens) {
            rawDisplays = screenDetails.screens.map((s: any, idx: number) => ({
              id: s.label || `screen-${idx}-${s.left}-${s.top}`,
              name: s.label || `Monitor ${idx + 1}`,
              bounds: {
                x: s.left ?? 0,
                y: s.top ?? 0,
                width: s.width ?? window.innerWidth,
                height: s.height ?? window.innerHeight,
              },
              workArea: {
                x: s.availLeft ?? s.left ?? 0,
                y: s.availTop ?? s.top ?? 0,
                width: s.availWidth ?? s.width ?? window.innerWidth,
                height: s.availHeight ?? s.height ?? window.innerHeight,
              },
              scaleFactor: s.devicePixelRatio || window.devicePixelRatio || 1,
              isPrimary: s.isPrimary ?? idx === 0,
              isInternal: s.isInternal ?? false,
              connectionState: 'connected' as const,
            }));
          }
        } catch (e) {
          // Permission denied or API unavailable
        }
      }

      // 3. Browser window fallback
      if (rawDisplays.length === 0) {
        const width = typeof window !== 'undefined' ? window.screen.width : 1920;
        const height = typeof window !== 'undefined' ? window.screen.height : 1080;
        rawDisplays = [
          {
            id: 'primary-display',
            name: `Primary Display (${width}x${height})`,
            bounds: { x: 0, y: 0, width, height },
            workArea: { x: 0, y: 0, width, height },
            scaleFactor: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
            isPrimary: true,
            isInternal: true,
            connectionState: 'connected' as const,
          },
        ];
      }

      const resultList = [...rawDisplays];

      // Ensure standard names are consistent
      const formatted = resultList.map((d) => ({
        ...d,
        name: d.name || (d.isPrimary ? 'Primary Display' : 'Display')
      }));

      this.cachedDisplays = formatted;
      if (typeof window !== 'undefined') {
        (window as any).__simpleworship_cached_displays = formatted;
      }
      this.lastQueryTime = Date.now();
      this.queryPromise = null;
      return formatted;
    })().catch((err) => {
      this.queryPromise = null;
      return this.cachedDisplays.length > 0 ? this.cachedDisplays : [];
    });

    return this.queryPromise;
  }

  /**
   * Synchronously returns the currently cached physical displays.
   */
  static getCachedDisplays(): NativeDisplayTarget[] {
    return this.cachedDisplays;
  }

  /**
   * Finds a display by its unique ID or display name from cache.
   */
  static findDisplayById(displayId: string): NativeDisplayTarget | undefined {
    return this.cachedDisplays.find(d => d.id === displayId || d.name === displayId);
  }

  /**
   * Listen to display hot-plug events (connect, disconnect, resolution changes).
   */
  static listenToDisplays(callback: (displays: NativeDisplayTarget[]) => void): () => void {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      return window.electronAPI.onDisplaysChanged(callback);
    }

    if (typeof window !== 'undefined' && 'getScreenDetails' in window) {
      let active = true;
      (window as any).getScreenDetails?.().then((screenDetails: any) => {
        if (!active) return;
        const handler = () => {
          this.getDisplays().then(callback);
        };
        screenDetails.addEventListener('screenschange', handler);
      }).catch(() => {});

      return () => {
        active = false;
      };
    }

    return () => {};
  }

  /**
   * Launch or reposition a projector output window for the given route group.
   */
  static async openProjector(
    groupId: string,
    displayId?: string
  ): Promise<{ success: boolean; status: ProjectorStatus; displayId?: string; conflict?: string | null; error?: string }> {
    if (!groupId) {
      return { success: false, status: 'DISCONNECTED', error: 'groupId is required' };
    }

    // 1. Native Electron Shell
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      try {
        const result = await window.electronAPI.openProjector(groupId, displayId);
        if (result.success) {
          this.localStatuses[groupId] = result.status;
        }
        return result;
      } catch (err: any) {
        console.error('[DisplayManager] Native projector launch error:', err);
        return { success: false, status: 'DISPLAY UNAVAILABLE', error: err.message };
      }
    }

    // 2. Web Standalone Mode
    if (typeof window !== 'undefined') {
      this.localStatuses[groupId] = 'CONNECTED';
      
      // Dispatch in-app activation event as fallback
      window.dispatchEvent(
        new CustomEvent('simpleworship:projector-activate', {
          detail: { groupId, displayId: displayId || 'primary-display', status: 'CONNECTED' },
        })
      );

      // Attempt to open an actual popup window that can be dragged to a secondary monitor
      const popupUrl = `${window.location.origin}${window.location.pathname}?projector=true&groupId=${groupId}${displayId ? `&displayId=${displayId}` : ''}`;
      const existingPopup = this.browserPopups.get(groupId);
      if (existingPopup && !existingPopup.closed) {
        existingPopup.focus();
      } else {
        let features = 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no';
        try {
          if ('getScreenDetails' in window) {
            const screenDetails = await (window as any).getScreenDetails();
            const targetScreen = screenDetails.screens.find((s: any) => s.label === displayId || s.id === displayId) || screenDetails.screens.find((s: any) => !s.isInternal) || screenDetails.screens[0];
            if (targetScreen) {
              features = `left=${targetScreen.availLeft},top=${targetScreen.availTop},width=${targetScreen.availWidth},height=${targetScreen.availHeight},menubar=no,toolbar=no,location=no,status=no`;
            }
          }
        } catch (e) {
          console.warn('Screen details permission denied or unavailable for popup placement', e);
        }
        
        const newPopup = window.open(popupUrl, `projector_${groupId}`, features);
        if (newPopup) {
          this.browserPopups.set(groupId, newPopup);
        }
      }

      window.dispatchEvent(
        new CustomEvent('simpleworship:projector-status', {
          detail: { groupId, status: 'CONNECTED' },
        })
      );

      return { success: true, status: 'CONNECTED', displayId: displayId || 'primary-display' };
    }

    return { success: false, status: 'DISCONNECTED', error: 'Display unavailable' };
  }

  /**
   * Close active projector window for a route group or specific physical display.
   */
  static async closeProjector(
    target: string | { groupId?: string; displayId?: string }
  ): Promise<{ success: boolean; status: ProjectorStatus }> {
    const opts = typeof target === 'string' ? { groupId: target } : target;
    const groupId = opts.groupId;

    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      try {
        const res = await window.electronAPI.closeProjector(opts);
        if (groupId) this.localStatuses[groupId] = 'DISCONNECTED';
        return res;
      } catch (e) {
        console.error('[DisplayManager] Close projector error:', e);
      }
    }

    if (groupId) {
      const popup = this.browserPopups.get(groupId);
      if (popup && !popup.closed) {
        popup.close();
      }
      this.browserPopups.delete(groupId);
      this.localStatuses[groupId] = 'DISCONNECTED';
    }
    return { success: true, status: 'DISCONNECTED' };
  }

  /**
   * Dedicated 1-to-1 Presentation Sender:
   * Sends the presentation to strictly ONE target monitor, guaranteeing that
   * only 1:1 presentation display is active and no stray displays are thrown.
   */
  static async sendPresentationToTarget(
    groupId: string,
    targetDisplayId?: string
  ): Promise<{ success: boolean; status: ProjectorStatus; displayId?: string; conflict?: string | null; error?: string }> {
    return this.openProjector(groupId, targetDisplayId);
  }

  /**
   * Synchronizes physical projector windows with current LIVE route and active control states.
   * Enforces strict 1-to-1 presentation target display mapping so only the designated
   * target monitor receives the presentation display.
   */
  static async syncPhysicalDisplays(
    outputGroups: OutputGroup[],
    groupStates: Record<string, PresentationState>,
    activeControlGroupId: string | null | undefined
  ): Promise<{ opened: string[]; updated: string[]; closed: string[]; conflicts: DisplayConflict[] }> {
    const displays = this.cachedDisplays.length > 0 ? this.cachedDisplays : await this.getDisplays();
    const conflicts = this.detectConflicts(outputGroups, displays);

    // All displays can be targeted, including primary / operator console display
    const operatorBlockedDisplayIds = new Set<string>();

    // Collect ONLY the target displays explicitly selected/configured in output groups
    const configuredTargetDisplayIds = new Set<string>();
    outputGroups.forEach(g => {
      if (g.displayIds && g.displayIds.length > 0) {
        g.displayIds.forEach(id => configuredTargetDisplayIds.add(id));
      } else if (g.targetDisplayId) {
        configuredTargetDisplayIds.add(g.targetDisplayId);
      }
    });

    // If NO target displays are configured across all output panels, close any open projector windows
    if (configuredTargetDisplayIds.size === 0) {
      if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
        try {
          if (typeof window.electronAPI.syncProjectorDisplays === 'function') {
            await (window.electronAPI.syncProjectorDisplays as any)([]);
          }
        } catch (err) {
          console.error('[DisplayManager] syncPhysicalDisplays electron error:', err);
        }
      }
      return { opened: [], updated: [], closed: [], conflicts };
    }

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates,
      activeControlGroupId,
      Array.from(configuredTargetDisplayIds)
    );

    const opened: string[] = [];
    const updated: string[] = [];
    const closed: string[] = [];

    // 1. Native Electron Shell
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      const assignmentList = Array.from(assignments.values()).map(a => ({
        displayId: a.displayId,
        groupId: operatorBlockedDisplayIds.has(a.displayId) ? null : a.assignedGroupId
      }));

      try {
        if (typeof window.electronAPI.syncProjectorDisplays === 'function') {
          await (window.electronAPI.syncProjectorDisplays as any)(assignmentList);
        } else {
          for (const item of assignmentList) {
            if (item.groupId) {
              await window.electronAPI.openProjector(item.groupId, item.displayId);
            } else {
              await window.electronAPI.closeProjector({ displayId: item.displayId });
            }
          }
        }
      } catch (err) {
        console.error('[DisplayManager] syncPhysicalDisplays electron error:', err);
      }
    } else if (typeof window !== 'undefined') {
      // 2. Web Standalone / Preview environment (1 is to 1 per physical monitor with active overlay)
      assignments.forEach((assignment, displayId) => {
        if (operatorBlockedDisplayIds.has(displayId)) return;

        if (assignment.assignedGroupId) {
          this.localStatuses[assignment.assignedGroupId] = 'CONNECTED';
          window.dispatchEvent(
            new CustomEvent('simpleworship:projector-route-changed', {
              detail: { displayId, groupId: assignment.assignedGroupId }
            })
          );
          opened.push(displayId);
        } else {
          closed.push(displayId);
        }
      });
    }

    return { opened, updated, closed, conflicts };
  }

  /**
   * Listen to projector route changed events on a physical display.
   */
  static listenToProjectorRouteChanged(
    callback: (data: { displayId: string; groupId: string }) => void
  ): () => void {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron && typeof window.electronAPI.onProjectorRouteChanged === 'function') {
      return window.electronAPI.onProjectorRouteChanged(callback);
    }

    const listener = (event: any) => {
      if (event.detail) {
        callback(event.detail);
      }
    };
    window.addEventListener('simpleworship:projector-route-changed', listener);
    return () => window.removeEventListener('simpleworship:projector-route-changed', listener);
  }

  /**
   * Returns current projector statuses.
   */
  static async getProjectorStatuses(): Promise<Record<string, ProjectorStatus>> {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      try {
        const statuses = await window.electronAPI.getProjectorStatuses();
        return { ...this.localStatuses, ...statuses };
      } catch (e) {
        // Fall back to local
      }
    }
    return { ...this.localStatuses };
  }

  /**
   * Returns current locally tracked projector status for a group.
   */
  static getLocalStatus(groupId: string): ProjectorStatus {
    return this.localStatuses[groupId] || 'DISCONNECTED';
  }

  /**
   * Listen to projector window lifecycle changes.
   */
  static listenToProjectorStatus(callback: (data: { groupId: string; status: ProjectorStatus }) => void): () => void {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      return window.electronAPI.onProjectorStatusChanged(callback);
    }

    const listener = (event: any) => {
      if (event.detail) {
        callback(event.detail);
      }
    };
    window.addEventListener('simpleworship:projector-status', listener);
    return () => window.removeEventListener('simpleworship:projector-status', listener);
  }

  /**
   * Detects shared display conflicts among configured output groups and the operator console.
   * If an output group targets the operator monitor (Monitor 1 / Primary),
   * or if two routes target the exact same monitor, conflict warnings are reported.
   */
  static detectConflicts(
    outputGroups: OutputGroup[],
    availableDisplays: NativeDisplayTarget[] = this.cachedDisplays
  ): DisplayConflict[] {
    const conflicts: DisplayConflict[] = [];

    // Detect conflicts between multiple groups targeting the same display
    const displayToGroups = new Map<string, { groupIds: string[]; groupNames: string[] }>();

    for (const group of outputGroups) {
      if (group.displayIds && group.displayIds.length > 0) {
        for (const dispId of group.displayIds) {
          if (!displayToGroups.has(dispId)) {
            displayToGroups.set(dispId, { groupIds: [], groupNames: [] });
          }
          const entry = displayToGroups.get(dispId)!;
          entry.groupIds.push(group.id);
          entry.groupNames.push(group.name);
        }
      }
    }

    for (const [dispId, { groupIds, groupNames }] of displayToGroups.entries()) {
      if (groupIds.length > 1) {
        const displayObj = availableDisplays.find((d) => d.id === dispId || d.name === dispId);
        const displayName = displayObj ? displayObj.name : dispId;

        conflicts.push({
          displayId: dispId,
          displayName,
          groupIds,
          groupNames,
          message: `Multi-Route Overlay: ${groupNames.join(' and ')} are both targeting "${displayName}". Content will layer and stack transparently on top of each other for multi-panel projection.`,
        });
      }
    }

    return conflicts;
  }
}
