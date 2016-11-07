var util = require('util');
var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;

module.exports = UDPServiceDiscovery;

function UDPServiceDiscovery (opts) {
	if (!(this instanceof UDPServiceDiscovery)) {
		return new UDPServiceDiscovery(opts);
	}

	opts = opts || {};

	this.localPort = typeof opts.port === 'undefined' ? 12345 : opts.port;
	this.localAddress = typeof opts.address === 'undefined' ? null : opts.address;
	this.announceInterval = typeof opts.announceInterval === 'undefined' ? 250 : opts.announceInterval;

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
				if (announcedService.name === self.serviceListenFor) {
					self.emit('discovery', announcedService);

					if (self.serviceListenOnce) {
						self.close();
					}
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

    // fill in IP if null
	service.host = service.host || getLocalIPs()[0];

	var self = this;
	var announceMessage = new Buffer(JSON.stringify(service));

	function announce() {
		self.socket.send(announceMessage, 0, announceMessage.length, self.localPort, '', function (err, bytes) {
			if (err) {
				throw err;
			}
		});
	}

    // announce 4 times per seconds
	setInterval(announce, this.announceInterval);
};

UDPServiceDiscovery.prototype.listen = function listen(serviceName) {
	this.serviceListenOnce = false;
	if (serviceName) {
		this.listenFor = serviceName;
	}

	this.tryBinding();
};

UDPServiceDiscovery.prototype.listenOnce = function listenOnce (serviceName) {
	this.serviceListenOnce = true;

	if (serviceName) {
		this.serviceListenFor = serviceName;
	}

	this.tryBinding();
};

UDPServiceDiscovery.prototype.tryBinding = function tryBinding() {
	this.socket.bind(this.localPort, this.localAddress);
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

function getLocalIPs() {
	var networkInterfaces = require('os').networkInterfaces();
	var matches = [];

	Object.keys(networkInterfaces).forEach(function (item) {
		networkInterfaces[item].forEach(function (address) {
			if (address.internal === false && address.family === 'IPv4') {
				matches.push(address.address);
			}
		});
	});

	return matches;
}
