/// <reference types="node" />
import { EventEmitter } from 'events';
export interface UDPServiceDiscoveryOptions {
    port?: number;
    address?: string;
    announceInterval?: number;
    retryInterval?: number;
    debug?: boolean;
}
export declare class UDPServiceDiscovery extends EventEmitter {
    readonly status: string;
    private _opts;
    private _status;
    private _serviceListenFor;
    private _serviceListenOnce;
    private _socket;
    constructor(opts?: UDPServiceDiscoveryOptions);
    broadcast(name: string, ip?: string, port?: number, msg?: any, repeat?: number): void;
    listen(listenFor: any): void;
    listenOnce(listenFor: any): void;
    tryBinding(): void;
    private _start();
    close(): void;
    private _log(...msg);
    private _getJSONObjFromString(jsonString);
    private _getLocalIPAndNetmask();
    private _getBroadcastAddress(sender, ip, netmask);
}
