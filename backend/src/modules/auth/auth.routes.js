
const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const controller = require('./auth.controller');

const router = Router();

// Validation rules

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('organizationName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Organization name must be 2-150 characters'),
  body('organizationId')
    .optional()
    .isUUID()
    .withMessage('organizationId must be a valid UUID'),
  body('role')
    .optional()
    .isIn(['ADMIN', 'MANAGER', 'MEMBER'])
    .withMessage('Role must be ADMIN, MANAGER, or MEMBER'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshRules = [
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
];

// Routes

// Public routes
router.post('/register', validate(registerRules), controller.register);
router.post('/login',    validate(loginRules),    controller.login);
router.post('/refresh',  validate(refreshRules),  controller.refresh);

// Protected routes
router.post('/logout', authenticate, controller.logout);
router.get('/me',      authenticate, controller.me);

module.exports = router;
