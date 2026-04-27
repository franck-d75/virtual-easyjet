declare module "msfs-simconnect-api-wrapper" {
  export type SimConnectOptions = {
    autoReconnect?: boolean;
    retries?: number;
    retryInterval?: number;
    host?: string;
    port?: number;
    onConnect?: () => void;
    onRetry?: (retriesLeft: number, retryInterval: number) => void;
    onException?: (exceptionName: string) => void;
  };

  export class MSFS_API {
    public connected?: boolean;
    public connect(options?: SimConnectOptions): void;
    public get(...propNames: string[]): Promise<Record<string, unknown>>;
  }
}
