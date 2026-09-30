import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { authRouter } from './server/auth/routes';
import { companyRouter } from './server/company/routes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Body parsing middleware
  app.use(express.json());

  // Mount API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/companies', companyRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'LedgerPulse ERP — Accounting & Operating System',
      version: '1.0.0-phase04',
      timestamp: new Date().toISOString(),
      mcaCompliance: 'COMPLIANT_MCA_2013_AUDIT_LOG_ACTIVE',
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LedgerPulse ERP] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[LedgerPulse ERP] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err) => {
  console.error('[LedgerPulse ERP] Fatal error starting server:', err);
  process.exit(1);
});
