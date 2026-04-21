import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Role } from './config.js';
import { loginViaUI } from './login.js';

const AUTH_DIR = join(process.cwd(), '.auth');

export function storageStatePath(role: Role): string {
  return join(AUTH_DIR, `${role}.json`);
}

/**
 * Login once per role and persist cookies to .auth/<role>.json.
 * يعاد تشغيله في globalSetup قبل كل run.
 */
export async function buildAllStorageStates(): Promise<void> {
  if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });

  const roles: Role[] = ['owner', 'manager', 'accountant', 'operator', 'viewer'];
  const browser = await chromium.launch();

  try {
    for (const role of roles) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginViaUI(page, role);
      await ctx.storageState({ path: storageStatePath(role) });
      await ctx.close();
      console.log(`  ✓ ${role} storage state saved`);
    }
  } finally {
    await browser.close();
  }
}
