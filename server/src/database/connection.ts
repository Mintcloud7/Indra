let cachedDb: any = null;

export async function getDb() {
  if (cachedDb) return cachedDb;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    cachedDb = createHttpDb(tursoUrl, tursoToken);
  } else {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  }

  return cachedDb;
}

function createHttpDb(baseUrl: string, authToken: string) {
  const httpUrl = baseUrl.replace('libsql://', 'https://');

  async function execute(sql: string, args: any[] = []): Promise<any> {
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args: args.map(convertArg) } },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Turso HTTP error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const result = data.results?.[0]?.response;
    if (!result) return { columns: [], values: [] };

    if (result.type === 'error') {
      throw new Error(result.message);
    }

    const res = result.result;
    if (!res) return { columns: [], values: [] };

    const columns = (res.cols || []).map((c: any) => c.name || c.column);
    const values = (res.rows || []).map((row: any[]) =>
      row.map((cell: any) => {
        if (cell && typeof cell === 'object') {
          if (cell.type === 'null' || cell.type === undefined) return null;
          if ('value' in cell) {
            const v = cell.value;
            if (cell.type === 'integer') return parseInt(v, 10);
            if (cell.type === 'float') return parseFloat(v);
            return v;
          }
        }
        return cell;
      })
    );

    return { columns, values };
  }

  async function executeBatch(statements: { sql: string; args?: any[] }[]): Promise<void> {
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: statements.map(s => ({
          type: 'execute',
          stmt: { sql: s.sql, args: (s.args || []).map(convertArg) },
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Turso HTTP batch error ${response.status}: ${text}`);
    }
  }

  function convertArg(arg: any): any {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') {
      if (Number.isInteger(arg)) return { type: 'integer', value: String(arg) };
      return { type: 'float', value: String(arg) };
    }
    if (typeof arg === 'string') return { type: 'text', value: arg };
    if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
    return { type: 'text', value: String(arg) };
  }

  return {
    exec: async (sql: string, params?: any[]) => {
      const result = await execute(sql, params);
      return [{
        columns: result.columns,
        values: result.values,
      }];
    },
    run: async (sql: string, params?: any[]) => {
      await execute(sql, params);
    },
    execBatch: async (statements: { sql: string; params?: any[] }[]) => {
      const response = await fetch(`${httpUrl}/v2/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: statements.map(s => ({
            type: 'execute',
            stmt: { sql: s.sql, args: (s.params || []).map(convertArg) },
          })),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Turso HTTP batch error ${response.status}: ${text}`);
      }

      const data = await response.json();
      return (data.results || []).map((r: any) => {
        const res = r.response?.result;
        if (!res) return { columns: [], values: [] };
        const columns = (res.cols || []).map((c: any) => c.name || c.column);
        const values = (res.rows || []).map((row: any[]) =>
          row.map((cell: any) => {
            if (cell && typeof cell === 'object') {
              if (cell.type === 'null' || cell.type === undefined) return null;
              if ('value' in cell) {
                const v = cell.value;
                if (cell.type === 'integer') return parseInt(v, 10);
                if (cell.type === 'float') return parseFloat(v);
                return v;
              }
            }
            return cell;
          })
        );
        return { columns, values };
      });
    },
  };
}

export async function batchExecute(statements: { sql: string; args?: any[] }[]): Promise<void> {
  const db = await getDb();
  await (db as any)._batch?.(statements) || executeBatchRaw(statements);
}

async function executeBatchRaw(statements: { sql: string; args?: any[] }[]) {
  const tursoUrl = process.env.TURSO_DATABASE_URL!;
  const tursoToken = process.env.TURSO_AUTH_TOKEN!;
  const httpUrl = tursoUrl.replace('libsql://', 'https://');

  const response = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tursoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: statements.map(s => ({
        type: 'execute',
        stmt: { sql: s.sql, args: (s.args || []).map((a: any) => {
          if (a === null || a === undefined) return { type: 'null' };
          if (typeof a === 'number') return { type: Number.isInteger(a) ? 'integer' : 'float', value: String(a) };
          return { type: 'text', value: String(a) };
        })},
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Turso batch error: ${response.status}`);
  }
}

export function scheduleSave(): void {}
export function saveDb(): void {}
export function closeDb(): void { cachedDb = null; }
