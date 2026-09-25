// ============================================================
// PrivSearch – PermissionManager
// Explicit site permission management.
// Sensitive permissions default to DENY unless explicitly allowed by user.
// ============================================================
import { WebContents } from 'electron';

export type PermissionState = 'ALLOW' | 'DENY' | 'ASK';

export type PermissionType =
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'notifications'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'fullscreen'
  | 'media'
  | 'midi'
  | 'openExternal'
  | 'pointerLock'
  | 'unknown';

interface SitePermissions {
  [permission: string]: PermissionState;
}

export class PermissionManager {
  private sitePermissions = new Map<string, SitePermissions>();
  private promptCallback?: (
    origin: string,
    permission: PermissionType
  ) => Promise<PermissionState>;

  setPromptCallback(
    cb: (origin: string, permission: PermissionType) => Promise<PermissionState>
  ): void {
    this.promptCallback = cb;
  }

  /**
   * Sole handler for Electron permission requests.
   * Denies by default unless an explicit ALLOW exists.
   */
  async handleRequest(
    webContents: WebContents,
    permission: string,
    callback: (granted: boolean) => void
  ): Promise<void> {
    let origin: string;
    try {
      origin = new URL(webContents.getURL()).origin;
    } catch {
      callback(false);
      return;
    }

    const perm = (permission as PermissionType) || 'unknown';
    const state = this.getPermission(origin, perm);

    if (state === 'ALLOW') {
      callback(true);
      return;
    }

    if (state === 'DENY') {
      callback(false);
      return;
    }

    // Default policy for unconfigured permissions:
    // If a prompt handler is attached, request explicit user decision.
    // Otherwise, strictly DENY.
    if (this.promptCallback) {
      try {
        const userDecision = await this.promptCallback(origin, perm);
        this.setPermission(origin, perm, userDecision);
        callback(userDecision === 'ALLOW');
      } catch {
        callback(false);
      }
    } else {
      callback(false);
    }
  }

  getPermission(origin: string, permission: PermissionType): PermissionState {
    return this.sitePermissions.get(origin)?.[permission] ?? 'DENY';
  }

  setPermission(origin: string, permission: PermissionType, state: PermissionState): void {
    const existing = this.sitePermissions.get(origin) ?? {};
    existing[permission] = state;
    this.sitePermissions.set(origin, existing);
  }

  clearSitePermissions(origin: string): void {
    this.sitePermissions.delete(origin);
  }

  clearAllPermissions(): void {
    this.sitePermissions.clear();
  }
}
