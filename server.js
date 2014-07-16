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
var messages = [];
var notices = [];
var messageIndex = 0;

io.sockets.on('connection', function (socket) {
    console.log("User Connected");
    currentConnections++;

    var initialMessages = lastTwentyMessages(0);
    socket.emit('recentMessages', { lastTwenty: initialMessages.twenty, sentAll: initialMessages.sentAllMessages });

    socket.on('send', function (data) {
        messages.push(data);
        io.sockets.emit('message', data);
    });

    socket.on('requestMessages', function (data) {
        io.sockets.emit('getMessages', { messages: messages });
    });

    socket.on('disconnect', function () { currentConnections--; });
    socket.on('loadMore', function (data) {
        var loadedMessages = lastTwentyMessages(data.start);
        socket.emit('recentMessages', {
            lastTwenty: loadedMessages.twenty,
            sentAll: loadedMessages.sentAllMessages
        });
    });
    io.sockets.emit('newConnection', { users: currentConnections });
});

console.log("Running");

http.listen(3000, function () {
    console.log('listening on *:3000');
});

function lastTwentyMessages(start) {
    var result = [];
    var prev;
    var x = start;
    for (; x <= start + 20; x++) {
        prev = messages[messages.length - x - 1];
        if (prev == null)
            break;
        else
            result.push(prev);
    }
    messageIndex = messages.length - x - 1;
    console.log("Start = " + start + ", messages.length = " + messages.length+", messageIndex = " +messageIndex+ ", result.length = " + result.length);
    return {
        twenty: result,
        sentAllMessages: (messageIndex == -1)
    };
}