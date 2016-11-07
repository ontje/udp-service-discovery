var udpDSCV = require('./../index.js')({port: 8000});

udpDSCV.listenOnce('my-server');

udpDSCV.on('discovery', function (service) {
	// you would try to connect your client to service.host : service.port
	console.log(service);
});
