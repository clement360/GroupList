var socket = io();
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

// ----------------------------------------------------------------------------------
// -                                  Socket.on                                     -
// ----------------------------------------------------------------------------------


socket.on('currentGroupList', function (data) {
    if (data.length > 0) {
        $('#groupListPlaceHolder').hide();
        groupList = data;
    }
});

socket.on('newTrack', function (data) {
    $('#groupListPlaceHolder').hide();
    if (data.username == nick) {
        updateIndex(data.id, data.index);
        updateScore(data.id, data.score);
    }
    if (!idAlreadyExists(data.id)) {
        groupList.push(data);
        renderGroupList();
    }
});

socket.on('vote', function (data) {
    updateScore(data.id, data.score);
    groupList[findTrackById(data.id)].votes = data.votes;
    organizeGroupList();
});

socket.on('removeTrack', function (data) {
    removeFromGroupList(data.id);
});

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
        $('#sounds').html($('#loading').html());
        $('.spinner :first').show();
        SC.get('/tracks', { q: query, limit: 25 }, function (tracks) {
            $('#sounds').html('');
            if (tracks == null)
                $('#sounds').append('<li><center style="color: #777;">No tracks found for "'+query+'".</center></li>'); 
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
                    artwork_url: art,
                    title: track.title,
                    duration: track.duration
                };

                replaceAddButton(id);
                groupList.push(newTrack);
                renderGroupList();                
                socket.emit('newTrack', newTrack);
            }
        });
        $('#groupListPlaceHolder').hide();
    }
        
}

function groupListItem(track) {
    var score = (track.score == null)? 0 : track.score; 
    var userTrack = (track.username == nick);
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
        $('.positionBar').clearQueue();
        $('.positionBar').stop();
    }
    else {
        $currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-stop');
        $('#footPlay').attr('class', 'glyphicon glyphicon-pause');
        currentlyPlaying.play();
        $('.positionBar').animate({ width: "100%" }, currentlyPlaying.duration-currentlyPlaying.position)
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
        {
            limit: 30, 
            onfinish: function () { stopTrack(); }, 
            onload: function () {
                if (this.readyState == 2) {
                alert('this song failed to load 404');
                }
                $('.positionBar').animate({ width: "100%" }, this.duration)
            }
        },
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
    $('.positionBar').clearQueue();
    $('.positionBar').stop();
    $('.positionBar').css('width', '0%');
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
    var id = parseInt($scoreDiv.attr('id').replace('score', ''));
    socket.emit('vote', { type: 'upVote', id: id, username: nick });
}

function downVote($downVote) {
    var $scoreDiv = $downVote.parent().children('div');
    var id = parseInt($scoreDiv.attr('id').replace('score', ''));  
    socket.emit('vote', { type: 'downVote', id: id, username: nick });
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

function updateVoteHiglights() {
    for (i in groupList) {
        userVote = getUserVote(groupList[i], nick);
        if (userVote != null) {
            var $scoreDiv = $('#score' + groupList[i].id + '');
            var $upVote = $scoreDiv.parent().children('.upVote');
            var $downVote = $scoreDiv.parent().children('.downVote');
            $upVote.removeClass('selectedVote');
            $downVote.removeClass('selectedVote');
            switch (userVote.voteState) {
                case -1:
                    $downVote.addClass('selectedVote');
                    break;
                case 0:
                    break;
                case 1:
                    $upVote.addClass('selectedVote');
                    break;
            }
        }
    }
}

function getUserVote(track, username) {
    for (v in track.votes)
        if (track.votes[v].username == username)
            return track.votes[v];
    return null;
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
    updateVoteHiglights();
}
