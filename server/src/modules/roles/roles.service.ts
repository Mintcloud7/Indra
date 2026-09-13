import { getDb } from '../../database/connection';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { generateId, nowISO } from '../../shared/utils';

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

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export class RolesService {
  async list() {
    const db = await getDb();
    const result = await db.exec(
      `SELECT r.id, r.name, r.description, r.createdAt, r.updatedAt,
              (SELECT COUNT(*) FROM role_permissions rp WHERE rp.roleId = r.id) as permissionCount
       FROM roles r
       ORDER BY r.name ASC`
    );
    return formatRows(result);
  }

  async getById(id: string) {
    const db = await getDb();
    const result = await db.exec(
      "SELECT id, name, description, createdAt, updatedAt FROM roles WHERE id = ?", [id]
    );
    const row = formatRow(result);
    if (!row) {
      throw new NotFoundError('Role not found');
    }

    const permissionsResult = await db.exec(
      `SELECT p.id, p.name, p.module, p.action, p.description
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permissionId
       WHERE rp.roleId = ?
       ORDER BY p.module, p.action`,
      [id]
    );
    const permissions = formatRows(permissionsResult);

    return { ...row, permissions };
  }

  async create(data: CreateRoleInput) {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM roles WHERE name = ?", [data.name]);
    const existing = formatRow(existingResult);
    if (existing) {
      throw new ConflictError('Role name already exists');
    }

    const id = generateId();
    const now = nowISO();

    await db.run(
      `INSERT INTO roles (id, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.name, data.description || null, now, now]
    );

    if (data.permissionIds && data.permissionIds.length > 0) {
      for (const permissionId of data.permissionIds) {
        await db.run(
          "INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)",
          [generateId(), id, permissionId]
        );
      }
    }

    return this.getById(id);
  }

  async update(id: string, data: UpdateRoleInput) {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM roles WHERE id = ?", [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    if (data.name) {
      const nameCheckResult = await db.exec("SELECT id FROM roles WHERE name = ? AND id != ?", [data.name, id]);
      const nameCheck = formatRow(nameCheckResult);
      if (nameCheck) {
        throw new ConflictError('Role name already exists');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      params.push(nowISO());
      params.push(id);
      await db.run(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (data.permissionIds !== undefined) {
      await db.run("DELETE FROM role_permissions WHERE roleId = ?", [id]);
      for (const permissionId of data.permissionIds) {
        await db.run(
          "INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)",
          [generateId(), id, permissionId]
        );
      }
    }

    return this.getById(id);
  }

  async delete(id: string) {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM roles WHERE id = ?", [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    const usersWithRoleResult = await db.exec(
      "SELECT COUNT(*) as count FROM user_roles WHERE roleId = ?", [id]
    );
    const count = (usersWithRoleResult[0]?.values[0]?.[0] as number) || 0;
    if (count > 0) {
      throw new ConflictError('Cannot delete role that is assigned to users');
    }

    await db.run("DELETE FROM role_permissions WHERE roleId = ?", [id]);
    await db.run("DELETE FROM roles WHERE id = ?", [id]);
  }

  async getAllPermissions() {
    const db = await getDb();
    const result = await db.exec(
      `SELECT id, name, module, action, description
       FROM permissions
       ORDER BY module, action`
    );
    return formatRows(result);
  }
}

export const rolesService = new RolesService();
