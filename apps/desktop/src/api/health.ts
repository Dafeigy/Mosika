import { getApiBaseUrl } from "./config";

export type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

type FetchHealthOptions = {
  attempts?: number;
  intervalMs?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchHealth(options: FetchHealthOptions = {}): Promise<{
  apiBaseUrl: string;
  health: HealthResponse;
}> {
  const attempts = options.attempts ?? 1;
  const intervalMs = options.intervalMs ?? 500;
  const apiBaseUrl = await getApiBaseUrl();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/health`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        apiBaseUrl,
        health: await response.json(),
      };
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(intervalMs);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Unable to connect to local server after ${attempts} attempts: ${message}`);
}
