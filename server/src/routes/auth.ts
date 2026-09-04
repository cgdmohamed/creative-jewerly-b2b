import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { authenticateShop, signShopToken } from '../middleware/auth.js';
import {
  findUserByEmail, findUserByPhone, findUserById, createUser,
  updateUserProfile, setUserPassword,
} from '../db.js';
import { mainApi } from '../apiClient.js';

export const authRouter = Router();

function publicUser(u: any) {
  return { id: u.id, name: u.name, company: u.company, email: u.email, phone: u.phone, status: u.status };
}

authRouter.post('/register', async (req, res) => {
  const { name, email, phone, password, company } = req.body ?? {};
  if (!name?.trim() || !password) {
    return res.status(400).json({ error: 'missing.name.or.password' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'bad.password' });
  }
  const identity = String(email || phone || '').trim();
  if (!identity) return res.status(400).json({ error: 'missing.email.or.phone' });

  if (email && findUserByEmail(String(email).toLowerCase())) {
    return res.status(409).json({ error: 'email.duplicate' });
  }
  if (phone && findUserByPhone(String(phone))) {
    return res.status(409).json({ error: 'phone.duplicate' });
  }

  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const user = createUser({
      name: String(name).trim(),
      company: company?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      phone: phone?.trim() || null,
      passwordHash: hash,
      status: config.requireAccountApproval ? 'pending' : 'active',
    });

    // Mirror the buyer into the main system so orders can be linked to a customer.
    try {
      const apiCustomer = await mainApi.createCustomer({
        name: user.name,
        phone: user.phone ?? undefined,
        email: user.email ?? undefined,
      });
      await (await import('../db.js')).setUserApiCustomerId(user.id, apiCustomer.id);
      (user as any).apiCustomerId = apiCustomer.id;
    } catch (e: any) {
      // The shop account still works even if the mirror failed; a new customer
      // record will be created at first order instead.
      console.error('[shop] mirror customer failed', e?.message);
    }

    res.status(201).json({ token: signShopToken(user), user: publicUser(user) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) return res.status(400).json({ error: 'auth.missing' });
  const user =
    findUserByEmail(String(identifier).toLowerCase()) || findUserByPhone(String(identifier).trim());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'auth.invalid' });
  }
  res.json({ token: signShopToken(user), user: publicUser(user) });
});

authRouter.get('/me', authenticateShop, (req, res) => {
  res.json({ user: publicUser(req.shopUser) });
});

// ---- PATCH /api/auth/me — update own profile ----
authRouter.patch('/me', authenticateShop, async (req, res) => {
  const user = req.shopUser!;
  const { name, company, email, phone } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'missing.name' });

  const newEmail = email?.trim().toLowerCase() || null;
  const newPhone = phone?.trim() || null;
  if (!newEmail && !newPhone) return res.status(400).json({ error: 'missing.email.or.phone' });

  if (newEmail && newEmail !== user.email) {
    const clash = findUserByEmail(newEmail);
    if (clash && clash.id !== user.id) return res.status(409).json({ error: 'email.duplicate' });
  }
  if (newPhone && newPhone !== user.phone) {
    const clash = findUserByPhone(newPhone);
    if (clash && clash.id !== user.id) return res.status(409).json({ error: 'phone.duplicate' });
  }

  updateUserProfile(user.id, {
    name: String(name).trim(),
    company: company?.trim() || null,
    email: newEmail,
    phone: newPhone,
  });

  // Keep the mirror customer in the main system in sync.
  if (user.apiCustomerId) {
    try {
      await mainApi.updateCustomer(user.apiCustomerId, {
        name: String(name).trim(),
        phone: newPhone ?? undefined,
        email: newEmail ?? undefined,
      });
    } catch (e: any) {
      console.error('[shop] mirror customer update failed', e?.message);
    }
  }

  res.json({ user: publicUser(findUserById(user.id)!) });
});

// ---- POST /api/auth/me/password — change password (requires current) ----
authRouter.post('/me/password', authenticateShop, (req, res) => {
  const user = req.shopUser!;
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'auth.missing' });
  if (String(newPassword).length < 4) return res.status(400).json({ error: 'bad.password' });
  if (!bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
    return res.status(403).json({ error: 'bad.currentPassword' });
  }
  setUserPassword(user.id, bcrypt.hashSync(String(newPassword), 10));
  res.json({ ok: true });
});
