// ============================================================
// PrivSearch – Privacy IPC Handlers
// ============================================================

import { ipcMain } from 'electron';
import { PrivacyLayer } from '../PrivacyLayer';
import { NetworkLayer } from '../NetworkLayer';
import { NetworkConfig, PrivacyConfig } from '../types';

export function registerPrivacyIpc(
  privacyLayer: PrivacyLayer,
  networkLayer: NetworkLayer,
): void {

  ipcMain.handle('privacy:getStatus', async () => {
    const netStatus = networkLayer.getStatus();
    return privacyLayer.computeStatus(netStatus);
  });

  ipcMain.handle('privacy:setNetworkConfig', async (_event, cfg: NetworkConfig) => {
    // Validate input
    const validRoutes = ['DIRECT', 'HTTP_PROXY', 'HTTPS_PROXY', 'SOCKS5', 'TOR'];
    if (!validRoutes.includes(cfg.route)) return { error: 'Invalid route' };
    networkLayer.setConfig(cfg);
    return { ok: true };
  });

  ipcMain.handle('privacy:verifyRoute', async () => {
    const status = await networkLayer.verifyRoute();
    return { status };
  });

  ipcMain.handle('privacy:setWebRTCStatus', async (_event, status: string) => {
    const valid = ['NOT_TESTED', 'UNKNOWN', 'POSSIBLE_LEAK', 'PROTECTED', 'VERIFIED'];
    if (!valid.includes(status)) return { error: 'Invalid status' };
    networkLayer.setWebRTCStatus(status as any);
    return { ok: true };
  });

  ipcMain.handle('privacy:setPrivacyConfig', async (_event, cfg: Partial<PrivacyConfig>) => {
    privacyLayer.updateConfig(cfg);
    return { ok: true };
  });

  ipcMain.handle('privacy:getNetworkConfig', async () => {
    return networkLayer.getConfig();
  });
}
