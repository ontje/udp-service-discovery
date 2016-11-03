# udp-service-discovery

Broadcasts Services via UDP (default port 12345) and listens to them on the client.
If listenOnce(servicename) is used, the listening port will be unbound upon recieving a matching service. Client automatically tries to rebind if port is in use, so multiple instances can easyly run on the same host (they will bind one after another).

## Example


Server:

    var udpServiceDiscovery = require('udp-service-discovery')();
    
    // name: my-server, ip: null (will be filled in by module), port: 1234
    udpServiceDiscovery.broadcast('my-server', null, 1234);


Client:

    var udpServiceDiscovery = require('udp-service-discovery')();
    
    udpServiceDiscovery.listenOnce('my-server');
    
    udpServiceDiscovery.on('discovery', function (discoveredService) {
	    console.log(discoveredService);
        // do something with discoveredService.host, discoveredService.port
    });
