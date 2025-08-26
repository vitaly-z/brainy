/**
 * Type declarations for optional dependencies
 * These are not required for core functionality but may be used by certain augmentations
 */

declare module 'express' {
  const express: any
  export default express
  export const Router: any
  export const Request: any
  export const Response: any
  export const NextFunction: any
}

declare module 'cors' {
  const cors: any
  export default cors
}

declare module 'ws' {
  export class WebSocket {
    constructor(url: string, options?: any)
    on(event: string, listener: Function): void
    send(data: any): void
    close(): void
    readyState: number
    static OPEN: number
    static CLOSED: number
  }
  
  export class Server {
    constructor(options?: any)
    on(event: string, listener: Function): void
    handleUpgrade(request: any, socket: any, head: any, callback: Function): void
  }
  
  export default WebSocket
}