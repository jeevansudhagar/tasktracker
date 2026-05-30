'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { Task, User } = require('../../models');
const { getCache, setCache } = require('../../config/redis');
const sequelize = require('../../config/database');
const { QueryTypes } = require('sequelize');

const router = Router();
router.use(authenticate);
router.use(requireRole('ADMIN', 'MANAGER'));

/**
 * GET /analytics/overdue-summary
 * Bonus: overdue task count per user + avg completion time
 * Uses SQL window functions for aggregation.
 */
router.get('/overdue-summary', async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const cacheKey = `analytics:overdue:${orgId}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json({ status: 200, data: cached, meta: { cache: 'HIT' } });

    const overdue = await sequelize.query(
      `SELECT
         u.id        AS userId,
         u.name      AS userName,
         u.email     AS userEmail,
         COUNT(t.id) AS overdueCount
       FROM users u
       LEFT JOIN tasks t
         ON t.assigneeId = u.id
        AND t.dueDate < CURDATE()
        AND t.status NOT IN ('DONE', 'BLOCKED')
       WHERE u.organizationId = :orgId
         AND u.isActive = 1
       GROUP BY u.id, u.name, u.email
       ORDER BY overdueCount DESC`,
      { replacements: { orgId }, type: QueryTypes.SELECT }
    );

    const avgCompletion = await sequelize.query(
      `SELECT
         u.id   AS userId,
         u.name AS userName,
         ROUND(
           AVG(DATEDIFF(t.updatedAt, t.createdAt)), 2
         ) AS avgDaysToComplete
       FROM tasks t
       JOIN users u ON u.id = t.assigneeId
       WHERE t.status = 'DONE'
         AND t.organizationId = :orgId
       GROUP BY u.id, u.name`,
      { replacements: { orgId }, type: QueryTypes.SELECT }
    );

    const result = { overdueSummary: overdue, avgCompletionTime: avgCompletion };
    await setCache(cacheKey, result, 600); // 10 minutes cache

    return res.json({ status: 200, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analytics/task-status-breakdown
 * Task counts per status per project in the org
 */
router.get('/task-status-breakdown', async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const cacheKey = `analytics:status-breakdown:${orgId}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json({ status: 200, data: cached, meta: { cache: 'HIT' } });

    const breakdown = await sequelize.query(
      `SELECT
         p.id       AS projectId,
         p.name     AS projectName,
         t.status,
         COUNT(t.id) AS count
       FROM projects p
       LEFT JOIN tasks t ON t.projectId = p.id
       WHERE p.organizationId = :orgId
         AND p.isActive = 1
       GROUP BY p.id, p.name, t.status
       ORDER BY p.name, t.status`,
      { replacements: { orgId }, type: QueryTypes.SELECT }
    );

    await setCache(cacheKey, breakdown, 300);
    return res.json({ status: 200, data: { breakdown } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
