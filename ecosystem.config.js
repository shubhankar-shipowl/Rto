module.exports = {
  apps: [
    {
      name: "rto-application",
      script: "node",
      args: "-e \"const { spawn } = require('child_process'); const path = require('path'); require('dotenv').config(); console.log('🚀 Starting RTO (combined mode) ...'); const backend = spawn('node', ['server/src/index.js'], { cwd: path.resolve(__dirname), env: { ...process.env }, stdio: ['ignore','pipe','pipe'] }); const frontend = spawn('npm', ['run','preview'], { cwd: path.resolve(__dirname, 'client'), env: { ...process.env, NODE_ENV: 'production', PORT: process.env.FRONTEND_PORT || 4173 }, stdio: ['ignore','pipe','pipe'] }); backend.stdout.on('data', d => process.stdout.write(`[Backend] ${d}`)); backend.stderr.on('data', d => process.stderr.write(`[Backend Error] ${d}`)); frontend.stdout.on('data', d => process.stdout.write(`[Frontend] ${d}`)); frontend.stderr.on('data', d => process.stderr.write(`[Frontend Error] ${d}`)); const shutdown = () => { console.log('Shutting down combined app...'); try { backend.kill('SIGTERM'); } catch(_){} try { frontend.kill('SIGTERM'); } catch(_){} process.exit(0); }; process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown); \"",
      cwd: "/Users/shubhankarhaldar/Desktop/rto",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_file: ".env",
      env: {
        NODE_ENV: "development",
        PORT: 5003,
        FRONTEND_PORT: 4173,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5003,
        FRONTEND_PORT: 4173,
      },
    },
  ],
};
