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
// @version     1.1
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js
// @require     https://greasyfork.org/scripts/5392-waitforkeyelements/code/WaitForKeyElements.js?version=19641
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

'use strict';

(function() {

    var pgcUrl = 'http://project-gc.com/',
        pgcApiUrl = pgcUrl + 'api/gm/v1/',
        externalLinkIcon = 'http://maxcdn.project-gc.com/images/external_small.png',
        loggedIn = GM_getValue('loggedIn'),
        subscription = GM_getValue('subscription'),
        pgcUsername = GM_getValue('pgcUsername'),
        gccomUsername = GM_getValue('gccomUsername'),
        latestLogs = [],
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
            CachePage();
        } else if (path.match(/^\/seek\/cache_logbook\.aspx.*/) !== null) {
            Logbook();
        }

    }

    /**
     * Check that we are logged in at PGC, and that it's with the same username
     */
    function CheckPGCLogin() {

        gccomUsername = $('#ctl00_divSignedIn .li-user-info span').html();
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
                    subscriptionContent = 'Premium';
                }

                html = '<a class="SignedInProfileLink" href="' + pgcUrl + '" title="Project-GC">\
                            <span class="avatar">\
                                <img src="http://project-gc.com/favicon.ico" alt="Logo" width="30" height="30" style="border-radius:100%border-width:0px;">\
                            </span>\
                            <span class="li-user-info">\
                                <span>' + loggedInContent + '</span>\
                                <span class="cache-count">' + subscriptionContent + '</span>\
                            </span>\
                        </a>';

                if ($('#ctl00_divSignedIn ul')) {
                    $('#ctl00_divSignedIn ul').prepend('<li class="li-user">' + html + '</li>');
                } else {
                    $('#ctl00_divNotSignedIn').append('<div>' + html + '</div>'); // FIXME - Not working
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
     * CachePage
     */
    function CachePage() {
        var gccode = getGcCodeFromPage(),
            cacheOwnerDiv = $('#ctl00_ContentBody_mcd1'),
            placedBy = $('#ctl00_ContentBody_mcd1 a').html();

        GM_setValue('gccode', gccode);

        // Append links to Profile Stats for every geocacher who has logged the cache as well
        cacheOwnerDiv.append('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(placedBy) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>');

        // Though this is ajax, so we need some magic
        waitForKeyElements('#cache_logs_table tr', CachePage_Logbook);

        // Get cache data from PGC
        if (GM_getValue('subscription')) {
            GM_xmlhttpRequest({
                method: "GET",
                url: pgcApiUrl + 'GetCacheDataFromGccode?gccode=' + encodeURIComponent(gccode),
                onload: function(response) {
                    var result = JSON.parse(response.responseText),
                        cacheData = result.data,
                        location = [],
                        // Add FP/FP%/FPW below the current FP
                        fp = parseInt(cacheData.favorite_points, 10),
                        fpp = parseInt(cacheData.favorite_points_pct, 10),
                        fpw = parseInt(cacheData.favorite_points_wilson, 10);

                    $('#ctl00_divContentMain div.span-17 div.span-6.right.last div.favorite.right').append('<p>(' + fp + ' FP, ' + fpp + '%, ' + fpw + 'W)</p>');

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
                    $('#ctl00_ContentBody_Location').html('<span>' + location + '</span>');
                }
            });
        }


        // Make it easier to copy the gccode
        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').
        html('<div style="margin-right: 15px; margin-bottom: 10px;"><p style="font-size: 125%; margin-bottom: 0">' + gccode + '</p>' +
            '<input size="25" type="text" value="http://coord.info/' + encodeURIComponent(gccode) + '" onclick="this.setSelectionRange(0, this.value.length);"></div>');


        // Remove the UTM coordinates
        // $('#ctl00_ContentBody_CacheInformationTable div.LocationData div.span-9 p.NoBottomSpacing br').remove();
        $('#ctl00_ContentBody_LocationSubPanel').html();

        // Remove ads
        // PGC can't really do this officially
        // $('#ctl00_ContentBody_uxBanManWidget').remove();

        // Remove disclaimer
        // PGC can't really do this officially
        // $('#ctl00_divContentMain div.span-17 div.Note.Disclaimer').remove();

        // Hide download links
        $('<p style="cursor: pointer;" onclick="$(\'#ctl00_divContentMain div.DownloadLinks\').toggle();"><span class="arrow">▼</span>Print and Downloads</p>').insertAfter('#ctl00_ContentBody_CacheInformationTable div.LocationData');
        $('#ctl00_divContentMain div.DownloadLinks').hide();


        // Turn the coordinates into an address
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
        // $('#ctl00_ContentBody_lblFindCounts').find('img').each(function() {
        // 	if($(this).attr('src') == '/images/logtypes/2.png') {	// Found
        // 	}
        // });
        $('#cacheDetails').append('<div>' + $('#ctl00_ContentBody_lblFindCounts').html() + '</div>');


        // Add link to PGC gallery
        if (subscription) {
            var html = '<a href="' + pgcUrl + 'Tools/Gallery?gccode=' + gccode + '&submit=Filter"><img src="' + externalLinkIcon + '" title="Project-GC"></a> ';
            $('.CacheDetailNavigation ul li:first').append(html);
        }



        var gccomUsername = GM_getValue('gccomUsername');
        var mapUrl = pgcUrl + 'Maps/mapcompare/?profile_name=' + gccomUsername +
            '&nonefound=on&ownfound=on&location=' + latitude + ',' + longitude +
            '&max_distance=5&submit=Filter';

        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
            '<a target="_blank" href="' + mapUrl + '&onefound=on">View on Project-GC</a>');

        $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
            ' <a target="_blank" href="' + mapUrl + '">(not found)</a>');

        GM_xmlhttpRequest({
            method: "GET",
            url: pgcApiUrl + 'GetExistingVGPSLists',
            onload: function(response) {
                var result = JSON.parse(response.responseText),
                    vgpsLists = result.data.lists,
                    selected = result.data.selected,
                    html = '<li> <img width=16 height=16 src="http://maxcdn.project-gc.com/images/mobile_telephone_32.png"> Add to V-GPS <br>';
                html += '<select id="comboVGPS">';
                console.log('result', result);
                for (var listId in vgpsLists) {
                    var list = vgpsLists[listId];
                    if (selected == listId) {
                        selected = ' selected="selected"';
                    }
                    html += '<option value="' + listId + '"' + selected + '>' + list.name + '</option>';
                }
                html += '</select>';
                html += '<button id="btnaddToVGPS">+</button>';
                html += '</li>';

                $('div.CacheDetailNavigation ul:first').append(html);

                $('#btnaddToVGPS').click(function(event) {
                    event.preventDefault();
                    addToVGPS();
                });
            }
        });
    }

    function CachePage_Logbook(jNode) {

        // Add Profile stats link after each user
        var profileNameElm = $(jNode).find('p.logOwnerProfileName strong a');
        var profileName = profileNameElm.html();

        if (typeof profileName !== 'undefined') {
            profileName = profileNameElm.append('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(profileName) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>');
        }

        // Save to latest logs
        if (latestLogs.length < 5) {
            var logType = $(jNode).find('div.LogType strong img').attr('src');
            if (logType == '/images/logtypes/3.png') { // dnf
                latestLogs.push('<img src="' + logType + '">');
            } else if (logType == '/images/logtypes/2.png') { // found
                latestLogs.push('<img src="' + logType + '">');
            }

            // Show them
            if (latestLogs.length == 5) {
                var images = latestLogs.join('');
                // $('#ctl00_ContentBody_diffTerr').append('<dl><dt> Latest logs:</dt><dd><span>' + images + '</span></dd></dl>');
                $('#ctl00_ContentBody_size p').addClass('NoBottomSpacing');
                $('#ctl00_ContentBody_size').append('<p class="AlignCenter NoBottomSpacing">Latest logs: <span>' + images + '</span></p>');

            }
        }
    }


    function Logbook() {
        waitForKeyElements('#AllLogs tr', CachePage_Logbook);
    }

    // Not used?
    // function Logbook_Logbook(jNode) {
    //     CachePage_Logbook(jNode);
    // }

}());