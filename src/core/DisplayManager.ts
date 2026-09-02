import { NativeDisplayTarget, ProjectorStatus, OutputGroup } from '../types';

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
    // 1. Native Electron Shell
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getDisplays) {
      try {
        const nativeDisplays = await (window as any).electronAPI.getDisplays();
        if (nativeDisplays && nativeDisplays.length > 0) {
          this.cachedDisplays = nativeDisplays;
          return nativeDisplays;
        }
      } catch (e) {
        console.warn('[DisplayManager] Native Electron display query error:', e);
      }
    }

    // 2. Web Screen Details API (Chromium)
    if (typeof window !== 'undefined' && 'getScreenDetails' in window) {
      try {
        const screenDetails = await (window as any).getScreenDetails();
        const screens: NativeDisplayTarget[] = screenDetails.screens.map((s: any, idx: number) => ({
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
        this.cachedDisplays = screens;
        return screens;
      } catch (e) {
        // Permission denied or API unavailable
      }
    }

    // 3. Browser window fallback
    const width = typeof window !== 'undefined' ? window.screen.width : 1920;
    const height = typeof window !== 'undefined' ? window.screen.height : 1080;
    const fallback: NativeDisplayTarget[] = [
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
    this.cachedDisplays = fallback;
    return fallback;
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

    // 2. Web browser popup fallback
    if (typeof window !== 'undefined') {
      const existing = this.browserPopups.get(groupId);
      if (existing && !existing.closed) {
        existing.focus();
        this.localStatuses[groupId] = 'CONNECTED';
        return { success: true, status: 'CONNECTED', displayId: displayId || 'primary-display' };
      }

      const url = `${window.location.origin}${window.location.pathname}?projector=true&groupId=${encodeURIComponent(groupId)}`;
      const popup = window.open(
        url,
        `SimpleWorship_Projector_${groupId}`,
        'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
      );

      if (popup) {
        this.browserPopups.set(groupId, popup);
        this.localStatuses[groupId] = 'CONNECTED';

        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            this.browserPopups.delete(groupId);
            this.localStatuses[groupId] = 'PROJECTOR CLOSED';
            window.dispatchEvent(
              new CustomEvent('simpleworship:projector-status', {
                detail: { groupId, status: 'PROJECTOR CLOSED' },
              })
            );
          }
        }, 1000);

        return { success: true, status: 'CONNECTED', displayId: displayId || 'primary-display' };
      }
    }

    return { success: false, status: 'DISCONNECTED', error: 'Popup blocked or unavailable' };
  }

  /**
   * Close active projector window for a route group.
   */
  static async closeProjector(groupId: string): Promise<{ success: boolean; status: ProjectorStatus }> {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      try {
        const res = await window.electronAPI.closeProjector(groupId);
        this.localStatuses[groupId] = 'DISCONNECTED';
        return res;
      } catch (e) {
        console.error('[DisplayManager] Close projector error:', e);
      }
    }

    const popup = this.browserPopups.get(groupId);
    if (popup && !popup.closed) {
      popup.close();
    }
    this.browserPopups.delete(groupId);
    this.localStatuses[groupId] = 'DISCONNECTED';
    return { success: true, status: 'DISCONNECTED' };
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
   * Detects shared display conflicts among configured output groups.
   * If two routes (e.g. Main and Stage) target the exact same monitor,
   * a conflict warning is reported.
   */
  static detectConflicts(
    outputGroups: OutputGroup[],
    availableDisplays: NativeDisplayTarget[] = this.cachedDisplays
  ): DisplayConflict[] {
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

    const conflicts: DisplayConflict[] = [];

    for (const [dispId, { groupIds, groupNames }] of displayToGroups.entries()) {
      if (groupIds.length > 1) {
        const displayObj = availableDisplays.find((d) => d.id === dispId || d.name === dispId);
        const displayName = displayObj ? displayObj.name : dispId;

        conflicts.push({
          displayId: dispId,
          displayName,
          groupIds,
          groupNames,
          message: `Display conflict: ${groupNames.join(' and ')} are both targeting "${displayName}". A physical monitor cannot project two fullscreen outputs simultaneously.`,
        });
      }
    }

    return conflicts;
  }
}
