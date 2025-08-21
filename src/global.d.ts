// Global type definitions

declare global {
  // Browser API globals used in deployment utilities
  const ReadableStream: {
    prototype: ReadableStream;
    new(underlyingSource?: UnderlyingSource): ReadableStream;
  };
  
  const TextEncoder: {
    prototype: TextEncoder;
    new(): TextEncoder;
  };
  
  const URLSearchParams: {
    prototype: URLSearchParams;
    new(init?: string | Record<string, string> | URLSearchParams): URLSearchParams;
  };
  
  const Blob: {
    prototype: Blob;
    new(blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
  };
  
  const Console: {
    prototype: Console;
    new(): Console;
  };
  
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Timeout {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Timer {}
  }
}

export {};