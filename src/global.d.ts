// Global type definitions

declare global {
  // Browser API globals used in deployment utilities
  const ReadableStream: {
    prototype: ReadableStream;
    new (underlyingSource?: UnderlyingSource): ReadableStream;
  };

  const TextEncoder: {
    prototype: TextEncoder;
    new (): TextEncoder;
  };

  const URLSearchParams: {
    prototype: URLSearchParams;
    new (
      init?: string | Record<string, string> | URLSearchParams,
    ): URLSearchParams;
  };

  const Blob: {
    prototype: Blob;
    new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
  };

  const Console: {
    prototype: Console;
    new (): Console;
  };

  // NodeJS namespace types are already provided by @types/node
  // No need to redeclare Timer and Timeout interfaces
}

export {};
