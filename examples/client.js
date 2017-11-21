var UDPServiceDiscovery = require('../dist/udp-service-discovery.js').UDPServiceDiscovery
var udpDSCV = new UDPServiceDiscovery({ port: 6000, debug: true });

udpDSCV.listenOnce({name: "my-server", protocol: "ws"});

udpDSCV.on('discovery', function (service) {
	// you would try to connect your client to service.host : service.port
	console.log(service);
});
