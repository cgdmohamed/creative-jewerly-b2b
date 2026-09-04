#!/usr/bin/env node
/**
 * Creates the dedicated `b2b` employee account that the B2B shop uses to talk
 * to the main jewelry-system API. Run as the store manager (or anyone with
 * employees.manage):
 *
 *   node scripts/create-b2b-employee.mjs
 *
 * Env / flags:
 *   API_BASE_URL     base URL of the main system (default http://localhost:4001)
 *   MANAGER_USERNAME manager identifier (default: manager)
 *   MANAGER_PIN      manager PIN (default: 1234)
 *   B2B_USERNAME     new account username (default: b2b)
 *   B2B_PIN          new account PIN (default: 1234)
 *   B2B_NAME         display name (default: حساب المتجر B2B)
 */
const base = (process.env.API_BASE_URL || 'http://localhost:4001').replace(/\/$/, '');
const managerId = process.env.MANAGER_USERNAME || 'manager';
const managerPin = process.env.MANAGER_PIN || '1234';
const b2bUsername = process.env.B2B_USERNAME || 'b2b';
const b2bPin = process.env.B2B_PIN || '1234';
const b2bName = process.env.B2B_NAME || 'حساب المتجر B2B';

async function call(path, token, body) {
  const res = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${data?.error || JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`> logging in as "${managerId}" @ ${base}`);
  const login = await call('/api/auth/login', null, { identifier: managerId, pin: managerPin });
  const token = login.token;
  console.log(`> authenticated as ${login.employee.fullName} (${login.employee.role})`);

  const roles = await call('/api/employees/roles', token, null);
  const social = roles.find((r) => r.code === 'social');
  if (!social) throw new Error('social role not found');

  try {
    const created = await call('/api/employees', token, {
      employeeNo: b2bUsername.toUpperCase(),
      fullName: b2bName,
      username: b2bUsername,
      pin: b2bPin,
      roleId: social.id,
      locationId: 1,
      discountCapPercent: 0,
      notes: 'Dedicated service account for the B2B wholesale shop',
    });
    console.log(`> created employee: ${created.fullName} (id=${created.id}, username=${created.username})`);
  } catch (e) {
    if (String(e.message).includes('duplicate')) {
      console.log('> employee already exists — nothing to do.');
    } else {
      throw e;
    }
  }

  console.log('');
  console.log('Now set these in b2b-shop/server/.env:');
  console.log(`  API_BASE_URL=${base}`);
  console.log(`  B2B_USERNAME=${b2bUsername}`);
  console.log(`  B2B_PIN=${b2bPin}`);
}

main().catch((e) => {
  console.error(`\n[failed] ${e.message}`);
  process.exit(1);
});
