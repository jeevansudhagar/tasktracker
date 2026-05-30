'use strict';

const { validationResult } = require('express-validator');

/**
 * validate(validations)
 * Runs express-validator rules and returns a formatted error response if any fail.
 *
 * Usage:
 *   router.post('/login', validate([
 *     body('email').isEmail(),
 *     body('password').notEmpty(),
 *   ]), controller.login)
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations in parallel
    await Promise.all(validations.map((v) => v.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));

    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: formatted,
    });
  };
};

module.exports = { validate };
