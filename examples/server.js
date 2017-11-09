var udpDSCV = require('./../index.js')({ port: 8000, debug: true });

// broadcasts name: 'my-server', ip: gets filled in by library, port: 4321, additional key/value {"protocol": "tcp"}, repeat
udpDSCV.broadcast('my-server', null, 4321, { "protocol": "tcp", "other": 42 }); // broadcast indefinitely
udpDSCV.broadcast('my-server', null, 3000, { "protocol": "ws", "other": 42 }, 15); // broadcast 15 times
