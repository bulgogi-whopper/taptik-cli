import { createServer } from 'node:net';

/**
 * Find an available port in the specified range
 */
export async function findAvailablePort(
  startPort: number = 60_000,
  endPort: number = 65_535,
  maxAttempts: number = 100
): Promise<number> {
  const endRange = Math.min(startPort + maxAttempts - 1, endPort);
  const ports = Array.from({ length: endRange - startPort + 1 }, (_, i) => startPort + i);
  
  // Check all ports in parallel batches to avoid ESLint await-in-loop warning
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < ports.length; i += batchSize) {
    const batch = ports.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  // Process all batches and find the first available port
  const batchPromises = batches.map(batch => 
    Promise.all(
      batch.map(async (port) => ({
        port,
        available: await isPortAvailable(port)
      }))
    )
  );
  
  const allResults = await Promise.all(batchPromises);
  
  // Flatten results and find first available port
  for (const batchResults of allResults) {
    const availablePort = batchResults.find(result => result.available);
    if (availablePort) {
      return availablePort.port;
    }
  }

  throw new Error(
    `Could not find an available port in range ${startPort}-${endRange} after checking ${Math.min(maxAttempts, endRange - startPort + 1)} ports`
  );
}

/**
 * Check if a specific port is available
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get a random port in the 60000-65535 range
 */
export function getRandomPortInRange(min: number = 60_000, max: number = 65_535): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}