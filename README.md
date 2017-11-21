# udp-service-discovery

Broadcasts Services via UDP (default every second via port 12345) and listens to them on the client.
If listenOnce(servicename) is used, the listening port will be unbound upon recieving a matching service. Client automatically tries to rebind if port is in use, so multiple instances can easyly run on the same host (they will bind one after another).

## Example


Server:

	var UDPServiceDiscovery = require('../dist/udp-service-discovery.js').UDPServiceDiscovery
    var udpDSCV = new UDPServiceDiscovery({port: 8000});

    // broadcasts name: 'my-server', ip: null (filled in by library), port: 4321, additional key/value {"protocol": "tcp"}
    udpDSCV.broadcast('my-server', null, 4321, {"protocol": "tcp", "other": 42});



Client:

	var UDPServiceDiscovery = require('../dist/udp-service-discovery.js').UDPServiceDiscovery
    var udpDSCV = new UDPServiceDiscovery({port: 8000});

    udpDSCV.listenOnce('my-server');

    udpDSCV.on('discovery', function (service) {
        // you would try to connect your client to service.host : service.port
        console.log(service);
    });
