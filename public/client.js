var socket = io();
var currentlyPlaying = null;
var $currentlyPlayingSpan = null;
var debugging = false;
var groupList = [];
var groupListPlaying = false;
var playedList = [];
var marqueeID = 0;
var currentSlide = 0;

var preventSlide = false;

function arrowKeySlideControl(e){
	if(preventSlide)
		return false;
	if (e.keyCode === 37) {
		$('#slides').superslides('animate' , 'prev');
	}
	else if (e.keyCode === 39) {
		$('#slides').superslides('animate' , 'next');
	}
}

$(document).ready(function () {
	$('#soundFooter').hide();
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
			e.preventDefault();
			searchSoundCloud(true);
		}
	});

	checkCookie();
	
	// enable page sliders
	$('#slides').superslides({ pagination: false });
	// enable scrollable slides
	$('#chatPane').css("overflow", "scroll");
	$('#soundPane').css("overflow", "scroll");
	$('#chatPane').css("height", "88%");

	// arrow key slide navigation
	$(document).on('keyup', arrowKeySlideControl);
	$('#username').on('focus', function (e) {
		preventSlide = true;
	});

	$('#search').on('focus', function (e) {
		preventSlide = true;
	});
	$('#search').on('blur', function (e) {
		preventSlide = false;
	});
	$('#m').on('focus', function (e) {
		preventSlide = true;
	});
	$('#m').on('blur', function (e) {
		preventSlide = false;
	});
	// touch enabled sliding
	document.ontouchmove = function(e) {
		e.preventDefault();
	};
	$('#slides').hammer().on('swipeleft', function() {
		$(this).superslides('animate', 'next');
	});
	$('#slides').hammer().on('swiperight', function() {
		$(this).superslides('animate', 'prev');
	});

	$('#username').focus();
	
	$('#footPlay').click(function () { footerPlay(); });
	$('body').on('animating.slides', preSlide);
	$('body').on('animated.slides', postSlide);
	$('#soundFooter').slideUp();
	$('#chatFooter').slideUp();
});

function preSlide() {
	currentSlide = $('#slides').superslides('current');
	// moving to chat
	if (currentSlide == 0){
		$('#soundFooter').slideUp("fast");
		currentSlide = 1;
	}

	// moving to music
	else{
		$('#chatFooter').slideUp("fast");
		currentSlide = 0;
	}
}

function postSlide(){
	if (currentSlide == 1){
		$('#chatFooter').slideDown("fast");
	}
	else{
		$('#soundFooter').slideDown("fast");
	}
}

// ----------------------------------------------------------------------------------
// -                                  Socket.on                                     -
// ----------------------------------------------------------------------------------

socket.on('currentGroupList', function (data) {
	if (data.length > 0) {
		$('#groupListPlaceHolder').hide();
		groupList = data;
		renderGroupList();
	}
});

socket.on('latestGoupList', function (data) {
	groupList = data;
	renderGroupList();
});


socket.on('newTrack', function (data) {
	$('#groupListPlaceHolder').hide();
	if (data.username == nick) {
		updateIndex(data.id, data.index, true);
		updateScore(data.id, data.score);
	}
	if (!idAlreadyExists(data.id)) {
		groupList.push(data);
	}
	organizeGroupList();
});

socket.on('vote', function (data) {
	updateScore(data.id, data.score);
	groupList[findTrackById(data.id)].votes = data.votes;
	organizeGroupList();
});

socket.on('removeTrack', function (data) {
	removeFromGroupList(data.id);
	if (groupList.length == 0)
		$('#playGroupListBtn').prop('disabled', true);
});

// ----------------------------------------------------------------------------------
// -                                  SoundCloud                                    -
// ----------------------------------------------------------------------------------

SC.initialize({
	client_id: "b99356435e69b14f1651975ac44dd458",
	redirect_uri: 'REDIRECT_URL',
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

function groupListItem(track, hidden) {
	// "hidden" is an optional arguement
	hidden = (typeof hidden === "undefined") ? false : hidden;
	var hideStr = (hidden == true) ? 'hidden' : '';
	var score = (track.score == null)? 0 : track.score; 
	var userTrack = (track.username == nick);
	var art = (track.artwork_url == null)? "noCover.png" : track.artwork_url;
	var index = (track.index == null)? 0 : track.index;

	// add hidden to div
	var item = '<div class="well well-sm" id="well' + track.id + '" '+hideStr+'>';
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
								'<div class="col-xs-9">' +
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

function playedListItem(track) { 
	var score = (track.score == null)? 0 : track.score;
	var userTrack = (track.username == nick);
	var art = (track.artwork_url == null)? "noCover.png" : track.artwork_url;
	var index = (track.index == null)? 0 : track.index;
	var item = '<div hidden class="well well-sm" id="PL-well' + track.id + '">';

		item += '<div class="media userTrack">';

		item += '<div class="media">';

	item += '<div class="indexContainer pull-left"><div id="PL-index' + track.id + '">' + index + '</div></div>' +
						'<a class="pull-left">' +
							'<img class="media-object" src="' + art + '" alt="">' +
						'</a>' +
						'<div class="media-body">' +
							'<div class="row">' +
								'<div class="col-xs-11">' +
									'<h5 class="media-heading">' + track.title + '</h5>' +
									'<div class="groupListDescription">' +
										'Duration: ' + runTime(track.duration) + ' Added By: ' + track.username + 
									'</div>' +
								'</div>' +
								'<div id="GLscoreDiv" class="col-xs-1 hidden-xs">' +
									'<div title="Track Score" class="groupListScore" id="GLscore' + track.id + '">' + track.score + '</div>' +
								'</div>' +
							'</div>';
	
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
		if ($currentlyPlayingSpan != null) {
			$currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-play playButton');
			$currentlyPlayingSpan.parent().removeAttr('style');
		}
		$('#footPlay').attr('class', 'glyphicon glyphicon-play');
		currentlyPlaying.pause();
		$('.positionBar').clearQueue();
		$('.positionBar').stop();
	}
	else {
		if ($currentlyPlayingSpan != null)
			$currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-stop');
		$('#footPlay').attr('class', 'glyphicon glyphicon-pause');
		currentlyPlaying.play();
		$('.positionBar').animate({ width: "100%" }, currentlyPlaying.duration-currentlyPlaying.position)
	}
}

function handlePlay($target) {
	// groupListPlaying do Nothing
	if (groupListPlaying)
		alert("GroupList is currently playing.");
	else if (currentlyPlaying == null)
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
	$('#soundFooter').slideDown();
	SC.stream("/tracks/" + id, 
		{
			limit: 1, 
			onfinish: function () { stopTrack(); }, 
			onload: function () {
				if (this.readyState == 2) {
					alert('this song failed to load, This is a problem on SoundCloud\'s end. they\'re apparently working on it.');
				}
				else {
					$('#loadingSongDiv').fadeOut(function () { $('#loadingSongBar').width('0%'); });
				}
		},
		whileloading: function () {
			$('#loadingSongBar').width((this.bytesLoaded/this.bytesTotal)*100+'%');
		}
		},
		function (sound) {
		currentlyPlaying = sound;
		currentlyPlaying.play();
		currentlyPlaying.onPosition(1, function () {
			$('.positionBar').animate({ width: "100%" }, this.durationEstimate);
		});
		currentlyPlaying.id = parseInt(id);
		displayInfo(id);
	});
	$target.attr('class', 'glyphicon glyphicon-stop');
	$currentlyPlayingSpan.parent().css("opacity", "1");
	$('#footPlay').attr('class', 'glyphicon glyphicon-pause');
}

function stopTrack() {
	if ($currentlyPlayingSpan != null) {
		$currentlyPlayingSpan.attr('class', 'glyphicon glyphicon-play');
		$currentlyPlayingSpan.parent().removeAttr('style');
	}
	$('#footPlay').attr('class', 'glyphicon glyphicon-play');
	currentlyPlaying.stop();
	$('.positionBar').clearQueue();
	$('.positionBar').stop();
	$('.positionBar').css('width', '0%');
	currentlyPlaying = null;
	$('#soundFooter').slideUp();
	$('#loadingSongBar').width('0%');
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
	console.log('track not found (client.js : findTrackById)');
	return -1;
}

// Same as function findTrackById(id); but it searches theough the PlayedList
function findTrackByIdPL(id) {
	for (var i = 0; i < playedList.length; i++)
		if (playedList[i].id == id)
			return i;
	console.log('track not found (client.js : findTrackByIdPL)');
	return -1;
}

function updateIndex(id, index, newAddition) {
	if (groupListPlaying && newAddition)
		index = groupList.length;
	var trackindex = findTrackById(id);
	if (index != -1) {
		groupList[trackindex].index = index;
		$('#index' + id + '').text(index);
	}
}

function updateScore(id, score) {
	var index = findTrackById(id);
	// song removed or already played (modifying score in played list may confuse users)
	if (index != -1) {
		groupList[index].score = score;
		$('#score' + id + '').text(score);
	}
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


function updateTrailingindices(indexAfterDelete, index) {
	if (indexAfterDelete < groupList.length) {
		for (var i = indexAfterDelete; i < groupList.length; i++) {
			updateIndex(groupList[i].id, index, false);
			index++;
		}
	}
}

function organizeGroupList() {
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
	if (groupList.length > 0) {
		$('#groupList').html('');
		if (!groupListPlaying)
			$('#playGroupListBtn').prop('disabled', false);
		for (i in groupList) {
			$('#groupList').append(groupListItem(groupList[i]));
		}
		$('.upVote').unbind("click").click(function () { upVote($(this)); });
		$('.downVote').unbind("click").click(function () { downVote($(this)); });
		$('.wellRemove').unbind("click").click(function () { wellRemove($(this)); });
		updateVoteHiglights();
	}
	else {
		$('#groupList').html('<li id="groupListPlaceHolder"><h5>Selected songs go here.</h5></li>');
		$('#playGroupListBtn').prop('disabled', true);
	}
}

function playGroupList() {
	groupListPlaying = true;
	// reset play bar
	$('.positionBar').clearQueue();
	$('.positionBar').stop();
	$('.positionBar').animate({ width: "0%" }, 100);
	if (currentlyPlaying != null)
		if (currentlyPlaying.playState > 0 || currentlyPlaying.paused)
			stopTrack();
	
	
	$('#groupListIcon').prop('class', 'icon-stop');
	$('#playGroupListBtn').attr('onclick', 'stopGroupList();');
	$('#playedListPanel').slideDown();

	$('#footNext').show();
	
	$('#soundFooter').slideDown();
	$('#footNext').unbind().click(function () { playNext(); });
	$('#footPrev').unbind().click(function () { playPrev(); });
	playNext();
}

function playNext() {
	// reset play bar
	
	$('.positionBar').clearQueue();
	$('.positionBar').stop();
	$('.positionBar').animate({ width: "0%" }, 100);
	if (currentlyPlaying != null)
		if (currentlyPlaying.playState > 0 || currentlyPlaying.paused)
			currentlyPlaying.stop();
	
	if (groupList.length <= 0) {
		stopGroupList();
		return true;
	}
	var nextSong = groupList[0];
	
	moveToPlayedList(removeFromGroupList(nextSong.id));
	displayInfo(nextSong.id);
	SC.stream("/tracks/" + nextSong.id, 
		{
		limit: 30, 
		onfinish: function () { playNext(); }, 
		onload: function () {
			if (this.readyState == 2) {
				alert('this song failed to load, This is a problem on SoundCloud\'s end. they\'re apparently working on it.');
			}
			$('#loadingSongDiv').fadeOut(function () { $('#loadingSongBar').width('0%'); });
		},
		whileloading: function () {
			$('#loadingSongBar').width((this.bytesLoaded / this.bytesTotal) * 100 + '%');
		}
	},
		function (sound) {
		currentlyPlaying = sound;
		currentlyPlaying.play();
		currentlyPlaying.onPosition(1, function () { $('.positionBar').animate({ width: "100%" }, this.durationEstimate); });
		currentlyPlaying.id = parseInt(nextSong.id);
	});
	$('#footPlay').attr('class', 'glyphicon glyphicon-pause');
	if(playedList.length == 2)
		$('#footPrev').show();
}

function playPrev() {
	// reset play bar
	$('.positionBar').clearQueue();
	$('.positionBar').stop();
	$('.positionBar').animate({ width: "0%" }, 100);
	if (currentlyPlaying != null)
		if (currentlyPlaying.playState > 0 || currentlyPlaying.paused)
			currentlyPlaying.stop();
	
	if (playedList.length <= 1) {
		$('#footPrev').hide();
		return true;
	}

	var prevSong = playedList[playedList.length-2];
	
	moveToGroupList(removeFromPlayedList(currentlyPlaying.id));
	// play prevSong
	displayInfo(prevSong.id);
	SC.stream("/tracks/" + prevSong.id, 
		{
		limit: 30, 
		onfinish: function () { playNext(); }, 
		onload: function () {
			if (this.readyState == 2) {
				alert('this song failed to load, This is a problem on SoundCloud\'s end. they\'re apparently working on it.');
			}
			$('#loadingSongDiv').fadeOut(function () {$('#loadingSongBar').width('0%'); });
		},
		whileloading: function () {
			$('#loadingSongBar').width((this.bytesLoaded / this.bytesTotal) * 100 + '%');
		}
	},
		function (sound) {
		currentlyPlaying = sound;
		currentlyPlaying.play();
		currentlyPlaying.onPosition(1, function () {
			$('.positionBar').animate({ width: "100%" }, this.durationEstimate);
		});
		currentlyPlaying.id = parseInt(prevSong.id);
		$('#soundFooter').slideDown();
	});
	$('#footPlay').attr('class', 'glyphicon glyphicon-pause');
	if (playedList.length <= 1) 
		$('#footPrev').hide();
}

function removeFromGroupList(id) {
	if (idAlreadyExists(id)) {
		var trackIndex = findTrackById(id);
		
		$('#well' + id + '').fadeOut(300, function () { $(this).remove(); });
		var button = $('#' + id + '').find('.glyphicon-remove-sign');
		button.removeAttr('class').addClass('glyphicon glyphicon-plus-sign addButton');
		button.unbind().click(function () { handleAdd($(this)); });
		
		updateTrailingindices(trackIndex + 1, groupList[trackIndex].index);
		return groupList.splice(trackIndex, 1)[0];
	}
}

function moveToPlayedList(track) {
	// first element to be added -> remove place holder
	if (playedList.length == 0)
		$('#playedList').html('');

	track.index = playedList.length + 1;
	playedList.push(track)
	$('#playedList').append(playedListItem(track));
	setTimeout(function () { $('#PL-well' + track.id + '').slideDown(); }, 320);
}

function removeFromPlayedList(id) {
	var trackIndex = findTrackByIdPL(id);
	var currentSong = playedList[trackIndex];
	
	$('#PL-well' + id + '').fadeOut(300, function () { $(this).remove(); });

	return playedList.splice(trackIndex, 1)[0];
}

function moveToGroupList(track) {
	track.index = 1; 
	groupList.unshift(track);
	$('#groupList').prepend(groupListItem(track, true));
	setTimeout(function () { $('#well' + track.id + '').slideDown(); }, 320);

	// update groupList Indicies
	for (var t = 0; t < groupList.length; t++) {
		groupList[t].index = t + 1;
		$('#index' + groupList[t].id + '').text(t + 1);
	}
}

function stopGroupList() {
	// reset play bar
	$('.positionBar').clearQueue();
	$('.positionBar').stop();
	$('.positionBar').animate({ width: "0%" }, 100);
	if (currentlyPlaying != null)
		if (currentlyPlaying.playState > 0 || currentlyPlaying.paused)
			currentlyPlaying.stop();

	groupListPlaying = false;
	socket.emit('retrieveGroupList');
	playedList.length = 0;
	$('#playedListPanel').slideUp();
	$('#soundFooter').slideUp(function () {
		$('#footNext').hide();
		$('#footPrev').hide();
		$('#loadingSongBar').width('0%');
	});
	$('#groupListIcon').prop('class', 'glyphicon glyphicon-play-circle');
	$('#playGroupListBtn').attr('onclick', 'playGroupList();');
}

function displayInfo(id) {
	$('#loadingSongDiv').show();
	SC.get('/tracks/' + id, function (track) {
	   
		$('#trackInfo').html(
			'<h4>' + track.title + '</h4>' +
			'<h5>' + track.user.username + '</h5>'
		)
		setTimeout(function () { scrollTitle(id); }, 300);
		
	});
}
function scrollTitle(id) {
	marqueeID = id;
	var el = $('#trackInfo').children('h4');
	var scrollDuration = 7000 * (el.get(0).scrollWidth / el.width());
	if (el.get(0).scrollWidth > el.width()) {
		var scrollTimer = setInterval(function (id) {
			if(currentlyPlaying != null)
				if (currentlyPlaying.sID.indexOf(marqueeID) == -1)
					clearInterval(scrollTimer);
			$('#trackInfo').children('h4').animate({ scrollLeft: el.get(0).scrollWidth-el.width() + 5}, scrollDuration, function () {
				$('#trackInfo').children('h4').animate({ scrollLeft: 0 }, 1000);
			});
		}, scrollDuration + 4000);   
	}
}