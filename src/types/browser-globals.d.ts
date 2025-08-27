// Browser-specific global type overrides
declare global {
  function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearTimeout(id: number): void;
  function clearInterval(id: number): void;
}

export {};