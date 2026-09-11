import crypto from 'crypto';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateWoNumber(woCount: number): string {
  const year = new Date().getFullYear();
  const seq = String(woCount + 1).padStart(6, '0');
  return `WO-${year}-${seq}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function paginate(page: number = 1, limit: number = 20): { offset: number; limit: number } {
  const p = Math.max(1, page);
  const l = Math.min(100, Math.max(1, limit));
  return { offset: (p - 1) * l, limit: l };
}

export function sanitizeForLog(obj: any): any {
  const sensitive = ['password', 'token', 'apiKey', 'secret', 'authorization'];
  const cleaned = { ...obj };
  for (const key of Object.keys(cleaned)) {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      cleaned[key] = '[REDACTED]';
    }
  }
  return cleaned;
}
