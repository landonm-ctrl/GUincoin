import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database';
import transporter, { isEmailConfigured } from '../config/email';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface DependencyHealth {
  name: string;
  healthy: boolean;
  critical?: boolean;
  message?: string;
  durationMs: number;
}

export interface HealthSummary {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: DependencyHealth[];
  environment: {
    node: string;
    mode: string;
  };
}

const uploadsDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || 'uploads'
);

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
};

const checkDatabase = async (): Promise<DependencyHealth> => {
  const startedAt = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3_000);
    return {
      name: 'database',
      healthy: true,
      critical: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: 'database',
      healthy: false,
      critical: true,
      message:
        error instanceof Error ? error.message : 'Unable to reach database',
      durationMs: Date.now() - startedAt,
    };
  }
};

const checkUploadsDir = async (): Promise<DependencyHealth> => {
  const startedAt = Date.now();
  try {
    await fs.access(uploadsDir);
    return {
      name: 'uploads',
      healthy: true,
      critical: false,
      message: `Writable at ${uploadsDir}`,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: 'uploads',
      healthy: false,
      critical: false,
      message: `Uploads directory missing or not accessible at ${uploadsDir}`,
      durationMs: Date.now() - startedAt,
    };
  }
};

const checkOAuthConfig = (): DependencyHealth => {
  const configured =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);

  return {
    name: 'oauth',
    healthy: configured,
    critical: false,
    message: configured
      ? 'OAuth enabled'
      : 'Google OAuth credentials missing - login disabled',
    durationMs: 0,
  };
};

const checkEmail = async (): Promise<DependencyHealth> => {
  const startedAt = Date.now();
  if (!isEmailConfigured) {
    return {
      name: 'email',
      healthy: false,
      critical: false,
      message: 'SMTP credentials not configured - using console fallback',
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    await withTimeout(transporter.verify(), 3_000);
    return {
      name: 'email',
      healthy: true,
      critical: false,
      message: 'SMTP transporter ready',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: 'email',
      healthy: false,
      critical: false,
      message:
        error instanceof Error
          ? `SMTP verification failed: ${error.message}`
          : 'SMTP verification failed',
      durationMs: Date.now() - startedAt,
    };
  }
};

const deriveStatus = (dependencies: DependencyHealth[]): HealthStatus => {
  const criticalFailure = dependencies.some(
    (dep) => dep.critical !== false && !dep.healthy
  );
  if (criticalFailure) {
    return 'down';
  }

  const degraded = dependencies.some((dep) => !dep.healthy);
  return degraded ? 'degraded' : 'ok';
};

export function setSessionStoreType(_type: string): void {
  // Track session store type for health reporting
}

export const getHealthSummary = async (): Promise<HealthSummary> => {
  const [database, uploads, email] = await Promise.all([
    checkDatabase(),
    checkUploadsDir(),
    checkEmail(),
  ]);

  const oauth = checkOAuthConfig();

  const dependencies = [database, uploads, email, oauth];

  return {
    status: deriveStatus(dependencies),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    dependencies,
    environment: {
      node: process.version,
      mode: process.env.NODE_ENV || 'development',
    },
  };
};
