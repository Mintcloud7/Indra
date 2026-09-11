"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateWoNumber = generateWoNumber;
exports.nowISO = nowISO;
exports.paginate = paginate;
exports.sanitizeForLog = sanitizeForLog;
const crypto_1 = __importDefault(require("crypto"));
function generateId() {
    return crypto_1.default.randomUUID();
}
function generateWoNumber(woCount) {
    const year = new Date().getFullYear();
    const seq = String(woCount + 1).padStart(6, '0');
    return `WO-${year}-${seq}`;
}
function nowISO() {
    return new Date().toISOString();
}
function paginate(page = 1, limit = 20) {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    return { offset: (p - 1) * l, limit: l };
}
function sanitizeForLog(obj) {
    const sensitive = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    const cleaned = { ...obj };
    for (const key of Object.keys(cleaned)) {
        if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
            cleaned[key] = '[REDACTED]';
        }
    }
    return cleaned;
}
