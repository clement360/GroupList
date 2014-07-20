var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendfile('index.html');
});

console.log("Started");

var users = [];
var userID = 0;
var messages = [];
var notices = [];
var messageIndex = 0;

io.sockets.on('connection', function (socket) {
    console.log("User Connected");
    userID++;
    socket.userID = userID;
    socket.username = "[placeHolder]";
    users[userID] = socket;
    var initialMessages = lastTwentyMessages(0);
    socket.emit('recentMessages', { lastTwenty: initialMessages.twenty, sentAll: initialMessages.sentAllMessages });

    socket.on('send', function (data) {
        console.log("\nSocketID: " + socket.userID);
        if(data.type == 'notice'){
            for(s in users){
                if(s.userID == this.userID)
                    s.username = data.hasOwnProperty('newNick')? data.newNick : data.nick;
            }
        }
                
        messages.push(data);
        io.sockets.emit('message', data);
    });

    socket.on('disconnect', function () { 
        io.sockets.emit('message', { type: 'notice', message: this.username + " has left the chat" });
        messages.push({ type: 'notice', message: this.username + " has left the chat" });
        users.splice(this.userID, 1);
    });
    socket.on('loadMore', function (data) {
        var loadedMessages = lastTwentyMessages(data.start);
        socket.emit('recentMessages', {
            lastTwenty: loadedMessages.twenty,
            sentAll: loadedMessages.sentAllMessages
        });
    });
    io.sockets.emit('newConnection', { users: users.length });
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