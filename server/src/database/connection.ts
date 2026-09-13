import { createClient, Client } from '@libsql/client';

let client: Client | null = null;

export async function getDb() {
  if (client) return createDbWrapper(client);

  client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://indra-mintcloud.aws-ap-northeast-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  return createDbWrapper(client);
}

function createDbWrapper(c: Client) {
  return {
    exec: async (sql: string, params?: any[]) => {
      const result = await c.execute({ sql, args: params || [] });
      return [{
        columns: result.columns,
        values: result.rows.map((row: any) => result.columns.map((col: string) => row[col]))
      }];
    },
    run: async (sql: string, params?: any[]) => {
      await c.execute({ sql, args: params || [] });
    },
  };
}

export async function batchExecute(statements: { sql: string; args?: any[] }[]): Promise<void> {
  if (!client) await getDb();
  await client!.batch(statements.map(s => ({ sql: s.sql, args: s.args || [] })));
}

export function scheduleSave(): void {
  // No-op: Turso handles persistence automatically
}

export function saveDb(): void {
  // No-op: Turso handles persistence automatically
}

export async function closeDb(): Promise<void> {
  if (client) {
    client.close();
    client = null;
  }
}
