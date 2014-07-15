var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var currentConnections = 0;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendfile('index.html');
});

console.log("Started");

io.sockets.on('connection', function (socket) {
    console.log("User Connected");
    currentConnections++;

    socket.on('send', function (data) {
        io.sockets.emit('message', data);
        console.log("Message Sent");
    });

    socket.on('disconnect', function () { currentConnections--; });

    io.sockets.emit('newConnection', { users: currentConnections });
});

console.log("Running");

http.listen(3000, function () {
    console.log('listening on *:3000');
});