import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../../database/connection';
import { UnauthorizedError, NotFoundError } from '../../shared/errors';
import { nowISO } from '../../shared/utils';

const JWT_SECRET = process.env.AUTH_SECRET || 'dev-secret';
const JWT_EXPIRES = '24h';

function formatRow(result: any, index: number = 0): any {
  if (!result[0] || !result[0].values[index]) return null;
  const obj: any = {};
  result[0].columns.forEach((col: string, i: number) => {
    obj[col] = result[0].values[index][i];
  });
  return obj;
}

function formatRows(result: any): any[] {
  if (!result[0]) return [];
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export class AuthService {
  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    const db = await getDb();
    const result = db.exec(
      "SELECT id, username, email, name, password, isActive FROM users WHERE username = ?", [username]
    );

    const user = formatRow(result);
    if (!user) {
      throw new UnauthorizedError('Username atau password salah');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Akun tidak aktif');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedError('Username atau password salah');
    }

    const rolesResult = db.exec(
      `SELECT r.id, r.name FROM roles r
       JOIN user_roles ur ON r.id = ur.roleId
       WHERE ur.userId = ?`, [user.id]
    );
    const roles = formatRows(rolesResult);

    const permissionsResult = db.exec(
      `SELECT DISTINCT p.name FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permissionId
       JOIN user_roles ur ON rp.roleId = ur.roleId
       WHERE ur.userId = ?`, [user.id]
    );
    const permissions = formatRows(permissionsResult);

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: roles.map((r: any) => r.name),
      permissions: permissions.map((p: any) => p.name)
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, name: user.name, roles, permissions: permissions.map((p: any) => p.name) }
    };
  }

  async getMe(userId: string): Promise<any> {
    const db = await getDb();
    const result = db.exec(
      "SELECT id, email, name, phone, avatar, isActive FROM users WHERE id = ?", [userId]
    );
    const user = formatRow(result);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const rolesResult = db.exec(
      `SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`, [userId]
    );
    const roles = formatRows(rolesResult);

    const permissionsResult = db.exec(
      `SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permissionId JOIN user_roles ur ON rp.roleId = ur.roleId WHERE ur.userId = ?`, [userId]
    );
    const permissions = formatRows(permissionsResult);

    return {
      id: user.id, email: user.email, name: user.name, phone: user.phone,
      avatar: user.avatar, isActive: !!user.isActive, roles: roles.map((r: any) => r.name), permissions: permissions.map((p: any) => p.name)
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const db = await getDb();
    const result = db.exec("SELECT password FROM users WHERE id = ?", [userId]);
    const user = formatRow(result);
    if (!user) throw new NotFoundError('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    db.run("UPDATE users SET password = ?, updatedAt = ? WHERE id = ?", [hashed, nowISO(), userId]);
    saveDb();
  }
}

export const authService = new AuthService();
