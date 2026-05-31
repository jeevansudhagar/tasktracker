
const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const controller = require('./projects.controller');

const router = Router();

// All project routes require authentication
router.use(authenticate);

// GET /projects — all roles
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('isActive').optional().isBoolean(),
  ]),
  controller.listProjects
);

// GET /projects/:id — all roles
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid project ID')]),
  controller.getProject
);

// POST /projects — ADMIN | MANAGER
router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate([
    body('name').trim().notEmpty().withMessage('Project name is required').isLength({ min: 2, max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
  ]),
  controller.createProject
);

// PATCH /projects/:id — ADMIN | MANAGER
router.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate([
    param('id').isUUID().withMessage('Invalid project ID'),
    body('name').optional().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('isActive').optional().isBoolean(),
  ]),
  controller.updateProject
);

// DELETE /projects/:id — ADMIN only
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validate([param('id').isUUID().withMessage('Invalid project ID')]),
  controller.deleteProject
);

module.exports = router;
