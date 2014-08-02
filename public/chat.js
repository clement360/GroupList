var nick = '[Client]';

var connected = 0;
var oldestMessageID = 0;

socket.on('newConnection', function (data) {
    connected = data.users;
    $('.online').text(connected);
});

socket.on('newUser', function (data) { handleNewUser(data); });

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


function sendUser() {
    nick = $('#username').val();
    if (nick.length == 0) {
        $('#errorDiv').show();
        $("#errorDiv").effect("shake", { times: 1 }, 'fast');
    }
    else {
        var msg = nick + " has joined the chat";
        socket.emit('newUser', { type: 'notice', message: msg, username: nick });
    }
    return false;
}

function handleNewUser(error) {
    if (error == null) {
        $.modal.close();
        $('#username').val('');
        $('.username').text(nick);
        renderGroupList();
    }
    else {
        $('#errorDiv').show();
        $("#errorDiv").text(error);
        $("#errorDiv").effect("shake", { times: 1 }, 'fast');
    }
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