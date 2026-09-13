import bcrypt from 'bcryptjs';
import { getDb } from '../../database/connection';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors';
import { generateId, nowISO, paginate } from '../../shared/utils';

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

export interface CreateUserInput {
  email?: string;
  username?: string;
  password: string;
  name: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  roleIds?: string[];
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  password?: string;
  roleIds?: string[];
}

export class UsersService {
  async list(page: number = 1, limit: number = 20, search?: string) {
    const { offset, limit: pageSize } = paginate(page, limit);
    const db = await getDb();

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      whereClause = 'WHERE u.name LIKE ? OR u.username LIKE ?';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const countParams = [...params];
    const countResult = await db.exec(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      countParams
    );
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    params.push(pageSize, offset);
    const dataResult = await db.exec(
      `SELECT u.id, u.username, u.email, u.name, u.phone, u.avatar, u.isActive, u.createdAt, u.updatedAt
       FROM users u ${whereClause}
       ORDER BY u.createdAt DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const rows = formatRows(dataResult);
    const users = [];
    for (const row of rows) {
      const rolesResult = await db.exec(
        `SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`,
        [row.id]
      );
      const roles = formatRows(rolesResult);
      users.push({
        id: row.id, username: row.username, email: row.email, name: row.name, phone: row.phone,
        avatar: row.avatar, isActive: !!row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, roles
      });
    }

    return { users, total };
  }

  async getById(id: string) {
    const db = await getDb();
    const result = await db.exec(
      "SELECT id, email, name, phone, avatar, isActive, createdAt, updatedAt FROM users WHERE id = ?",
      [id]
    );
    const row = formatRow(result);
    if (!row) {
      throw new NotFoundError('User not found');
    }

    const rolesResult = await db.exec(
      `SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`, [id]
    );
    const roles = formatRows(rolesResult);

    return {
      id: row.id, username: row.username, email: row.email, name: row.name, phone: row.phone,
      avatar: row.avatar, isActive: !!row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, roles
    };
  }

  async create(data: CreateUserInput) {
    const db = await getDb();
    if (data.email) {
      const existingResult = await db.exec("SELECT id FROM users WHERE email = ?", [data.email]);
      const existing = formatRow(existingResult);
      if (existing) {
        throw new ConflictError('Email already exists');
      }
    }

    const id = generateId();
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const now = nowISO();
    const username = data.username || data.name.toLowerCase().replace(/\s+/g, '') + '_' + Date.now().toString(36);

    await db.run(
      `INSERT INTO users (id, username, email, password, name, phone, avatar, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, data.email || null, hashedPassword, data.name, data.phone || null, data.avatar || null,
       data.isActive !== false ? 1 : 0, now, now]
    );

    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        await db.run(
          "INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)",
          [generateId(), id, roleId]
        );
      }
    }

    return this.getById(id);
  }

  async update(id: string, data: UpdateUserInput) {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM users WHERE id = ?", [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (data.email) {
      const emailCheckResult = await db.exec("SELECT id FROM users WHERE email = ? AND id != ?", [data.email, id]);
      const emailCheck = formatRow(emailCheckResult);
      if (emailCheck) {
        throw new ConflictError('Email already exists');
      }
    }

    if (data.username) {
      const usernameCheckResult = await db.exec("SELECT id FROM users WHERE username = ? AND id != ?", [data.username, id]);
      const usernameCheck = formatRow(usernameCheckResult);
      if (usernameCheck) {
        throw new ConflictError('Username already exists');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email); }
    if (data.username !== undefined) { updates.push('username = ?'); params.push(data.username); }
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(data.phone); }
    if (data.avatar !== undefined) { updates.push('avatar = ?'); params.push(data.avatar); }
    if (data.isActive !== undefined) { updates.push('isActive = ?'); params.push(data.isActive ? 1 : 0); }
    if (data.password) {
      const hashed = await bcrypt.hash(data.password, 12);
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      params.push(nowISO());
      params.push(id);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (data.roleIds !== undefined) {
      await db.run("DELETE FROM user_roles WHERE userId = ?", [id]);
      for (const roleId of data.roleIds) {
        await db.run(
          "INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)",
          [generateId(), id, roleId]
        );
      }
    }

    return this.getById(id);
  }

  async delete(id: string) {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM users WHERE id = ?", [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    await db.run("DELETE FROM user_roles WHERE userId = ?", [id]);
    await db.run("DELETE FROM users WHERE id = ?", [id]);
  }

  async getTechnicians() {
    const db = await getDb();
    const result = await db.exec(
      `SELECT u.id, u.email, u.name, u.phone
       FROM users u
       JOIN user_roles ur ON u.id = ur.userId
       JOIN roles r ON ur.roleId = r.id
       WHERE r.name = 'TECHNICIAN' AND u.isActive = 1
       ORDER BY u.name ASC`
    );

    return formatRows(result);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const db = await getDb();
    const result = await db.exec(
      "SELECT id, password FROM users WHERE id = ?",
      [userId]
    );
    const row = formatRow(result);
    if (!row) {
      throw new NotFoundError('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, row.password);
    if (!valid) {
      throw new BadRequestError('Password saat ini salah');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.run(
      "UPDATE users SET password = ?, updatedAt = ? WHERE id = ?",
      [hashed, nowISO(), userId]
    );
  }
}

export const usersService = new UsersService();
