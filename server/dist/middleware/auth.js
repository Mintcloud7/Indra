"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("../shared/errors");
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-in-production';
function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errors_1.UnauthorizedError('Missing or invalid authorization header');
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, AUTH_SECRET);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.roles,
            permissions: decoded.permissions
        };
        next();
    }
    catch (err) {
        if (err instanceof errors_1.UnauthorizedError) {
            next(err);
        }
        else {
            next(new errors_1.UnauthorizedError('Invalid or expired token'));
        }
    }
}
