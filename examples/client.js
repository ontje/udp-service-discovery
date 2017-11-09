var udpDSCV = require('./../index.js')({ port: 8000, debug: true });

udpDSCV.listenOnce({name: "my-server", protocol: "ws"});

udpDSCV.on('discovery', function (service) {
	// you would try to connect your client to service.host : service.port
	console.log(service);
});
