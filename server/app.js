'use strict';
/**
 * Shared app setup: builds the router and lazily runs the one-time DB init.
 * Used by both server/server.js (persistent local/VPS server) and
 * /api/[...path].js (Vercel serverless function), so the route registration
 * logic only lives in one place.
 */
const { init } = require('./lib/db');
const { Router } = require('./lib/http');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const searchRoutes = require('./routes/search');

function buildRouter() {
  const router = new Router();
  authRoutes.register(router);
  userRoutes.register(router);
  projectRoutes.register(router);
  taskRoutes.register(router);
  notificationRoutes.register(router);
  dashboardRoutes.register(router);
  reportsRoutes.register(router);
  searchRoutes.register(router);
  return router;
}

// Cached across warm invocations of the same serverless instance (and used
// once at boot for the persistent server). If init() fails, we clear the
// cache so the next request/invocation gets a clean retry instead of being
// stuck on a permanently-rejected promise.
let routerPromise = null;

async function getRouter() {
  if (!routerPromise) {
    routerPromise = init()
      .then(() => buildRouter())
      .catch((err) => {
        routerPromise = null;
        throw err;
      });
  }
  return routerPromise;
}

module.exports = { getRouter, deadlineSweep: dashboardRoutes.deadlineSweep };
