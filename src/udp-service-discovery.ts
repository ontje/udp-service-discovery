import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { Netmask } from 'netmask';


export interface UDPServiceDiscoveryOptions {
    port?: number;
    address?: string;
    announceInterval?: number;
    retryInterval?: number;
}

interface Service {
    host: string;
    port?: number;
    name?: string;
}

export class UDPServiceDiscovery extends EventEmitter {
    public get status() {
        return this._status;
    }

    private _opts: UDPServiceDiscoveryOptions;
    private _status = 'INITIALIZING';
    private _serviceListenFor = null;
    private _serviceListenOnce = false;
    private _socket: dgram.Socket;

    constructor(opts?: UDPServiceDiscoveryOptions) {
        super();

        this._opts = {
            port: 12345,
            address: null,
            announceInterval: 1000,
            retryInterval: 999
        };

        if (typeof opts !== 'undefined') {
            Object.assign(this._opts, opts);
        }

        this._start();
    }

    broadcast(name: string, ip?: string, port?: number, msg?: any, repeat: number = 0) {
        let service: Service = { host: null };
        let interval;
        let runs = 0;
        let netmask;
        let host;
        let broadcastAddress;
        let announceMessage;

        switch (arguments.length) {
            case 5:
            case 4:
                if (typeof msg === 'string') {
                    service = this._getJSONObjFromString(msg);
                } else {
                    service = msg;
                }
            case 3:
                service.port = port;
            case 2:
                service.host = ip;
                service.name = name;
                break;
            case 1:
                service = this._getJSONObjFromString(arguments[0]);
                break;
        }

        announceMessage = new Buffer(JSON.stringify(service));

        const announce = (() => {
            if (repeat !== 0 && runs >= repeat) {
                clearInterval(interval);
                this._log('Finished ' + repeat + ' broadcasts.');
                return;
            }

            const mask = this._getLocalIPAndNetmask();
            if (mask.length > 0 && mask[0].length > 0) {
                netmask = mask[0][1];
                host = mask[0][0];
                broadcastAddress = this._getBroadcastAddress(this, host, netmask);

                if (host !== service.host) {
                    service.host = host;
                    announceMessage = new Buffer(JSON.stringify(service));
                    this.emit('statusChanged', this.status);
                }

                if (host) {
                    this._socket.send(announceMessage, 0, announceMessage.length, this._opts.port, broadcastAddress, (err, bytes) => {
                        runs++;
                        if (err) {
                            this._log('UDP - Error announcing!', err);
                            throw err;
                        } else {
                            if (this.status !== 'BROADCASTING') {
                                this._status = 'BROADCASTING';
                                this.emit('statusChanged', this.status);
                            }
                        }
                    });
                }
            } else {
                // Not connected
                this._status = 'NOT_CONNECTED';
                this.emit('statusChanged', this.status);
            }
        });

        // announce once per second
        interval = setInterval(announce, this._opts.announceInterval);
    }

    listen(listenFor) {
        this._serviceListenOnce = false;

        if (listenFor) {
            if (typeof listenFor === 'string' && !this._getJSONObjFromString(listenFor)) {
                this._serviceListenFor = {};
                this._serviceListenFor.name = listenFor;
            } else {
                if (typeof listenFor === 'string') {
                    this._serviceListenFor = this._getJSONObjFromString(listenFor);
                } else {
                    this._serviceListenFor = listenFor;
                }
            }
        }

        this.tryBinding();
    }

    listenOnce(listenFor) {
        this._serviceListenOnce = true;
        if (listenFor) {
            if (typeof listenFor === 'string' && !this._getJSONObjFromString(listenFor)) {
                this._serviceListenFor = {};
                this._serviceListenFor.name = listenFor;
            } else {
                if (typeof listenFor === 'string') {
                    this._serviceListenFor = this._getJSONObjFromString(listenFor);
                } else {
                    this._serviceListenFor = listenFor;
                }
            }
        }

        this.tryBinding();
    }

    tryBinding() {
        this._socket.bind(this._opts.port, this._opts.address);
    }

    private _start() {
        // Setup UDP socket

        this._socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

        // Setup message handler
        this._socket.on('message', data => {
            const announcedService = this._getJSONObjFromString(data.toString());

            if (announcedService) {
                if (this._serviceListenFor) {
                    let match = false;

                    Object.keys(this._serviceListenFor).some(key => {
                        if (this._serviceListenFor[key] !== announcedService[key]) {
                            match = false;
                            return true; // returning true on the first element that doesn't match to break the loop
                        } else {
                            match = true;
                        }
                    });

                    if (match) {
                        this.emit('discovery', announcedService);

                        if (this._serviceListenOnce) {
                            this.close();
                        }
                    } else {
                        // no match
                    }
                } else {
                    this.emit('discovery', announcedService);

                    if (this._serviceListenOnce) {
                        this.close();
                    }
                }
            }
        });

        this._socket.on('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
                this._log('UDPServiceDiscovery address/port ' + e.address + ':' + e.port + ' in use, retrying in ' +
                    this._opts.retryInterval + ' ms');

                setTimeout(this.tryBinding.bind(this), this._opts.retryInterval);
            } else {
                this._log('UDPServiceDiscovery SocketError: ' + e);
            }
        });

        this._socket.on('listening', () => {
            this._socket.setBroadcast(true);

            // this.socket.setMulticastLoopback(true);
            // this.socket.addMembership(state.address, state.host);

            const address = this._socket.address();

            if (this.listenOnce) {
                this._log('UDPServiceDiscovery listening (once) on ' + address.address + ':' + address.port);
            } else {
                this._log('UDPServiceDiscovery listening (forever) on ' + address.address + ':' + address.port);
            }
        });

        this._socket.on('close', () => {
            this._log('UDPServiceDiscovery Closing socket.');
        });
    }

    close() {
        this._socket.close();
    }

    private _log(...msg) {
        console.log(...msg);
    }

    private _getJSONObjFromString(jsonString: string) {
        try {
            const o = JSON.parse(jsonString);

            // Handle non-exception-throwing cases:
            // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
            // but... JSON.parse(null) returns null, and typeof null === "object",
            // so we must check for that, too. Thankfully, null is falsey, so this suffices:
            if (o && typeof o === 'object') {
                return o;
            }
        } catch (err) {
        }
        return null;
    }

    private _getLocalIPAndNetmask() {
        const networkInterfaces = require('os').networkInterfaces();
        const matches = [];

        Object.keys(networkInterfaces).forEach(function (item) {
            networkInterfaces[item].forEach(function (address) {
                if (address.internal === false && address.family === 'IPv4') {
                    matches.push([address.address, address.netmask]);
                }
            });
        });

        return matches;
    }

    private _getBroadcastAddress(sender, ip, netmask) {
        sender._log(ip, netmask);

        const block = new Netmask(ip + '/' + netmask);

        return block.broadcast;
    }
}
