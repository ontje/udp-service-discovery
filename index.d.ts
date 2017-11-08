export interface UDPServiceDiscoveryOptions {
    port?: number;
    address?: string;
    announceInterval?: number;
    retryInterval?: number;
}

export interface UDPServiceDiscovery {
    broadcast(name: string, ip: string, port: number, msg: any, repeat: number);
    listen(listenFor: any);
    listenOnce(listenFor: any);
    tryBinding();
    close();
}

export function newUDPServiceDiscovery(opts: UDPServiceDiscoveryOptions): UDPServiceDiscovery
