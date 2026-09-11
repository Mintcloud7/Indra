"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const connection_1 = require("../../database/connection");
const utils_1 = require("../../shared/utils");
const adapter_registry_1 = require("./adapters/adapter-registry");
const integration_queue_service_1 = require("./queue/integration-queue.service");
const router = (0, express_1.Router)();
function formatRow(result, index = 0) {
    if (!result[0] || !result[0].values[index])
        return null;
    const obj = {};
    result[0].columns.forEach((col, i) => {
        obj[col] = result[0].values[index][i];
    });
    return obj;
}
function formatRows(result) {
    if (!result[0])
        return [];
    return result[0].values.map((row) => {
        const obj = {};
        result[0].columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}
router.get('/providers', (req, res, next) => {
    try {
        (0, response_1.sendSuccess)(res, adapter_registry_1.SUPPORTED_PROVIDERS);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:provider/config', async (req, res, next) => {
    try {
        const { provider } = req.params;
        const db = await (0, connection_1.getDb)();
        const prefix = `${provider}_`;
        const result = db.exec("SELECT key, value, description FROM integration_configs WHERE key LIKE ?", [`${prefix}%`]);
        const rows = formatRows(result);
        const configs = {};
        for (const row of rows) {
            const field = row.key.replace(prefix, '');
            configs[field] = { value: row.value, description: row.description };
        }
        (0, response_1.sendSuccess)(res, configs);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:provider/config', async (req, res, next) => {
    try {
        const { provider } = req.params;
        const db = await (0, connection_1.getDb)();
        const now = new Date().toISOString();
        const body = req.body;
        const fieldMap = {
            apiUrl: 'api_url',
            apiKey: 'api_key',
            companyId: 'company_id',
            tenantId: 'tenant_id',
            realmId: 'realm_id',
            accessToken: 'access_token',
            useMock: 'use_mock',
        };
        const descMap = {
            api_url: `${provider} API URL`,
            api_key: `${provider} API Key`,
            company_id: `${provider} Company ID`,
            tenant_id: `${provider} Tenant ID`,
            realm_id: `${provider} Realm ID`,
            access_token: `${provider} Access Token`,
            use_mock: 'Use mock adapter',
        };
        for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
            if (body[jsKey] !== undefined) {
                const key = `${provider}_${dbKey}`;
                const value = String(body[jsKey]);
                const desc = descMap[dbKey] || key;
                const existingResult = db.exec("SELECT key FROM integration_configs WHERE key = ?", [key]);
                const existing = formatRow(existingResult);
                if (existing) {
                    db.run("UPDATE integration_configs SET value = ?, updatedAt = ? WHERE key = ?", [value, now, key]);
                }
                else {
                    db.run("INSERT INTO integration_configs (id, key, value, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)", [(0, utils_1.generateId)(), key, value, desc, now, now]);
                }
            }
        }
        adapter_registry_1.adapterRegistry.invalidateCache(provider);
        (0, response_1.sendSuccess)(res, { message: `${provider} configuration saved` });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:provider/test', async (req, res, next) => {
    try {
        const { provider } = req.params;
        const adapter = await adapter_registry_1.adapterRegistry.getAdapter(provider);
        const success = await adapter.testConnection();
        (0, response_1.sendSuccess)(res, { success, message: success ? 'Connection successful' : 'Connection failed' });
    }
    catch (err) {
        next(err);
    }
});
router.get('/jobs', async (req, res, next) => {
    try {
        const jobs = await integration_queue_service_1.integrationQueueService.getJobs({
            status: req.query.status,
            type: req.query.type,
            provider: req.query.provider,
        });
        (0, response_1.sendSuccess)(res, jobs);
    }
    catch (err) {
        next(err);
    }
});
router.post('/jobs/:id/retry', async (req, res, next) => {
    try {
        const job = await integration_queue_service_1.integrationQueueService.retryJob(req.params.id);
        (0, response_1.sendSuccess)(res, job);
    }
    catch (err) {
        next(err);
    }
});
router.post('/process', async (req, res, next) => {
    try {
        const result = await integration_queue_service_1.integrationQueueService.processAllPending();
        (0, response_1.sendSuccess)(res, result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/logs', async (req, res, next) => {
    try {
        const db = await (0, connection_1.getDb)();
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
        let where = 'WHERE 1=1';
        const params = [];
        if (req.query.provider) {
            where += ' AND provider = ?';
            params.push(req.query.provider);
        }
        if (req.query.type) {
            where += ' AND type = ?';
            params.push(req.query.type);
        }
        if (req.query.status) {
            where += ' AND status = ?';
            params.push(req.query.status);
        }
        const countResult = db.exec(`SELECT COUNT(*) as total FROM integration_logs ${where}`, params);
        const total = countResult[0]?.values[0]?.[0] || 0;
        const dataResult = db.exec(`SELECT * FROM integration_logs ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
        const data = formatRows(dataResult);
        (0, response_1.sendPaginated)(res, data, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
router.get('/failed-jobs', async (req, res, next) => {
    try {
        const db = await (0, connection_1.getDb)();
        let where = "WHERE status IN ('FAILED', 'DEAD_LETTER')";
        const params = [];
        if (req.query.provider) {
            where += ' AND provider = ?';
            params.push(req.query.provider);
        }
        const dataResult = db.exec(`SELECT * FROM integration_jobs ${where} ORDER BY createdAt DESC LIMIT 50`, params);
        const data = formatRows(dataResult);
        for (const obj of data) {
            if (obj.payload && typeof obj.payload === 'string') {
                try {
                    obj.payload = JSON.parse(obj.payload);
                }
                catch { }
            }
        }
        (0, response_1.sendSuccess)(res, data);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
