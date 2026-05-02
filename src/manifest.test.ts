import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

describe('manifest', () => {
  it('declares MV3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('requests only the install-time permissions the plan documents', () => {
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
    expect(manifest).not.toHaveProperty('host_permissions');
  });

  it('points the action and options page at popup/options entry HTML', () => {
    expect(manifest.action.default_popup).toBe('src/popup/popup.html');
    expect(manifest.options_ui.page).toBe('src/options/options.html');
  });

  it('runs the service worker as an ES module', () => {
    expect(manifest.background.service_worker).toBe('src/background/index.ts');
    expect(manifest.background.type).toBe('module');
  });
});
