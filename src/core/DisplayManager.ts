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

  /**
   * Returns true if running inside native Electron shell.
   */
  static isElectron(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  }

  /**
   * Retrieves a list of available displays.
   * Priority:
   * 1. Native Electron IPC (via screen module)
   * 2. Web Multi-Screen Window Placement API (getScreenDetails)
   * 3. Standard window.screen fallback
   */
  static async getDisplays(): Promise<NativeDisplayTarget[]> {
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

    // 2. Web Screen Details API (Chromium)
    if (rawDisplays.length === 0 && typeof window !== 'undefined' && 'getScreenDetails' in window) {
      try {
        const screenDetails = await (window as any).getScreenDetails();
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
    return formatted;
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

    // 2. Web Standalone Mode (No external browser popups to prevent 403 Google auth bridge errors)
    if (typeof window !== 'undefined') {
      const displays = this.cachedDisplays.length > 0 ? this.cachedDisplays : await this.getDisplays();
      const targetDisplay = displays.find(d => d.id === displayId || d.name === displayId) || displays[0];

      // Operator console protection: if targeting the operator/primary display, block with SAME_DISPLAY_CONFLICT
      const isOperatorDisplay = !displayId || displayId === 'primary-display' || targetDisplay?.isPrimary || displays.length <= 1;
      if (isOperatorDisplay) {
        this.localStatuses[groupId] = 'DISCONNECTED';
        return {
          success: false,
          status: 'DISCONNECTED',
          conflict: 'SAME_DISPLAY_CONFLICT',
          error: 'The selected Live Output monitor is currently being used by the SimpleWorship operator console.'
        };
      }

      this.localStatuses[groupId] = 'CONNECTED';
      
      // Dispatch in-app activation event so the internal Live Display canvas activates/fullscreens
      window.dispatchEvent(
        new CustomEvent('simpleworship:projector-activate', {
          detail: { groupId, displayId: displayId || 'primary-display', status: 'CONNECTED' },
        })
      );

      window.dispatchEvent(
        new CustomEvent('simpleworship:projector-status', {
          detail: { groupId, status: 'CONNECTED' },
        })
      );

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Standalone Live Display connected for Output Route!` 
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
   * Synchronizes physical projector windows with current LIVE route and active control states.
   * Uses DisplayRouter to deterministically resolve winning routes per physical monitor.
   * Ensures idempotency: existing windows are reused and not duplicated.
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

    const targetDisplayIds = displays.map(d => d.id);

    const assignments = resolveDisplayAssignments(
      outputGroups,
      groupStates,
      activeControlGroupId,
      targetDisplayIds.length > 0 ? targetDisplayIds : undefined
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
          await window.electronAPI.syncProjectorDisplays(assignmentList);
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
      // 2. Web Standalone / Preview environment
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

    // 1. Operator Console Conflict Protection:
    // If an output group targets the operator console monitor (Primary / Monitor 1),
    // report a conflict so the operator console is protected.
    const operatorDisplay = availableDisplays.find((d) => d.isPrimary) || availableDisplays[0];
    if (operatorDisplay) {
      for (const group of outputGroups) {
        if (group.displayIds && group.displayIds.length > 0) {
          for (const dispId of group.displayIds) {
            const isTargetingOperator =
              dispId === operatorDisplay.id ||
              dispId === operatorDisplay.name ||
              (operatorDisplay.isPrimary &&
                (dispId === 'primary-display' ||
                  dispId.toLowerCase().includes('primary') ||
                  operatorDisplay.name.toLowerCase().includes(dispId.toLowerCase())));

            if (isTargetingOperator) {
              conflicts.push({
                displayId: dispId,
                displayName: operatorDisplay.name,
                groupIds: [group.id],
                groupNames: [group.name],
                message: `Output Monitor Conflict: "${group.name}" is targeting the operator console monitor (${operatorDisplay.name}). The operator console will be kept intact and cannot be overtaken.`,
              });
            }
          }
        }
      }
    }

    // 2. Detect conflicts between multiple groups targeting the same display
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
