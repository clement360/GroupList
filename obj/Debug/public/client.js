var socket = io();
var nick = '[Client]';
var connected = 0;
var oldestMessageID = 0;
var timer = null;
var currentlyPlaying = null;
var $currentlyPlayingSpan = null;
var debugging = false;
var groupList = [];

$(document).ready(function () {
    $('#username').bind('keypress', function (e) {
        if (e.keyCode == 13) {
            event.preventDefault();
            sendUser();
        }
    });
    $('#m').bind('keypress', function (e) {
        if (e.keyCode == 13) {
            event.preventDefault();
            sendMsg();
        }
    });
    
    $('#search').keydown(function (e) {
        if (e.keyCode == 13) {
            event.preventDefault();
            searchSoundCloud(true);
        }
    });
    
    var $Controls = $('#right, #left');
    $Controls.mouseenter(function () {
        $(this).css("opacity", ".5");
    });
    $Controls.mouseleave(function () {
        $(this).css("opacity", ".05");
    });
    
    openModal();
    
    $('.carousel').carousel({
        interval: false
    });
    $('#username').focus();
    
    $('#footPlay').click(function () { footerPlay(); });
});

socket.on('newConnection', function (data) {
    connected = data.users;
    $('.online').text(connected);
});

// ----------------------------------------------------------------------------------
// -                               Chat Functions                                   -
// ----------------------------------------------------------------------------------

socket.on('recentMessages', function (data) {
    oldestMessageID += data.lastTwenty.length;
    (oldestMessageID > 21) ? prependMessages(data.lastTwenty, false, data.sentAll) : prependMessages(data.lastTwenty, true, data.sentAll);
});

socket.on('message', function (data) {
    if (data.type == 'chat') {
        if (data.nick == nick)
            $('#chats').append('<div class="me"><div>' + data.message + '</div></div>');
        else
            $('#chats').append('<div class="others"><div>' + data.message + ' - ' + '<strong>' + data.nick + '</strong></div></div>');
    }
    else if (data.type == "notice") {
        $('#chats').append($('<div>').html('<div class="notice">' + data.message));
    }
    else if (data.type == "tell" && data.to == nick) {
        $('#chats').append($('<li>').text(data.message));
    }
    else if (data.type == "emote") {
        $('#chats').append($('<li>').text(data.message));
    }
    scrollToBottom();
});

socket.on('currentGroupList', function (data) {
    if (data.length > 0) {
        $('#groupListPlaceHolder').hide();
        groupList = data;
        renderGroupList();
    }
});

socket.on('newTrack', function (data) {
    $('#groupListPlaceHolder').hide();
    if (data.username == nick)
        updateIndex(data.id, data.index);
    if (!idAlreadyExists(data.id)) {
        groupList.push(data);
        renderGroupList();
    }
});

socket.on('vote', function (data) {
    updateScore(data.id, data.score);
    organizeGroupList();
});

socket.on('removeTrack', function (data) {
    removeFromGroupList(data.id);
});

function sendUser() {
    nick = $('#username').val();
    if (nick.length == 0) {
        $('#errorDiv').show();
        $("#errorDiv").effect("shake", { times: 1 }, 'fast');
    }
    else {
        $('.username').text(nick);
        var msg = nick + " has joined the chat";
        socket.emit('send', { type: 'notice', message: msg, username: nick });
        $.modal.close();
        $('#username').val('');
    }
    return false;
}

function sendMsg(event) {
    var line = $('#m').val();
    if ((jQuery.trim(line)).length == 0)
        return false;
    else if (line[0] == "/" && line.length > 1) {
        var cmd = line.match(/[a-z]+\b/)[0];
        var arg = line.substr(cmd.length + 2, line.length);
        chat_command(cmd, arg);

    } else {
        socket.emit('send', { type: 'chat', message: line, nick: nick });
    }
    
    $('#m').val('');
    return false;
}

function chat_command(cmd, arg) {
    switch (cmd) {
        case 'nick':
            var notice = nick + " changed their name to " + arg;
            nick = arg;
            socket.emit('send', { type: 'notice', message: notice, nick: nick });
            break;

        case 'msg':
            var to = arg.match(/[a-zA-Z]+\b/)[0];
            var message = arg.substr(to.length, arg.length);
            socket.emit('send', { type: 'tell', message: message, to: to, from: nick });
            break;

        case 'me':
            var emote = nick + " " + arg;
            socket.emit('send', { type: 'emote', message: emote });
            break;

        default:
            console_out("That is not a valid command.");
    }
}

function prependMessages(messages, scrollDown, sentAll) {
    if (!$(".loadButton")[0]) {
        $('#chats').prepend('<div class="loadButton"><span class="glyphicon glyphicon-chevron-up"></span> Load More <span class="glyphicon glyphicon-chevron-up"></span></div>');
        $(".loadButton").unbind().click(function () { loadMoreMessages(); });
    }
    if (messages.length == 0) {
        $('.loadButton').html('<div class="loadButton">No Previous Messages To Load</div>');
        $('.loadButton').addClass("unavailable");
        $(".loadButton").unbind("click");
    }
    else {
        $(".loadButton").remove();
        $('#chats').prepend('<hr>');
        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            if (message.type == 'chat') {
                if (message.nick == nick)
                    $('#chats').prepend('<div class="me"><div>' + message.message + '</div></div>');
                else
                    $('#chats').prepend('<div class="others"><div>' + message.message + ' - ' + '<strong>' + message.nick + '</strong></div></div>');
            }
            else if (message.type == "notice") {
                $('#chats').prepend($('<div>').html('<div class="notice">' + message.message));
            }
        }
        if (scrollDown)
            scrollToBottom();
        else
            scrollToTop();
        if (sentAll) {
            $('#chats').prepend('<div class="loadButton">No Previous Messages To Load</div>');
            $('.loadButton').addClass("unavailable");
            $(".loadButton").unbind("click");
        } else {
            $('#chats').prepend('<div class="loadButton"><span class="glyphicon glyphicon-chevron-up"></span> Load More <span class="glyphicon glyphicon-chevron-up"></span></div>');
            $(".loadButton").unbind().click(function () { loadMoreMessages(); });
        }
    }
}

function loadMoreMessages() {
    // get 20 more messages starting with the one older than the top message
    socket.emit('loadMore', { start: oldestMessageID + 1 });
}

function scrollToBottom() {
    if($('.active').index() == -1)
        $("html, body").animate({ scrollTop: $(document).height() - $(window).height() }, 500);
}

function scrollToTop() {
    if ($('.active').index() == -1)
        $("html, body").animate({ scrollTop: 0 }, 1000);
}

function openModal() {
    var OSX = {
        container: null,
        init: function () {
            $("input.osx, a.osx").click(function (e) {
                e.preventDefault();
                
                openModal();
            });
        },
        open: function (d) {
            var self = this;
            self.container = d.container[0];
            d.overlay.fadeIn('slow', function () {
                $("#osx-modal-content", self.container).show();
                var title = $("#osx-modal-title", self.container);
                title.show();
                d.container.slideDown('slow', function () {
                    setTimeout(function () {
                        var h = $("#osx-modal-data", self.container).height() 
                            + title.height() 
                            + 50; // padding
                        d.container.animate(
                            { height: h },
                            200,
                            function () {
                            $("#osx-modal-data", self.container).show();
                        }
);
                    }, 300);
                });
            })
            setTimeout(function () {
                d.data.find("#username").focus();
            }, 500);
        },
        close: function (d) {
            var self = this; // this = SimpleModal object
            d.container.animate(
                { top: "-" + (d.container.height() + 20) },
                500,
                function () {
                self.close(); // or $.modal.close();
            }
);
            $('#m').focus();
        }
    };
    $("#osx-modal-content").modal({
        overlayId: 'osx-overlay',
        containerId: 'osx-container',
        minHeight: 80,
        opacity: 65,
        close: false,
        position: ['0', ],
        onOpen: OSX.open,
        onClose: OSX.close
    });
}

function deleteServerLog() {
    groupList.length = 0;
    socket.emit('reset');
    $('#chats').html('');
    $('#groupList').html('<li id="groupListPlaceHolder"><h5>Selected songs go here.</h5></li>');
}

// ----------------------------------------------------------------------------------
// -                                  SoundCloud                                    -
// ----------------------------------------------------------------------------------

SC.initialize({
    client_id: "YOUR_CLIENT_ID",
    redirect_uri: "http://example.com/callback.html",
});

function searchSoundCloud(skip) {
    query = $('#search').val();
    var track = null;
    
    
    if (query.length > 2 || skip) {
        $('#sounds').html('');
        SC.get('/tracks', { q: query, limit: 25 }, function (tracks) {
            for (i in tracks) {
                if (tracks[i].streamable == true)
                    $('#sounds').append(searchResultItem(tracks[i]));
            }
            $('.playButton').unbind("click").click(function () { handlePlay($(this)); });
            $('.addButton').unbind("click").click(function () { handleAdd($(this)); });
            $("#carousel").carousel(1);
        });
    }
}

function searchResultItem(track) {
    var item = '<li class="list-group-item" id="' + track.id + '">' +
                        '<div id="trackText"><strong>' + track.title + ' - </strong>' + runTime(track.duration) +  
                        '</div><span id="addControl" class="label label-primary">' +
                        '<span class="glyphicon glyphicon-play playButton"></span>' +
                        '<span class="glyphicon glyphicon-plus-sign addButton"></span></span>' +
                '</li>';
    return item;
}

function handleAdd($target) {
    id = $target.parent().parent().attr('id');
    if (!idAlreadyExists(id)) {
        SC.get('/tracks/' + id, function (track) {
            if (!idAlreadyExists(id)) {
                var art = (track.artwork_url == null)? "noCover.png" : track.artwork_url;
                var newTrack = {
                    username: nick,
                    id: id,
                    index: 0,
                    artwork_url: art,
                    score: 0,
                    title: track.title,
                    duration: track.duration
                };

                replaceAddButton(id);
                groupList.push(newTrack);
                renderGroupList();
                //$('#groupList').append(groupListItem(newTrack));
                //$('.upVote').unbind("click").click(function () { upVote($(this)); });
                //$('.downVote').unbind("click").click(function () { downVote($(this)); });
                //$('.wellRemove').unbind("click").click(function () { wellRemove($(this)); });
                
                socket.emit('newTrack', newTrack);
            }
        });
        $('#groupListPlaceHolder').hide();
    }
        
}

function groupListItem(track) {
    var userTrack = (track.username == nick); // TODO: if(userTrack) 
    var art = (track.artwork_url == null)? "noCover.png" : track.artwork_url;
    var index = (track.index == null)? 0 : track.index;
    var item = '<div class="well well-sm" id="well' + track.id + '">';
        if (userTrack) {
            item += '<div class="media userTrack">';
        } else {
            item += '<div class="media">';
        }  
                item += '<div class="indexContainer pull-left"><div id="index' + track.id + '">' + index + '</div></div>' +
                        '<a class="pull-left">' +
                            '<img class="media-object" src="' + art + '" alt="">' +
                        '</a>' +
                        '<div class="media-body">' +
                            '<div class="row">' +
                                '<div class="col-xs-10">' +
                                    '<h5 class="media-heading">' + track.title + '</h5>' +
                                    '<div class="groupListDescription">' +
                                        'Duration: ' + runTime(track.duration) + ' Added By: ' + track.username + 
                                    '</div>' +
                                '</div>' +
                                '<div id="voteConsole">' +
                                    '<span class="glyphicon glyphicon-chevron-up upVote"></span>' +
                                    '<div class="score" id="score' + track.id + '">' + track.score + '</div>' +
                                    '<span class="glyphicon glyphicon-chevron-down downVote"></span>' +
                                '</div>' +
                            '</div>';
                if (userTrack) { 
                    item += '<div class="row">' +
                                '<div id="removeDiv" class="col-xs-12"><span class="glyphicon glyphicon-remove-sign wellRemove"></span></div>' +
                            '</div>'
                            }
                 item += '</div>' +
                    '</div>' +
                '</div>';
    return item;
}

function wellRemove($target) { 
    var id = parseInt($target.parents().eq(4).attr('id').replace('well', ''));
    socket.emit('removeTrack', { id: id });
}

function footerPlay() {
    if (currentlyPlaying == null)
        alert('No song Selected');
    else if ($('#footPlay').attr('class') == "glyphicon glyphicon-pause") {
        $currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-play playButton');
        $('#footPlay').attr('class', 'glyphicon glyphicon-play');
        $currentlyPlayingSpan.parent().removeAttr('style');
        currentlyPlaying.pause();
    }
    else {
        $currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-stop');
        $('#footPlay').attr('class', 'glyphicon glyphicon-pause');
        currentlyPlaying.play();
    }
}

function handlePlay($target) {
    if (currentlyPlaying == null)
        playTrack($target);
    else if (currentlyPlaying.playState == 0)
        playTrack($target);
    else if (currentlyPlaying.playState == 1) {
        if ($target.attr('class') == "glyphicon glyphicon-play playButton") {
            stopTrack();
            playTrack($target);
        }  
        else
            stopTrack();
    }
}

function playTrack($target) {
    $currentlyPlayingSpan = $target;
    id = $target.parent().parent().attr('id');
    SC.stream("/tracks/" + id, 
        { limit: 30, onfinish: function () { stopTrack(); } },
        function (sound) {
        currentlyPlaying = sound;
        currentlyPlaying.play();
    });
    $target.attr('class', 'glyphicon glyphicon-stop');
    $currentlyPlayingSpan.parent().css("opacity", "1");
    $('#footPlay').attr('class', 'glyphicon glyphicon-pause');
}

function stopTrack() {
    $currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-play');
    $('#footPlay').attr('class', 'glyphicon glyphicon-play');
    $currentlyPlayingSpan.parent().removeAttr('style');
    currentlyPlaying.stop();
    currentlyPlaying = null;
}

function runTime(ms) {
    var secondString = '';
    if (ms == null)
        return "";
    var x, minutes, seconds;
    x = ms / 1000
    seconds = parseInt(x % 60);
    x /= 60
    minutes = parseInt(x % 60);
    secondString = seconds;
    if (seconds < 10)
        secondString = '0' + seconds;
    if (seconds == 0)
        secondString = '00';
    return "(" + minutes + ":" + secondString + ")";
}

function upVote($upVote) {
    var $scoreDiv = $upVote.parent().children('div');
    var $downVote = $upVote.parent().children('.downVote');
    var id = parseInt($scoreDiv.attr('id').replace('score', ''));
    if (!$upVote.hasClass('selectedVote') && !$downVote.hasClass('selectedVote')) {
        $upVote.addClass('selectedVote');
        socket.emit('vote', { type: 'upVote', id: id, username: nick });
    }
    else if ($upVote.hasClass('selectedVote')) {
        $upVote.removeClass('selectedVote');
        socket.emit('vote', { type: 'removeUpVote', id: id, username: nick });
    }
    else {
        $downVote.removeClass('selectedVote');
        $upVote.addClass('selectedVote');
        socket.emit('vote', { type: 'switchToUpVote', id: id, username: nick });
    }
}

function downVote($downVote) {
    var $scoreDiv = $downVote.parent().children('div');
    var $upVote = $downVote.parent().children('.upVote');
    var id = parseInt($scoreDiv.attr('id').replace('score', ''));
    if (!$upVote.hasClass('selectedVote') && !$downVote.hasClass('selectedVote')) {
        $downVote.addClass('selectedVote');
        socket.emit('vote', { type: 'downVote', id: id, username: nick });
    }
    else if ($downVote.hasClass('selectedVote')) {
        $downVote.removeClass('selectedVote');
        socket.emit('vote', { type: 'removeDownVote', id: id, username: nick });
    }
    else {
        $upVote.removeClass('selectedVote');
        $downVote.addClass('selectedVote');
        socket.emit('vote', { type: 'switchToDownVote', id: id, username: nick });
    }
}

function idAlreadyExists(id) {
    for (var i = 0; i < groupList.length; i++)
        if (groupList[i].id == id)
            return true;
    return false;
}

function findTrackById(id) {
    for (var i = 0; i < groupList.length; i++)
        if (groupList[i].id == id)
            return i;
    alert('track not found (client.js : findTrackById)');
    return -1;
}

function updateIndex(id, index) {
    groupList[findTrackById(id)].index = index;
    $('#index' + id + '').text(index);
}

function updateScore(id, score) {
    groupList[findTrackById(id)].score = score;
    $('#score' + id + '').text(score);
}

function replaceAddButton(id) {
    var button = $('#' + id + '').find('.addButton');
    button.removeAttr('class').addClass('glyphicon glyphicon-remove-sign');
    button.unbind().click(function () { 
        socket.emit('removeTrack', { id: id });
    });
}

function removeFromGroupList(id) {
    if (idAlreadyExists(id)) {
        var trackIndex = findTrackById(id);
    
        $('#well' + id + '').fadeOut(300, function () {$(this).remove();});
        var button = $('#' + id + '').find('.glyphicon-remove-sign');
        button.removeAttr('class').addClass('glyphicon glyphicon-plus-sign addButton');
        button.unbind().click(function () { handleAdd($(this)); });

        updateTrailingindices(trackIndex + 1, groupList[trackIndex].index);
        groupList.splice(trackIndex, 1);
    }
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
        oldListOrder.push({id: groupList[i].id, index: groupList[i].index});
    }
    groupList.sort(compareTracks);
    for (var i = 0; i < groupList.length; i++) {
        groupList[i].index = i + 1;
    }
    clearGroupList();
    renderGroupList();
}

function compareTracks(a, b) {
    if (a.score < b.score)
        return 1;
    if (a.score > b.score)
        return -1;
    return 0;
}

function renderGroupList() {
    $('#groupList').html('');
    for (i in groupList) {
        $('#groupList').append(groupListItem(groupList[i]));
    }
    $('.upVote').unbind("click").click(function () { upVote($(this)); });
    $('.downVote').unbind("click").click(function () { downVote($(this)); });
    $('.wellRemove').unbind("click").click(function () { wellRemove($(this)); });
}
