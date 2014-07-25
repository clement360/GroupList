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
var messageIndex = 0;
var groupList = [];

io.sockets.on('connection', function (socket) {

    console.log("User Connected");
    userID++;
    socket.userID = userID;
    socket.username = "[placeHolder]";
    users.push(socket);
    var initialMessages = lastTwentyMessages(0);
    
    //Send Initial data
    socket.emit('recentMessages', { lastTwenty: initialMessages.twenty, sentAll: initialMessages.sentAllMessages });
    socket.emit('currentGroupList', groupList);

    socket.on('send', function (data) {
        console.log("\nSocketID: " + socket.userID);
        if(data.type == 'notice'){
            users[userIndex(this.userID)].username = data.username;
        }
                
        messages.push(data);
        io.sockets.emit('message', data);
    });

    socket.on('disconnect', function () { 
        io.sockets.emit('message', { type: 'notice', message: this.username + " has left the chat" });
        messages.push({ type: 'notice', message: this.username + " has left the chat" });
        users.splice(userIndex(this.userID), 1);
        io.sockets.emit('newConnection', { users: users.length });
    });
    
    socket.on('reset', function () {
        messageIndex = 0;
        messages.length = 0;
        groupList.length = 0;
    });
    
    socket.on('newTrack', function (data) {
        if (!idAlreadyExists(data.id)) {
            data.index = groupList.length + 1;
            data.score = 0;
            groupList.push(data);
            io.sockets.emit('newTrack', data);
        }
    });
    
    socket.on('removeTrack', function (data) {
        var removedIndex = findTrackById(data.id);
        updateTrailingindices(removedIndex + 1, groupList[removedIndex].index);
        groupList.splice(removedIndex, 1);
        io.sockets.emit('removeTrack', data);
    });

    socket.on('loadMore', function (data) {
        var loadedMessages = lastTwentyMessages(data.start);
        socket.emit('recentMessages', {
            lastTwenty: loadedMessages.twenty,
            sentAll: loadedMessages.sentAllMessages
        });
    });
    
    socket.on('vote', function (data) {
        handleVote(data);
    });

    io.sockets.emit('newConnection', { users: users.length });
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});

function userIndex(id) {
    for (var r = 0; r < users.length; r++)
        if (users[r].userID == id)
            return r;
    console.log("Error: user with id ("+id+") not found.")
    return 0;
}

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

    return {
        twenty: result,
        sentAllMessages: (messageIndex == -1)
    };
}

function idAlreadyExists(id) {
    for (var i = 0; i < groupList.length; i++)
        if (groupList[i].id == id)
            return true;
    return false;
}

function handleVote(data) { 
    var track = groupList[findTrackById(data.id)];
    switch (data.type) {
        case 'upVote':
            track.score += 1;
            break;
        case 'removeUpVote':
            track.score -= 1;
            break;
        case 'switchToUpVote':
            track.score += 2;
            break;
        case 'downVote':
            track.score -= 1;
            break;
        case 'removeDownVote':
            track.score += 1;
            break;
        case 'switchToDownVote':
            track.score -= 2;
            break;
        default:
            console.log('Error: illegal vote type (' + data.type + ')');
    }
    organizeGroupList();
    io.sockets.emit('vote', { id: track.id, score: track.score });
}

function findTrackById(id) {
    for (var i = 0; i < groupList.length; i++)
        if (groupList[i].id == id)
            return i;
    console.log('track not found (client.js : findTrackById)');
    return -1;
}

function updateIndex(id, index) {
    groupList[findTrackById(id)].index = index;
}

function updateTrailingindices(indexAfterDelete, index) {
    if (indexAfterDelete < groupList.length) {
        for (var i = indexAfterDelete; i < groupList.length; i++) {
            updateIndex(groupList[i].id, index);
            index++;
        }
    }
}

function organizeGroupList() {
    var oldListOrder = [];
    for (var i = 0; i < groupList.length; i++) {
        oldListOrder.push({ id: groupList[i].id, index: groupList[i].index });
    }
    groupList.sort(compareTracks);
    for (var i = 0; i < groupList.length; i++) {
        groupList[i].index = i + 1;
    }
}

function compareTracks(a, b) {
    if (a.score < b.score)
        return 1;
    if (a.score > b.score)
        return -1;
    return 0;
}