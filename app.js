var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
<<<<<<< HEAD
var fs = require('fs');
var mongoose = require('mongoose'); 
=======
var mongoose = require('mongoose');
>>>>>>> FETCH_HEAD

app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.sendfile('index.html');
});
var port = Number(process.env.PORT || 3000);

http.listen(port, function () {
    console.log('listening on *' + port);
});

<<<<<<< HEAD

//load all files in models dir
fs.readdirSync(__dirname + '/models').forEach(function(filename) {
  if (~filename.indexOf('.js')) require(__dirname + '/models/' + filename)
});

// mongoose schemas
app.get('/users', function (req, res) {
    mongoose.model('users').find(function(err, users) {
        res.send(users);
    });
});

// database connection
mongoose.connect('mongodb://localhost:27017/test');
var db = mongoose.connection;
db.once('open', function (callback) {
    var User = mongoose.model('User', userSchema);
    var silence = new User({ name: 'Silence' });
    var fluffy = new User({ name: 'fluffy' });
    fluffy.save(function (err, fluffy) { if (err) return console.error(err); });
    silence.save(function (err, silence) { if (err) return console.error(err); });
    User.find(function (err, users) {
        if (err) return console.error(err);
        console.log(users);
    })
});

// global values
var users = [];
var messages = [];
var groupList = [];
var userID = 0;
var messageIndex = 0;
var colorIndex = 0;

var colors = ['#e5ed74', '#b5d4a1', '#C5AAE3','#7ba694','#308A72','#575751','#527ec4','#a4a4a4','#ffa897','#f77472','#fc8c6a','#fecb7f','#dbbd9b', '#decbc1', '#f2eac2'];

io.sockets.on('connection', function (socket) {

=======
console.log("Started");

// global values
var users = [];
var userID = 0;
var messages = [];
var messageIndex = 0;
var colorIndex = 0;
var groupList = [];
var colors = ['#e5ed74', '#b5d4a1', '#C5AAE3','#7ba694','#308A72','#575751','#527ec4','#a4a4a4','#ffa897','#f77472','#fc8c6a','#fecb7f','#dbbd9b', '#decbc1', '#f2eac2'];

io.sockets.on('connection', function (socket) {
    
>>>>>>> FETCH_HEAD
    //make this a running list later
    var usernames = [];
    for (u in users) 
        if(users[u].username != '[placeHolder]' && users[u].connected)
            usernames.push({ username: users[u].username, color: users[u].color});
    
    socket.emit('currentUsernames', usernames);

    socket.on('send', function (data) {
        if(data.type == 'notice'){
            users[userIndex(this.userID)].username = data.username;
        }
        data.color = this.color;        
        messages.push(data);
        io.sockets.emit('message', data);
    });

    socket.on('disconnect', function () { 
        io.sockets.emit('userDisconnection', { username: this.username });
        //users.splice(userIndex(this.userID), 1);
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
            data.votes = [];
            groupList.push(data);
            io.sockets.emit('newTrack', data);
            organizeGroupList();
        }
    });
    

    socket.on('removeTrack', function (data) {
        var removedIndex = findTrackById(data.id);
        updateTrailingindices(removedIndex + 1, groupList[removedIndex].index);
        groupList.splice(removedIndex, 1);
        io.sockets.emit('removeTrack', data);
    });
    
    socket.on('newUser', function (data) {
        var error = null;
        
        // error is null for all these cases
        // error has been temporarily removed (add when accounts are ready)
        var temp = getUserIfExists(data.username);
        if (temp == null) {
            userID++;
            socket.userID = userID;
            socket.username = data.username;
            socket.color = assignColor();
            users.push(socket);
<<<<<<< HEAD
            var newGuy = new User({name: data.username, color: socket.color });
=======
>>>>>>> FETCH_HEAD
            socket.emit('newUser', { error: null, username: null, setCookie: true });
        }
        else {
            // in this case the user is returning so we bind their user info to the new socket
            socket.userID = temp.socket.userID;
            socket.color = temp.socket.color;
            // we only keep the original username's case
            socket.username = temp.socket.username;
            users[temp.index] = socket;
            socket.emit('newUser', {error: null, username: socket.username, setCookie: false});
        }
<<<<<<< HEAD

=======
        
>>>>>>> FETCH_HEAD
    });
    
    socket.on('userConnected', function () {
        io.sockets.emit('userConnection', { username: this.username, color: this.color });
        var initialMessages = lastTwentyMessages(messages.length - 1);
        
        //Send Initial data
        socket.emit('recentMessages', { lastTwenty: initialMessages.twenty, sentAll: initialMessages.sentAll });
        socket.emit('currentGroupList', groupList);
    });

    socket.on('loadMore', function (data) {
        var loadedMessages = lastTwentyMessages(data.start);
        socket.emit('recentMessages', {
            lastTwenty: loadedMessages.twenty,
            sentAll: loadedMessages.sentAll
        });
    });
    
    socket.on('vote', function (data) {
        handleVote(data);
    });

    socket.on('retrieveGroupList', function (data) {
        socket.emit('latestGoupList', groupList);
    });
    
});


function userIndex(id) {
    for (var r = 0; r < users.length; r++)
        if (users[r].userID == id)
            return r;
    console.log("Error: user with id ("+id+") not found.")
    return -1;
}

function lastTwentyMessages(start) {
    var result = [];
    var prev;
    var x = 0;
    var oldestIndex = 1;
    for (; x <= 20; x++) {
        prev = messages[start - x];
        
        if (prev == null)
            break;
        else{
            prev.index = start - x;
            result.push(prev);
        }
    }
    if (result.length > 0)
        oldestIndex = result[result.length - 1].index;
    if (start == -1)
        oldestIndex = 0;
    return {twenty: result, sentAll: oldestIndex == 0};
}

function idAlreadyExists(id) {
    for (var i = 0; i < groupList.length; i++)
        if (groupList[i].id == id)
            return true;
    return false;
}

function handleVote(data) { 
    var voteState;
    var track = groupList[findTrackById(data.id)];
    var oldVoteState = getVote(track, data.username);
    if (data.type == 'upVote') {
        switch (oldVoteState) {
            case -1:
                track.score += 2;
                voteState = 1;
                break;
            case -2:
            case 0:
                track.score += 1;
                voteState = 1;
                break;
            case 1:
                track.score -= 1;
                voteState = 0;
                break;
        }
    }
    else {
        switch (oldVoteState) {
            case -1:
                track.score += 1;
                voteState = 0;
                break;
            case -2:
            case 0:
                track.score -= 1;
                voteState = -1;
                break;
            case 1:
                track.score -= 2;
                voteState = -1;
                break;
        }
    }

    setVotes(track, data.username, voteState);
    organizeGroupList();
    io.sockets.emit('vote', { id: track.id, score: track.score, votes: track.votes, username: data.username });
}

function setVotes(track, username, voteState) {
    var voteIndex = getVoteIndex(track, username);
    if (voteIndex == -1) {
        track.votes.push({username: username, voteState: voteState});
    }
    else { 
        track.votes[voteIndex].voteState = voteState;
    }
}

// returns voteState for track by user
function getVote(track, username) {
    for (i in track.votes) {
        if (track.votes[i].username == username)
            return track.votes[i].voteState;
    }
    // vote does not exist -> return -2 because -1 denotes negative vote
    return -2;
}

// returns index of vote in a specific track's votes list by user
function getVoteIndex(track, username) {
    for (i in track.votes) {
        if (track.votes[i].username == username)
            return i;
    }
    // vote does not exist -> return -1
    return -1;
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

<<<<<<< HEAD
=======
// temporarily removed
//function usernameExistsAndConnected(username) {
//    for (u in users)
//        if (users[u].username.toLowerCase() == username.toLowerCase() && users[u].connected)
//            return true;
//    return false;
//}

>>>>>>> FETCH_HEAD
function assignColor() {
    if (colorIndex >= colors.length)
        colorIndex = 0;
    var color = colors[colorIndex];
    colorIndex++;
    return color;
}

function getUserIfExists(username) {
    for (u in users)
        if (users[u].username.toLowerCase() == username.toLowerCase())
            return { socket: users[u], index: u };
    return null;
}