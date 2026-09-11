"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const dashboard_service_1 = require("./dashboard.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('dashboard', 'read'), async (req, res, next) => {
    try {
        const dashboard = await dashboard_service_1.dashboardService.getFullDashboard();
        (0, response_1.sendSuccess)(res, dashboard);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
