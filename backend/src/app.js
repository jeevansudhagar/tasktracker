
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { syncDatabase } = require('./models');
const { connectRedis } = require('./config/redis');
const { errorHandler } = require('./middleware/errorHandler');

// Route modules
const authRoutes       = require('./modules/auth/auth.routes');
const usersRoutes      = require('./modules/users/users.routes');
const tasksRoutes      = require('./modules/tasks/tasks.routes');
const projectsRoutes   = require('./modules/projects/projects.routes');
const analyticsRoutes  = require('./modules/analytics/analytics.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health Check

app.get('/health', (req, res) => {
  res.json({
    status: 200,
    message: 'Task Tracker API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Routes

app.use('/api/v1/auth',       authRoutes);
app.use('/api/v1/users',      usersRoutes);
app.use('/api/v1/tasks',      tasksRoutes);
app.use('/api/v1/projects',   projectsRoutes);
app.use('/api/v1/analytics',  analyticsRoutes);

// 404 Handler

app.use('*', (req, res) => {
  res.status(404).json({
    status: 404,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handler (must be last)

app.use(errorHandler);

// Bootstrap

const start = async () => {
  try {
    // Connect to Redis (optional — app works without it)
    await connectRedis();

    // Sync Sequelize models to MySQL
    // alter:true — safe for development; use migrations for production
    await syncDatabase({ alter: true });

    app.listen(PORT, () => {
      console.log(`\n Task Tracker API started`);
      console.log(`   Environment : ${process.env.NODE_ENV}`);
      console.log(`   Port        : ${PORT}`);
      console.log(`   URL         : http://localhost:${PORT}`);
      console.log(`   Health      : http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error(' Failed to start server:', err);
    process.exit(1);
  }
};

start();

module.exports = app; // for testing
