var util = require('util');
var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var Netmask = require('netmask').Netmask;

module.exports = UDPServiceDiscovery;

function UDPServiceDiscovery (opts) {
    if (!(this instanceof UDPServiceDiscovery)) {
        return new UDPServiceDiscovery(opts);
    }

    opts = opts || {};

    this.broadcasterPort = typeof opts.port === 'undefined' ? 12345 : opts.port;
    this.broadcasterAddress = typeof opts.address === 'undefined' ? null : opts.address;
    this.announceInterval = typeof opts.announceInterval === 'undefined' ? 1000 : opts.announceInterval;

    this.serviceListenFor = null;
    this.serviceListenOnce = false;

    var self = this;

    // Setup UDP socket
    this.socket = dgram.createSocket('udp4');

    // Setup message handler
    this.socket.on('message', function (data) {
        var announcedService = JSONObjFromString(data);

        if (announcedService) {
            if (self.serviceListenFor) {
                var match = false;

                Object.keys(self.serviceListenFor).forEach(function(key) {
                    if (self.serviceListenFor[key] === announcedService[key]) {
                        match = true;
                    } else {
                        match = false;
                    }
                });

                if (match) {
                    self.emit('discovery', announcedService);

                    if (self.serviceListenOnce) {
                        self.close();
                    }
                } else {
                    // no match
                }
            } else {
                self.emit('discovery', announcedService);

                if (self.serviceListenOnce) {
                    self.close();
                }
            }
        }
    });

    this.socket.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            setTimeout(self.tryBinding, 210);
            console.log('[UDPServiceDiscovery] Retrying to open port');
        } else {
            console.log('[UDPServiceDiscovery] Err: ' + e);
        }
    });

    this.socket.on('listening', function () {
        self.socket.setBroadcast(true);

        // self.socket.setMulticastLoopback(true);
        // self.socket.addMembership(state.address, state.host);

        var address = this.address();
        console.log('Listening on ' + address.address + ':' + address.port);
    });

    this.socket.on('close', function () {
        console.log('closing socket');
    });
}

// name, ip, port, json object
// json object
UDPServiceDiscovery.prototype.broadcast = function broadcast() {
    var service = {};
    var self = this;
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

    service.host = null;


    function announce() {
        var mask = getLocalIPAndNetmask();

        if(mask.length > 0 && mask[0].length > 0) {
            netmask = mask[0][1];
            host = mask[0][0];
            broadcastAddress = getBroadcastAddress(service.host, netmask);
            if (host !== service.host) {
                service.host = host;
                announceMessage = new Buffer(JSON.stringify(service));
            }
            self.socket.send(announceMessage, 0, announceMessage.length, self.broadcasterPort, broadcastAddress, function (err, bytes) {
                if (err) {
                    console.log("UDP - Error announcing!", err);
                    throw err;
                } else {

                }
                console.log("UDP - announce ", service.host);
            });

        } else {
            // Not connected
            console.log("Not Connected");
        }
    }

    // announce 4 times per seconds
    setInterval(announce, this.announceInterval);
};

UDPServiceDiscovery.prototype.listen = function listen(listenFor) {
    this.serviceListenOnce = false;

    if (listenFor) {
        if (typeof listenFor  === 'string' && !JSONObjFromString(listenFor)) {
            this.serviceListenFor = {};
            this.serviceListenFor.name = listenFor;
        } else {
            if (typeof listenFor  === 'string') {
                this.serviceListenFor = JSONObjFromString(listenFor);
            } else {
                this.serviceListenFor = listenFor;
            }
        }
    }

    this.tryBinding();
};

UDPServiceDiscovery.prototype.listenOnce = function listenOnce (listenFor) {
    this.serviceListenOnce = true;
    if (listenFor) {
        if (typeof listenFor  === 'string' && !JSONObjFromString(listenFor)) {
            this.serviceListenFor = {};
            this.serviceListenFor.name = listenFor;
        } else {
            if (typeof listenFor  === 'string') {
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
    } catch (err) { }
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
    var block = new Netmask(ip  + "/" +  netmask);

    return block.broadcast;
}
