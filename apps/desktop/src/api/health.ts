import { getApiBaseUrl } from "./config";

export type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

export async function fetchHealth(): Promise<{
  apiBaseUrl: string;
  health: HealthResponse;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    apiBaseUrl,
    health: await response.json(),
  };
}
