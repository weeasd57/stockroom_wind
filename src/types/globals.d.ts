// Global type definitions to resolve TypeScript errors

// Phoenix WebSocket library (if used by Supabase)
declare module 'phoenix' {
  export class Socket {
    constructor(endPoint: string, opts?: any);
    connect(): void;
    disconnect(): void;
    channel(topic: string, params?: any): Channel;
  }
  
  export class Channel {
    constructor(topic: string, params: any, socket: Socket);
    join(): Push;
    leave(): Push;
    push(event: string, payload: any): Push;
    on(event: string, callback: (payload: any) => void): void;
  }
  
  export class Push {
    receive(status: string, callback: (response: any) => void): Push;
  }
}

// WebSocket library
declare module 'ws' {
  export default class WebSocket extends EventTarget {
    constructor(url: string, protocols?: string | string[], options?: any);
    close(code?: number, reason?: string): void;
    send(data: string | Buffer | ArrayBuffer): void;
    readyState: number;
    url: string;
    protocol: string;
    
    static CONNECTING: number;
    static OPEN: number;
    static CLOSING: number;
    static CLOSED: number;
  }
  
  export interface WebSocketServer {
    new (options?: any): WebSocketServer;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

// Extend window object if needed
declare global {
  interface Window {
    __CSP_NONCE__?: string;
  }
}

export {};
