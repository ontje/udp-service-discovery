var util = require('util');
var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var Netmask = require('netmask').Netmask;

// named export for typescript users
exports.newUDPServiceDiscovery = UDPServiceDiscovery;
// default export for node
module.exports = UDPServiceDiscovery;

function UDPServiceDiscovery(opts) {

    if (!(this instanceof UDPServiceDiscovery)) {
        return new UDPServiceDiscovery(opts);
    }

    this.emit('statusChanged', this.status);
    this.status = "INITIALIZING";

    this.opts = opts || {};

    this.broadcasterPort = typeof this.opts.port === 'undefined' ? 12345 : this.opts.port;
    this.broadcasterAddress = typeof this.opts.address === 'undefined' ? null : this.opts.address;
    this.announceInterval = typeof this.opts.announceInterval === 'undefined' ? 1000 : this.opts.announceInterval;

    this.retryInterval = typeof this.opts.retryInterval === 'undefined' ? 999 : this.opts.retryInterval;

    this.serviceListenFor = null;
    this.serviceListenOnce = false;

    // Setup UDP socket
    this.socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

    // Setup message handler
    this.socket.on('message', data => {
        var announcedService = JSONObjFromString(data);

        if (announcedService) {
            if (this.serviceListenFor) {
                var match = false;

                Object.keys(this.serviceListenFor).some(key => {
                    if (this.serviceListenFor[key] != announcedService[key]) {
                        match = false;
                        return true; // returning true on the first element that doesn't match to break the loop
                    } else {
                        match = true;
                    }
                });

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
    });

    this.socket.on('error', e => {
        if (e.code === 'EADDRINUSE') {
            this._log('UDPServiceDiscovery address/port ' + e.address + ':' + e.port + ' in use, retrying in ' + this.retryInterval + ' ms');

            setTimeout(this.tryBinding.bind(this), this.retryInterval);
        } else {
            this._log('UDPServiceDiscovery SocketError: ' + e);
        }
    });

    this.socket.on('listening', () => {
        this.socket.setBroadcast(true);

        // this.socket.setMulticastLoopback(true);
        // this.socket.addMembership(state.address, state.host);

        var address = this.socket.address();

        if (this.listenOnce) {
            this._log('UDPServiceDiscovery listening (once) on ' + address.address + ':' + address.port);
        } else {
            this._log('UDPServiceDiscovery listening (forever) on ' + address.address + ':' + address.port);
        }
    });

    this.socket.on('close', () => {
        this._log('UDPServiceDiscovery Closing socket.');
    });
}

util.inherits(UDPServiceDiscovery, EventEmitter);

// name, ip, port, json object, broadcast-repeats (0 or any number)
UDPServiceDiscovery.prototype.broadcast = function broadcast(name, ip, port, msg) {
    var service = { host: null };
    var interval;
    var repeat = 0;
    var runs = 0;
    var netmask;
    var host;
    var broadcastAddress;
    var announceMessage;

    switch (arguments.length) {
        case 5:
            repeat = arguments[4];
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
        if (repeat != 0 && runs >= repeat) {
            clearInterval(interval);
            this._log('Finished ' + repeat + ' broadcasts.');
            return;
        }

        var mask = getLocalIPAndNetmask();
        if (mask.length > 0 && mask[0].length > 0) {
            netmask = mask[0][1];
            host = mask[0][0];
            broadcastAddress = getBroadcastAddress(this, host, netmask);

            if (host !== service.host) {
                service.host = host;
                announceMessage = new Buffer(JSON.stringify(service));
                this.emit('statusChanged', this.status);
            }

            if (host) {
                this.socket.send(announceMessage, 0, announceMessage.length, this.broadcasterPort, broadcastAddress, (err, bytes) => {
                    runs++;
                    if (err) {
                        this._log("UDP - Error announcing!", err);
                        throw err;
                    } else {
                        if (this.status !== 'BROADCASTING') {
                            this.status = "BROADCASTING";
                            this.emit('statusChanged', this.status);
                        }
                    }
                });
            }
        } else {
            // Not connected
            this.status = "NOT_CONNECTED";
            this.emit('statusChanged', this.status);
        }
    });

    // announce once per second
    interval = setInterval(announce, this.announceInterval);
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

UDPServiceDiscovery.prototype._log = function log() {
    if (this.opts.debug === true) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(console, args);
    }
};

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

function getBroadcastAddress(sender, ip, netmask) {
    sender._log(ip, netmask);

    var block = new Netmask(ip + "/" + netmask);

    return block.broadcast;
}
