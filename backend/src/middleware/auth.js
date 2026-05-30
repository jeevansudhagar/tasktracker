'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Verify JWT access token from Authorization header.
 * Attaches req.user = { id, email, role, organizationId }
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      return res.status(401).json({ status: 401, code, message: err.message });
    }

    // Verify user still exists and is active
    const user = await User.findOne({
      where: { id: decoded.id, isActive: true },
      attributes: ['id', 'email', 'role', 'organizationId', 'name'],
    });

    if (!user) {
      return res.status(401).json({
        status: 401,
        code: 'USER_NOT_FOUND',
        message: 'User no longer exists or is deactivated',
      });
    }

    req.user = user.toJSON();
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };
