/* global $: true */
/* global waitForKeyElements: true */
/* global GM_xmlhttpRequest: true */
/* global GM_getValue: true */

// ==UserScript==
// @name        Geocaching.com + Project-GC
// @namespace   PGC
// @description Adds links and data to Geocaching.com to make it collaborate with PGC
// @include     http://www.geocaching.com/*
// @include     https://www.geocaching.com/*
// @version     1.2.13
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js
// @require     https://greasyfork.org/scripts/5392-waitforkeyelements/code/WaitForKeyElements.js?version=19641
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @license     The MIT License (MIT)
// ==/UserScript==

'use strict';

(function() {

    var pgcUrl = 'http://project-gc.com/',
        pgcApiUrl = pgcUrl + 'api/gm/v1/',
        externalLinkIcon = 'http://maxcdn.project-gc.com/images/external_small.png',
        galleryLinkIcon = 'http://maxcdn.project-gc.com/images/pictures_16.png',
        mapLinkIcon = 'http://maxcdn.project-gc.com/images/map_app_16.png',
        loggedIn = GM_getValue('loggedIn'),
        subscription = GM_getValue('subscription'),
        pgcUsername = GM_getValue('pgcUsername'),
        gccomUsername = GM_getValue('gccomUsername'),
        latestLogs = [],
        latestLogsAlert = false,
        path = window.location.pathname;

    // Don't run the script for iframes
    if (window.top == window.self) {
        Main();
    }

    /**
     * Router
     */
    function Main() {

        CheckPGCLogin();

        if (path.match(/^\/geocache\/.*/) !== null) {
            Page_CachePage();
        } else if (path.match(/^\/seek\/cache_logbook\.aspx.*/) !== null) {
            Page_Logbook();
        }

    }

    /**
     * Check that we are logged in at PGC, and that it's with the same username
     */
    function CheckPGCLogin() {

    	gccomUsername = false;
    	if( $('#ctl00_divSignedIn').length ) {
	        gccomUsername = $('#ctl00_divSignedIn .li-user-info span').html();
    	} else if( $('ul.profile-panel-menu').length ) {
    		gccomUsername = $('ul.profile-panel-menu .li-user-info span:nth-child(2)').text();
    	}
        GM_setValue('gccomUsername', gccomUsername);

        GM_xmlhttpRequest({
            method: "GET",
            url: pgcApiUrl + 'GetMyUsername',
            onload: function(response) {
                var result = JSON.parse(response.responseText),
                    html, loggedInContent, subscriptionContent = '';
                if (result.status !== 'OK') {
                    alert(response.responseText);
                    return false;
                }

                pgcUsername = result.data.username;
                loggedIn = !!result.data.loggedIn;
                subscription = !!result.data.subscription;

                if (loggedIn === false) {
                    loggedInContent = 'Not logged in';
                } else if (pgcUsername == gccomUsername) {
                    loggedInContent = '<strong>' + pgcUsername + '</strong>';
                } else {
                    loggedInContent = '<strong><font color="red">' + pgcUsername + '</font></strong>';
                }

                if (subscription) {
                    subscriptionContent = 'Paid membership';
                } else {
                    subscriptionContent = 'Missing membership';
                }


                html = '<a class="SignedInProfileLink" href="' + pgcUrl + 'ProfileStats/' + pgcUsername + '" title="Project-GC">\
                            <span class="avatar">\
                                <img src="http://project-gc.com/favicon.ico" alt="Logo" width="30" height="30" style="border-radius:100%; border-width:0px;">\
                            </span>\
                            <span class="li-user-info">\
                                <span style="display: block;">' + loggedInContent + '</span>\
                                <span class="cache-count">' + subscriptionContent + '</span>\
                            </span>\
                        </a>';

                if ( $('#ctl00_divSignedIn ul.logged-in-user').length ) {	// The default look of the header bar
                    $('#ctl00_divSignedIn ul.logged-in-user').prepend('<li class="li-user">' + html + '</li>');
                } else if( $('ul.profile-panel-menu').length ) {	// Special case for https://www.geocaching.com/account/settings/preferences
                	$('ul.profile-panel-menu').prepend('<li class="li-user">' + html + '</li>');
                }

                // Save the login value
                GM_setValue('loggedIn', loggedIn);
                GM_setValue('subscription', subscription);
                GM_setValue('pgcUsername', pgcUsername);
            },
            onerror: function(response) {
                alert(response);
                return false;
            }
        });
    }

    /**
     * getGcCodeFromPage
     * @return string
     */
    function getGcCodeFromPage() {
        return $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoCode').html();
    }

    /**
     * addToVGPS
     */
    function addToVGPS() {
        var gccode = GM_getValue('gccode'),
            listId = $('#comboVGPS').val(),
            msg,
            url = pgcApiUrl + 'AddToVGPSList?listId=' + listId + '&gccode=' + gccode + '&sectionName=GM-script';

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                msg = 'Geocache not added to Virtual-GPS :(';
                if (result.status === 'OK') {
                    msg = 'Geocache added to Virtual-GPS!';
                }
                alert(msg);
                return true;
            },
            onerror: function(response) {
                console.log(response);
                return false;
            }
        });
    }

    /**
     * Page_CachePage
     */
    function Page_CachePage() {
        var gccode = getGcCodeFromPage(),
            placedBy = $('#ctl00_ContentBody_mcd1 a').html(),
            lastUpdated = $('#ctl00_ContentBody_bottomSection p small time').get(1),
            lastFound = $('#ctl00_ContentBody_bottomSection p small time').get(2);


    	lastUpdated = (lastUpdated) ? lastUpdated.dateTime : false;
    	lastFound = (lastFound) ? lastFound.dateTime : false;


        GM_setValue('gccode', gccode);


        // Since everything in the logbook is ajax, we need to wait for the elements
        waitForKeyElements('#cache_logs_table tr', Logbook);


        // Get cache data from PGC
        var url = pgcApiUrl + 'GetCacheDataFromGccode&gccode=' + gccode;
        if(lastUpdated)
        	url += '&lastUpdated=' + lastUpdated;
        if(lastFound)
        	url += '&lastFound=' + lastFound;

        if (GM_getValue('subscription')) {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    var result = JSON.parse(response.responseText),
                        cacheData = result.data.cacheData,
                        cacheOwner = result.data.owner,
                        challengeCheckerTagIds = result.data.challengeCheckerTagIds,
                        location = [],
                        fp = 0,
                        fpp = 0,
                        fpw = 0;


                    if(result.status == 'OK' && cacheData !== false) {


	                    // If placed by != owner, show the real owner as well.
	                    if(placedBy != cacheOwner) {
	                    	$('#ctl00_ContentBody_mcd1 span.message__owner').before(' (' + cacheOwner + ')');
	                    }

				        // Append link to Profile Stats for the cache owner
				        // Need to real cache owner name from PGC since the web only has placed by
				        $('#ctl00_ContentBody_mcd1 span.message__owner').before('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(cacheOwner) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>');


	                    // Add FP/FP%/FPW below the current FP
	                    fp = parseInt(+cacheData.favorite_points, 10),
	                        fpp = parseInt(+cacheData.favorite_points_pct, 10),
	                        fpw = parseInt(+cacheData.favorite_points_wilson, 10);

	                    // Add PGC location
	                    if (cacheData.country.length > 0) {
	                        location.push(cacheData.country);
	                    }
	                    if (cacheData.region.length > 0) {
	                        location.push(cacheData.region);
	                    }
	                    if (cacheData.county.length > 0) {
	                        location.push(cacheData.county);
	                    }
	                    location = location.join(' / ');

	                    var gccomLocationData = $('#ctl00_ContentBody_Location').html();
	                    $('#ctl00_ContentBody_Location').html('<span style="text-decoration: line-through;">' + gccomLocationData + '</span><br><span>' + location + '</span>');

	                    // $('#ctl00_divContentMain div.span-17 div.span-6.right.last div.favorite.right').append('<p style="text-align: center; background-color: #f0edeb;">(' + fp + ' FP, ' + fpp + '%, ' + fpw + 'W)</p>');
	                    $('#uxFavContainerLink').append('<p style="text-align: center; background-color: #f0edeb;">PGC: ' + fp + ' FP, ' + fpp + '%, ' + fpw + 'W</p>');

	                    // Add challenge checkers
	                    if(challengeCheckerTagIds.length > 0) {
	                    	var html = '';

	                    	html += '<div id="PGC_ChallengeCheckers">';
	                    	for(var i = 0 ; i < challengeCheckerTagIds.length ; i++) {
	                    		html += '<a href="http://project-gc.com/Challenges//' + challengeCheckerTagIds[i] + '"><img src="http://maxcdn.project-gc.com/Images/Checker/' + challengeCheckerTagIds[i] + '" title="Project-GC Challenge checker" alt="PGC Checker"></a>';
	                    	}
	                    	html += '</div>';
		                    $('#ctl00_ContentBody_CacheInformationTable').append(html)
		                }

                    }

                }
            });
        }



        // Tidy the web
        $('#ctl00_ContentBody_lnkMessageOwner').html('');
    	$('#ctl00_divContentMain p.Clear').css('margin', '0');
    	$('div.Note.PersonalCacheNote').css('margin', '0');
        $('h3.CacheDescriptionHeader').remove();
        $('#ctl00_ContentBody_EncryptionKey').remove();


        // Make it easier to copy the gccode
        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').
        html('<div style="margin-right: 15px; margin-bottom: 10px;"><p style="font-size: 125%; margin-bottom: 0">' + gccode + '</p>' +
            '<input size="25" type="text" value="http://coord.info/' + encodeURIComponent(gccode) + '" onclick="this.setSelectionRange(0, this.value.length);"></div>');
        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').css('font-weight', 'inherit').css('margin-right', '40px');
        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div').css('margin', '0px');
        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div p').css('font-weight', 'bold');


        // Add PGC Map links
        var coordinates = $('#ctl00_ContentBody_lnkConversions').attr('href'),
            latitude = coordinates.replace(/.*lat=([^&]*)&lon=.*/, "$1"),
            longitude = coordinates.replace(/.*&lon=([^&]*)&.*/, "$1");
        var gccomUsername = GM_getValue('gccomUsername'),
            mapUrl = pgcUrl + 'Maps/mapcompare/?profile_name=' + gccomUsername +
            '&nonefound=on&ownfound=on&location=' + latitude + ',' + longitude +
            '&max_distance=5&submit=Filter';

        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
        	'<div style="margin-bottom: 8px;"><a target="_blank" href="' + mapUrl + '">Project-GC map</a> (<a target="_blank" href="' + mapUrl + '&onefound=on">incl found</a>)</div>'
        	);


        // Remove the UTM coordinates
        // $('#ctl00_ContentBody_CacheInformationTable div.LocationData div.span-9 p.NoBottomSpacing br').remove();
        $('#ctl00_ContentBody_LocationSubPanel').html();


        // Remove ads
        // PGC can't really do this officially
        // $('#ctl00_ContentBody_uxBanManWidget').remove();


        // Remove disclaimer
        // PGC can't really do this officially
        // $('#ctl00_divContentMain div.span-17 div.Note.Disclaimer').remove();


        // Collapse download links
        // http://www.w3schools.com/charsets/ref_utf_geometric.asp (x25BA, x25BC)
        $('<p style="cursor: pointer; margin: 0;" id="DownloadLinksToggle" onclick="$(\'#ctl00_divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow\').toggle();"><span class="arrow">&#x25BA;</span><span class="arrow open">&#x25BC;</span>Print and Downloads</p>').insertAfter('#ctl00_ContentBody_CacheInformationTable div.LocationData');
        $('#ctl00_divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow.open').hide();


        // Resolve the coordinates into an address
        var coordinates = $('#ctl00_ContentBody_lnkConversions').attr('href'),
            latitude = coordinates.replace(/.*lat=([^&]*)&lon=.*/, "$1"),
            longitude = coordinates.replace(/.*&lon=([^&]*)&.*/, "$1"),
            url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng=' + latitude + ',' + longitude + '&sensor=false';
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                if (result.status !== 'OK') {
                    return false;
                }
                var formattedAddress = result.results[0].formatted_address;
                $('#ctl00_ContentBody_LocationSubPanel').html(formattedAddress + '<br />');
            }
        });


        // Add number of finds to the top
        $('#ctl00_ContentBody_CacheInformationTable').before('<div>' + $('#ctl00_ContentBody_lblFindCounts').html() + '</div>');


        // Add link to PGC gallery
        if (subscription) {
            var html = '<a href="' + pgcUrl + 'Tools/Gallery?gccode=' + gccode + '&submit=Filter"><img src="' + galleryLinkIcon + '" title="Project-GC Gallery"></a> ';
            $('.CacheDetailNavigation ul li:first').append(html);
        }


        // Add map links for each bookmarklist
        $('ul.BookmarkList li').each(function() {
        	var guid = $(this).children(':nth-child(1)').attr('href').replace(/.*\?guid=(.*)/, "$1");
        	var owner = $(this).children(':nth-child(3)').text();

	        // Add the map link
	        var url = 'http://project-gc.com/Tools/MapBookmarklist?owner_name=' + encodeURIComponent(owner) + '&guid=' + encodeURIComponent(guid);
        	$(this).children(':nth-child(1)').append( '&nbsp;<a href="' + url + '"><img src="' + mapLinkIcon + '" title="Map with Project-GC"></a>' );

        	// Add gallery link for the bookmark list
        	var url = 'http://project-gc.com/Tools/Gallery?bml_owner=' + encodeURIComponent(owner) + '&bml_guid=' + encodeURIComponent(guid) +'&submit=Filter';
        	$(this).children(':nth-child(1)').append( '&nbsp;<a href="' + url + '"><img src="' + galleryLinkIcon + '" title="Project-GC Gallery"></a>' );

        	// Add profile stats link to the owner
        	var url = 'http://project-gc.com/ProfileStats/' + encodeURIComponent(owner);
        	$(this).children(':nth-child(3)').append( '&nbsp;<a href="' + url + '"><img src="' + externalLinkIcon + '" title="Project-GC Profile stats"></a>' );
        });


		// Decrypt the hint
		var rot13array;function createROT13array(){for(var a=0,b=[],a=0;26>a;a++)b["abcdefghijklmnopqrstuvwxyz".charAt(a)]="abcdefghijklmnopqrstuvwxyz".charAt((a+13)%26);for(a=0;26>a;a++)b["abcdefghijklmnopqrstuvwxyz".charAt(a).toUpperCase()]="abcdefghijklmnopqrstuvwxyz".charAt((a+13)%26).toUpperCase();return b}function convertROT13String(a){var b=0,d=a.length,e="";rot13array||(rot13array=createROT13array());for(b=0;b<d;b++)e+=convertROT13Char(a.charAt(b));return e}
		function convertROT13Char(a){return"A"<=a&&"Z">=a||"a"<=a&&"z">=a?rot13array[a]:a}
		function convertROTStringWithBrackets(a){var b="",d="",e=!0,c=0,g=a.length,f=!1;rot13array||(rot13array=createROT13array());for(c=0;c<g;c++)if(b=a.charAt(c),c<g-4&&"<br/>"==a.toLowerCase().substr(c,4))d+="<br>",c+=3;else if(c<g-3&&"<br>"==a.toLowerCase().substr(c,4))d+="<br>",c+=3;else{if("["==b&&!f)f=!0;else if("]"==b&&f)f=!1;else if("<"==b&&e)e=!1;else if(">"==b&&!e)e=!0;else if(" "!=b)if("&"==b){var h=/\&[^;]*\;/.exec(a.substr(c,a.length-c))[0];h&&(d+=h,c+=h.length-1,b="")}else e&&!f&&(b=convertROT13Char(b));d+=b}return d};
		var lnkDH = $('#ctl00_ContentBody_lnkDH');
		$('#div_hint').html(convertROTStringWithBrackets($('#div_hint').html()));
		var linkText = ((lnkDH.attr('title') == 'Decrypt') ? 'Encrypt' : 'Decrypt');
		lnkDH.text(linkText).attr('title', linkText);


        // VGPS form
        GM_xmlhttpRequest({
            method: "GET",
            url: pgcApiUrl + 'GetExistingVGPSLists',
            onload: function(response) {
                var result = JSON.parse(response.responseText),
                    vgpsLists = result.data.lists,
                    selected = result.data.selected,
                    selectedContent,
                    html = '<li><img width="16" height="16" src="http://maxcdn.project-gc.com/images/mobile_telephone_32.png"> <strong>Add to VGPS</strong><br />',
                    listId, list;

                html += '<select id="comboVGPS" style="width: 138px;">';
                for (listId in vgpsLists) {
                    selectedContent = '';
                    if (+selected === +listId) {
                        selectedContent = ' selected="selected"';
                    }
                    html += '<option value="' + listId + '"' + selectedContent + '>' + vgpsLists[listId].name + '</option>';
                }
                html += '</select>';
                html += '&nbsp;<button id="btnaddToVGPS">+</button>';
                html += '</li>';

                $('div.CacheDetailNavigation ul:first').append(html);

                $('#btnaddToVGPS').click(function(event) {
                    event.preventDefault();
                    addToVGPS();
                });
            }
        });
    }


    function Page_Logbook() {
    	// Since everything in the logbook is ajax, we need to wait for the elements
        waitForKeyElements('#AllLogs tr', Logbook);
        waitForKeyElements('#PersonalLogs tr', Logbook);
        waitForKeyElements('#FriendLogs tr', Logbook);
    }



    function Logbook(jNode) {

        // Add Profile stats and gallery links after each user
        var profileNameElm = $(jNode).find('p.logOwnerProfileName strong a');
        var profileName = profileNameElm.html();

        if (typeof profileName !== 'undefined') {
            profileName = profileNameElm.append('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(profileName) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>')
            	.append('<a href="' + pgcUrl + 'Tools/Gallery?profile_name=' + encodeURIComponent(profileName) + '&submit=Filter"><img src="' + galleryLinkIcon + '" title="PGC Gallery"></a>');
        }


        // Save to latest logs
        if (latestLogs.length < 5) {
            var logType = $(jNode).find('div.LogType strong img').attr('src');

            // First entry is undefined, due to ajax
            if(logType) {
	            latestLogs.push('<img src="' + logType + '" style="margin-bottom: -4px;">');

	            // 2 = found, 3 = dnf, 4 = note, 5 = archive, 22 = disable, 24 = publish, 45 = nm, 46 = owner maintenance, 68 = reviewer note
	            var logTypeId = logType.replace(/.*logtypes\/(.*)\.png/, "$1");

		        if(latestLogs.length == 1) {
		        	if(logTypeId == 3 || logTypeId == 5 || logTypeId == 22 || logTypeId == 45 || logTypeId == 68) {
			        	latestLogsAlert = true;
		        	}
		        }
	        }


            // Show latest logs
            if (latestLogs.length == 5) {
                var images = latestLogs.join('');

                $('#ctl00_ContentBody_size p').removeClass('AlignCenter').addClass('NoBottomSpacing');

                if(latestLogsAlert) {
	                $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing OldWarning"><strong>Latest logs:</strong> <span>' + images + '</span></p>');
                } else {
	                $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing">Latest logs: <span>' + images + '</span></p>');
	            }

            }
        }
    }

}());