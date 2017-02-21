var util = require('util');
var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var Netmask = require('netmask').Netmask;

module.exports = UDPServiceDiscovery;

function UDPServiceDiscovery(opts) {

    if (!(this instanceof UDPServiceDiscovery)) {
        return new UDPServiceDiscovery(opts);
    }

    this.emit('statusChanged', this.status);
    this.status = "INITIALIZING";

    opts = opts || {};

    this.broadcasterPort = typeof opts.port === 'undefined' ? 12345 : opts.port;
    this.broadcasterAddress = typeof opts.address === 'undefined' ? null : opts.address;
    this.announceInterval = typeof opts.announceInterval === 'undefined' ? 1000 : opts.announceInterval;

    this.serviceListenFor = null;
    this.serviceListenOnce = false;

    // Setup UDP socket
    this.socket = dgram.createSocket('udp4');

    // Setup message handler
    this.socket.on('message', ((data) => {
        var announcedService = JSONObjFromString(data);

        if (announcedService) {
            if (this.serviceListenFor) {
                var match = false;

                Object.keys(this.serviceListenFor).forEach(((key) => {
                    if (this.serviceListenFor[key] === announcedService[key]) {
                        match = true;
                    } else {
                        match = false;
                    }
                }));

                if (match) {
                    this.emit('discovery', announcedService);

                    if (this.serviceListenOnce) {
                        this.close();
                    }
                } else {
                    // no match
                }
            } else {
                this.emit('discovery', announcedService);

                if (this.serviceListenOnce) {
                    this.close();
                }
            }
        }
    }));

    this.socket.on('error', ((e) => {
        if (e.code === 'EADDRINUSE') {
            setTimeout(this.tryBinding, 210);
            console.log('[UDPServiceDiscovery] Retrying to open port');
        } else {
            console.log('[UDPServiceDiscovery] Err: ' + e);
        }
    }));

    this.socket.on('listening', (() => {
        this.socket.setBroadcast(true);

        // self.socket.setMulticastLoopback(true);
        // self.socket.addMembership(state.address, state.host);

        var address = this.socket.address();
        console.log('Listening on ' + address.address + ':' + address.port);
    }));

    this.socket.on('close', (() => {
        console.log('closing socket');
    }));
}

// name, ip, port, json object
// json object
UDPServiceDiscovery.prototype.broadcast = function broadcast() {
    var service = {host: null};
    var netmask;
    var host;
    var broadcastAddress;
    var announceMessage;

    switch (arguments.length) {
        case 4:
            if (typeof arguments[3] === 'string') {
                service = JSONObjFromString(arguments[3]);
            } else {
                service = arguments[3];
            }
        case 3:
            service.port = arguments[2];
        case 2:
            service.host = arguments[1];
            service.name = arguments[0];
            break;
        case 1:
            service = JSONObjFromString(arguments[0]);
            break;
    }
    announceMessage = new Buffer(JSON.stringify(service));

    announce = (() => {
        var mask = getLocalIPAndNetmask();
        //var service = this.service;
        if (mask.length > 0 && mask[0].length > 0) {
            netmask = mask[0][1];
            host = mask[0][0];
            broadcastAddress = getBroadcastAddress(host, netmask);
            if (host !== service.host) {
                service.host = host;
                announceMessage = new Buffer(JSON.stringify(service));
                this.emit('statusChanged', this.status);
            }
            if (host) {
                this.socket.send(announceMessage, 0, announceMessage.length, this.broadcasterPort, broadcastAddress, ((err, bytes) => {
                    if (err) {
                        console.log("UDP - Error announcing!", err);
                        throw err;
                    } else {
                        if (this.status !== 'BROADCASTING') {
                            this.status = "BROADCASTING";
                            this.emit('statusChanged', this.status);
                        }
                    }

                }));

            }
        } else {
            // Not connected
            this.status = "NOT_CONNECTED";
            this.emit('statusChanged', this.status);
        }
    });

    // announce once per second
    setInterval(announce, this.announceInterval);
};

UDPServiceDiscovery.prototype.listen = function listen(listenFor) {
    this.serviceListenOnce = false;

    if (listenFor) {
        if (typeof listenFor === 'string' && !JSONObjFromString(listenFor)) {
            this.serviceListenFor = {};
            this.serviceListenFor.name = listenFor;
        } else {
            if (typeof listenFor === 'string') {
                this.serviceListenFor = JSONObjFromString(listenFor);
            } else {
                this.serviceListenFor = listenFor;
            }
        }
    }

    this.tryBinding();
};

UDPServiceDiscovery.prototype.listenOnce = function listenOnce(listenFor) {
    this.serviceListenOnce = true;
    if (listenFor) {
        if (typeof listenFor === 'string' && !JSONObjFromString(listenFor)) {
            this.serviceListenFor = {};
            this.serviceListenFor.name = listenFor;
        } else {
            if (typeof listenFor === 'string') {
                this.serviceListenFor = JSONObjFromString(listenFor);
            } else {
                this.serviceListenFor = listenFor;
            }
        }
    }

    this.tryBinding();
};

UDPServiceDiscovery.prototype.tryBinding = function tryBinding() {
    this.socket.bind(this.broadcasterPort, this.broadcasterAddress);
};

UDPServiceDiscovery.prototype.close = function close() {
    this.socket.close();
};

util.inherits(UDPServiceDiscovery, EventEmitter);

function JSONObjFromString(jsonString) {
    try {
        var o = JSON.parse(jsonString);

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

function getLocalIPAndNetmask() {
    var networkInterfaces = require('os').networkInterfaces();
    var matches = [];

    Object.keys(networkInterfaces).forEach(function (item) {
        networkInterfaces[item].forEach(function (address) {
            if (address.internal === false && address.family === 'IPv4') {
                matches.push([address.address, address.netmask]);
            }
        });
    });

    return matches;
}

function getBroadcastAddress(ip, netmask) {
    console.log(ip, netmask);
    var block = new Netmask(ip + "/" + netmask);

    return block.broadcast;
}
