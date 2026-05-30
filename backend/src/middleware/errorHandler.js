'use strict';

/**
 * Global error handler middleware.
 * Must be registered LAST in Express — after all routes.
 *
 * Returns consistent JSON error format:
 * {
 *   status: <HTTP status code>,
 *   code:   <machine-readable error code>,
 *   message: <human-readable message>
 * }
 */
const errorHandler = (err, req, res, next) => {
  // Already sent — delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors?.map((e) => ({ field: e.path, message: e.message })) || [];
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Database validation failed',
      errors: messages,
    });
  }

  // Sequelize foreign key / constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      status: 400,
      code: 'CONSTRAINT_ERROR',
      message: 'Related resource not found or constraint violated',
    });
  }

  // JWT errors (passthrough from auth middleware — shouldn't reach here normally)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 401,
      code: 'INVALID_TOKEN',
      message: err.message,
    });
  }

  // Application-defined errors (thrown with err.statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      status: err.statusCode,
      code: err.code || 'APP_ERROR',
      message: err.message,
    });
  }

  // Unknown / internal errors
  const isDev = process.env.NODE_ENV === 'development';
  console.error('🔴 Unhandled error:', err);

  return res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  });
};

/**
 * Helper to create application errors consistently.
 * Usage: throw createError(404, 'NOT_FOUND', 'Task not found')
 */
const createError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

module.exports = { errorHandler, createError };
