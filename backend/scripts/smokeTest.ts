type Dependency = {
  name: string;
  healthy: boolean;
  message?: string;
};

type HealthResponse = {
  status: 'ok' | 'degraded' | 'down';
  dependencies: Dependency[];
};

type StoreProduct = {
  id: string;
  name: string;
  priceGuincoin: number;
};

const baseUrl =
  process.env.SMOKE_BASE_URL ||
  `http://localhost:${process.env.PORT || 5000}`;
const storeCookie = process.env.SMOKE_AUTH_COOKIE;
const minStoreProducts = Number(process.env.SMOKE_STORE_MIN || '0');

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
};

const prettyDependencies = (deps: Dependency[]) =>
  deps
    .map((dep) => `${dep.healthy ? '[OK]' : '[WARN]'} ${dep.name}`)
    .join(', ');

async function runSmokeTests() {
  console.log(`Running smoke test against ${baseUrl}`);

  try {
    const response = await withTimeout(
      fetch(`${baseUrl}/health`, {
        headers: {
          'User-Agent': 'GuincoinSmokeTest/1.0',
        },
      }),
      5_000
    );

    const payload = (await response.json()) as HealthResponse;

    if (!response.ok || payload.status !== 'ok') {
      console.error('Smoke test failed - service not healthy', payload);
      process.exit(1);
    }

    console.log(
      `Health check succeeded (${payload.status}). Dependencies: ${prettyDependencies(
        payload.dependencies
      )}`
    );

    if (!storeCookie) {
      console.warn('Skipping store API checks (SMOKE_AUTH_COOKIE not set).');
      return;
    }

    const storeResponse = await withTimeout(
      fetch(`${baseUrl}/api/store/products`, {
        headers: {
          'User-Agent': 'GuincoinSmokeTest/1.0',
          Cookie: storeCookie,
        },
      }),
      5_000
    );

    if (!storeResponse.ok) {
      const body = await storeResponse.text();
      console.error('Store API check failed', storeResponse.status, body);
      process.exit(1);
    }

    const storeProducts = (await storeResponse.json()) as StoreProduct[];
    if (storeProducts.length < minStoreProducts) {
      console.error(
        `Store API check failed - expected at least ${minStoreProducts} products, got ${storeProducts.length}`
      );
      process.exit(1);
    }

    console.log(`Store API check succeeded (${storeProducts.length} products).`);
  } catch (error) {
    console.error('Smoke test failed with unexpected error:', error);
    process.exit(1);
  }
}

runSmokeTests();
