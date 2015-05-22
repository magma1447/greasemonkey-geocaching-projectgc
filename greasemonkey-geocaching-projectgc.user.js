/* global $: true */
/* global waitForKeyElements: true */
/* global GM_xmlhttpRequest: true */
/* global GM_getValue: true */
/* global GM_setValue: true */
/* global GM_deleteValue: true */
/* global unsafeWindow: true */
// jshint newcap:false
// jshint multistr:true

// ==UserScript==
// @name        Geocaching.com + Project-GC
// @namespace   PGC
// @description Adds links and data to Geocaching.com to make it collaborate with PGC
// @include     http://www.geocaching.com/*
// @include     https://www.geocaching.com/*
// @version     1.5.0-dev
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js
// @require     https://greasyfork.org/scripts/5392-waitforkeyelements/code/WaitForKeyElements.js?version=19641
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @license     The MIT License (MIT)
// ==/UserScript==


(function() {

    'use strict';

    var pgcUrl = 'http://project-gc.com/',
        pgcApiUrl = pgcUrl + 'api/gm/v1/',
        externalLinkIcon = 'http://maxcdn.project-gc.com/images/external_small.png',
        galleryLinkIcon = 'http://maxcdn.project-gc.com/images/pictures_16.png',
        mapLinkIcon = 'http://maxcdn.project-gc.com/images/map_app_16.png',
        loggedIn = null,
        subscription = null,
        pgcUsername = null,
        gccomUsername = null,
        latestLogs = [],
        latestLogsAlert = false,
        settings = {},
        path = window.location.pathname;

    // Don't run the script for iframes
    if (window.top == window.self) {
        Main();
    }

    function Main() {
        ReadSettings();
        CheckPGCLogin();
    }

    function Router() {
        if (path.match(/^\/geocache\/.*/) !== null) {
            Page_CachePage();
        } else if (path.match(/^\/seek\/cache_logbook\.aspx.*/) !== null) {
            Page_Logbook();
        }
    }

    function GetSettingsItems() {
        var items = {
            showVGPS: {
                title: 'Show Virtual GPS',
                default: true
            },
            addChallengeCheckers: {
                title: 'Add challenge checkers',
                default: true
            },
            makeCopyFriendly: {
                title: 'Make copy friendly GC-Code and link',
                default: true
            },
            addPgcMapLinks: {
                title: 'Add PGC map links',
                default: true
            },
            addLatestLogs: {
                title: 'Add latest logs',
                default: true
            },
            cloneLogsPerType: {
                title: 'Clone number of logs per type',
                default: true
            },
            addPGCLocation: {
                title: 'Add PGC Location',
                default: true
            },
            addAddress: {
                title: 'Add reverse geocoded address',
                default: true
            },
            removeUTM: {
                title: 'Remove UTM coordinates',
                default: true
            },
            addPgcFp: {
                title: 'Add FP from PGC',
                default: true
            },
            profileStatsLinks: {
                title: 'Add links to Profile stats',
                default: true
            },
            tidy: {
                title: 'Tidy the web a bit',
                default: true
            },
            collapseDownloads: {
                title: 'Collapse download links',
                default: false
            },
            addPgcGalleryLinks: {
                title: 'Add links to PGC gallery',
                default: true
            },
            addMapBookmarkListLinks: {
                title: 'Add links for bookmark lists',
                default: true
            },
            decryptHints: {
                title: 'Automatically decrypt hints',
                default: true
            },
            addElevation: {
                title: 'Add elevation',
                default: true
            },
            imperial: {
                title: 'Use imperial units',
                default: false
            }
        };
        return items;
    }

    function ReadSettings() {
        settings = GM_getValue('settings');
        if (typeof(settings) != 'undefined') {
            settings = JSON.parse(settings);
        } else {
            settings = [];
        }

        var items = GetSettingsItems();
        for (var item in items) {
            if (typeof(settings[item]) == 'undefined') {
                settings[item] = items[item].default;
            }
        }
    }

    function SaveSettings(e) {
        GM_deleteValue('disabledFunctions'); // Legacy
        e.preventDefault();
        settings = {};

        for (var item in GetSettingsItems()) {
            settings[item] = Boolean($('#pgcUserMenuForm input[name="' + item + '"]').is(':checked'));
        }

        var json = JSON.stringify(settings);
        GM_setValue('settings', json);

        $('#pgcUserMenuWarning').css('display', 'inherit');
    }

    function IsSettingEnabled(setting) {
        return settings[setting];
    }

    function MetersToFeet(meters) {
        return Math.round(meters * 3.28084);
    }

    function FormatDistance(distance) {
        distance = parseInt(distance, 10);
        distance = IsSettingEnabled('imperial') ? MetersToFeet(distance) : distance;
        distance = distance.toLocaleString();

        return distance;
    }

    /**
     * Check that we are logged in at PGC, and that it's with the same username
     */
    function CheckPGCLogin() {
        GM_xmlhttpRequest({
            method: "GET",
            url: pgcApiUrl + 'GetMyUsername',
            onload: function(response) {
                var result = JSON.parse(response.responseText);

                if (result.status !== 'OK') {
                    alert(response.responseText);
                    return false;
                }

                pgcUsername = result.data.username;
                loggedIn = Boolean(result.data.loggedIn);
                subscription = Boolean(result.data.subscription);

                BuildPGCUserMenu();
                Router();
            },
            onerror: function(response) {
                alert(response);
                return false;
            }
        });
    }

    function BuildPGCUserMenu() {
        var loggedInContent, html, subscriptionContent;

        gccomUsername = false;
        if ($('#ctl00_divSignedIn').length) {
            gccomUsername = $('#ctl00_divSignedIn .li-user-info span').html();
        } else if ($('ul.profile-panel-menu').length) {
            gccomUsername = $('ul.profile-panel-menu .li-user-info span:nth-child(2)').text();
        }

        if (loggedIn === false) {
            loggedInContent = 'Not logged in';
        } else {
            if (pgcUsername == gccomUsername) {
                loggedInContent = '<strong>' + pgcUsername + '</strong>';
            } else {
                loggedInContent = '<strong style="color: red;">' + pgcUsername + '</strong>';
            }

            if (subscription) {
                subscriptionContent = 'Paid membership';
            } else {
                subscriptionContent = 'Missing membership';
            }
        }

        html = '\
        <div onclick="$(\'#pgcUserMenu, #pgcSettingsOverlay\').toggle();" style="position: fixed; top: 0; bottom: 0; left: 0; right: 0; z-index:1004; display: none;" id="pgcSettingsOverlay"></div>\
        <a class="SignedInProfileLink" href="' + pgcUrl + 'ProfileStats/' + pgcUsername + '" title="Project-GC">\
            <span class="avatar">\
                <img src="http://project-gc.com/favicon.ico" alt="Logo" width="30" height="30" style="border-radius:100%; border-width:0;">\
            </span>\
            <span class="li-user-info">\
                <span style="display: block;">' + loggedInContent + '</span>\
                <span class="cache-count">' + subscriptionContent + '</span>\
            </span>\
        </a>\
        <button id="pgcUserMenuButton" type="button" class="li-user-toggle" onclick="$(\'#pgcUserMenu, #pgcSettingsOverlay\').toggle();">\
            <svg width="12px" height="7px" viewBox="0 0 12 7" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g class="arrow" transform="translate(-1277.000000, -25.000000)" stroke="#FFFFFF" fill="#FFFFFF"><path d="M1280.43401,23.3387013 C1280.20315,23.5702719 1280.20315,23.945803 1280.43401,24.1775793 L1284.82138,28.5825631 L1280.43401,32.9873411 C1280.20315,33.2191175 1280.20315,33.5944429 1280.43401,33.8262192 C1280.54934,33.9420045 1280.70072,34 1280.8519,34 C1281.00307,34 1281.15425,33.9422102 1281.26978,33.8262192 L1286.07462,29.0018993 C1286.30548,28.7701229 1286.30548,28.3947975 1286.07462,28.1630212 L1281.26958,23.3387013 C1281.03872,23.106925 1280.66487,23.106925 1280.43401,23.3387013 Z" id="Dropdown-arrow" sketch:type="MSShapeGroup" transform="translate(1283.254319, 28.582435) scale(1, -1) rotate(-90.000000) translate(-1283.254319, -28.582435) "></path></g></g></svg>\
        </button>\
        <ul id="pgcUserMenu" style="z-index: 1005;">\
            <form id="pgcUserMenuForm" style="color: #5f452a;">';

        var items = GetSettingsItems(),
            isChecked = '';
        for (var item in items) {
            isChecked = IsSettingEnabled(item) ? ' checked="checked"' : '';
            // Explicitly set the styles as some pages (i.e. https://www.geocaching.com/account/settings/profile) are missing the required css.
            html += '<li style="margin: .5em 1em; white-space: nowrap;"><label style="font-weight: inherit;"><input type="checkbox" name="' + item + '"' + isChecked + '>&nbsp;' + items[item].title + '</label></li>';
        }

        html += '\
                <li style="margin: .5em 1em;">\
                    <button onclick="document.getElementById(\'pgcUserMenuForm\').reset(); $(\'#pgcUserMenu\').hide(); return false;">Cancel</button>\
                    &nbsp;<button onclick="document.getElementById(\'pgcUserMenuForm\').reset(); return false;">Reset</button>\
                    &nbsp;<button id="pgcUserMenuSave">Save</button>\
                </li>\
                <li id="pgcUserMenuWarning" style="display: none; margin: .5em 1em;"><small class="OldWarning">Reload the page to activate the new settings.</small></li>\
            </form>\
        </ul>';

        if ($('#ctl00_divSignedIn ul.logged-in-user').length) { // The default look of the header bar
            $('#ctl00_divSignedIn ul.logged-in-user').prepend('<li class="li-user">' + html + '</li>');
        } else if ($('ul.profile-panel-menu').length) { // Special case for https://www.geocaching.com/account/settings/preferences
            $('ul.profile-panel-menu').prepend('<li class="li-user">' + html + '</li>');
        }

        $('#pgcUserMenuSave').click(function(e) {
            SaveSettings(e);
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
        var gccode = getGcCodeFromPage(),
            listId = $('#comboVGPS').val(),
            url = pgcApiUrl + 'AddToVGPSList?listId=' + listId + '&gccode=' + gccode + '&sectionName=GM-script';

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                var result = JSON.parse(response.responseText),
                    msg = (result.status === 'OK') ? 'Geocache added to Virtual-GPS!' : 'Geocache not added to Virtual-GPS :(';

                $('#btnAddToVGPS').css('display', 'none');
                $('#btnRemoveFromVGPS').css('display', '');

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
     * removeFromVGPS
     */
    function removeFromVGPS() {
        var gccode = getGcCodeFromPage(),
            listId = $('#comboVGPS').val(),
            url = pgcApiUrl + 'RemoveFromVGPSList?listId=' + listId + '&gccode=' + gccode;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                var result = JSON.parse(response.responseText),
                    msg = (result.status === 'OK') ? 'Geocache removed from Virtual-GPS!' : 'Geocache not removed from Virtual-GPS :(';

                $('#btnAddToVGPS').css('display', '');
                $('#btnRemoveFromVGPS').css('display', 'none');

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
            lastFound = $('#ctl00_ContentBody_bottomSection p small time').get(2),
            coordinates, latitude, longitude, url;

        lastUpdated = (lastUpdated) ? lastUpdated.dateTime : false;
        lastFound = (lastFound) ? lastFound.dateTime : false;

        // Since everything in the logbook is ajax, we need to wait for the elements
        waitForKeyElements('#cache_logs_table tr', Logbook);

        if (subscription) {

            // Get geocache data from Project-GC
            url = pgcApiUrl + 'GetCacheDataFromGccode&gccode=' + gccode;
            if (lastUpdated)
                url += '&lastUpdated=' + lastUpdated;
            if (lastFound)
                url += '&lastFound=' + lastFound;

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
                        fpw = 0,
                        elevation = '',
                        html = '';

                    if (result.status == 'OK' && cacheData !== false) {

                        // If placed by != owner, show the real owner as well.
                        if (placedBy != cacheOwner) {
                            $('#ctl00_ContentBody_mcd1 span.message__owner').before(' (' + cacheOwner + ')');
                        }

                        // Append link to Profile Stats for the cache owner
                        // Need to real cache owner name from PGC since the web only has placed by
                        if (IsSettingEnabled('profileStatsLinks')) {
                            $('#ctl00_ContentBody_mcd1 span.message__owner').before('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(cacheOwner) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>');
                        }

                        // Add FP/FP%/FPW below the current FP
                        if (IsSettingEnabled('addPgcFp')) {
                            fp = parseInt(+cacheData.favorite_points, 10),
                                fpp = parseInt(+cacheData.favorite_points_pct, 10),
                                fpw = parseInt(+cacheData.favorite_points_wilson, 10);
                            $('#uxFavContainerLink').append('<p style="text-align: center; background-color: #f0edeb;">PGC: ' + fp + ' FP, ' + fpp + '%, ' + fpw + 'W</p>');
                        }

                        // Add elevation (Metres above mean sea level = mamsl)
                        if (IsSettingEnabled('addElevation')) {
                            var formattedElevation = FormatDistance(cacheData.elevation),
                                elevationUnit = IsSettingEnabled('imperial') ? 'ft' : 'm',
                                elevationArrow = (cacheData.elevation >= 0) ? '&#x21a5;' : '&#x21a7;';
                            elevation = formattedElevation + ' ' + elevationUnit + ' ' + elevationArrow;

                            if (cacheData.elevation >= 0) {
                                html = '<span> (' + elevation + ')</span>';
                            } else {
                                html = '<span class="OldWarning"> (' + elevation + ')</span>';
                            }

                            ($('#uxLatLonLink').length > 0 ? $('#uxLatLonLink') : $('#uxLatLon').parent()).after(html);
                        }

                        // Add PGC location
                        if (IsSettingEnabled('addPGCLocation')) {
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
                        }


                        // Add challenge checkers
                        if (IsSettingEnabled('addChallengeCheckers') && challengeCheckerTagIds.length > 0) {

                            html = '<div id="checkerWidget" class="CacheDetailNavigationWidget TopSpacing BottomSpacing"><h3 class="WidgetHeader">Checker(s)</h3><div class="WidgetBody" id="PGC_ChallengeCheckers">';
                            for (var i = 0; i < challengeCheckerTagIds.length; i++) {
                                html += '<a href="http://project-gc.com/Challenges/' + challengeCheckerTagIds[i] + '" style="display: block; width: 200px; margin: 0 auto;"><img src="http://maxcdn.project-gc.com/Images/Checker/' + challengeCheckerTagIds[i] + '" title="Project-GC Challenge checker" alt="PGC Checker"></a>';
                            }
                            html += '</div></div>';
                            $('#map_preview_canvas').before(html);
                        }
                    }
                }
            });
        }

        // Tidy the web
        if (IsSettingEnabled('tidy')) {
            $('#lnkMessageOwner').html('');
            $('#ctl00_divContentMain p.Clear').css('margin', '0');
            $('div.Note.PersonalCacheNote').css('margin', '0');
            $('h3.CacheDescriptionHeader').remove();
            $('#ctl00_ContentBody_EncryptionKey').remove();
        }

        // Make it easier to copy the gccode
        if (IsSettingEnabled('makeCopyFriendly')) {
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').
            html('<div style="margin-right: 15px; margin-bottom: 10px;"><p style="font-size: 125%; margin-bottom: 0">' + gccode + '</p>' +
                '<input size="25" type="text" value="http://coord.info/' + encodeURIComponent(gccode) + '" onclick="this.setSelectionRange(0, this.value.length);"></div>');
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').css('font-weight', 'inherit').css('margin-right', '39px');
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div').css('margin', '0 0 5px 0');
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div p').css('font-weight', 'bold');
        }

        // Add PGC Map links
        if (IsSettingEnabled('addPgcMapLinks')) {
            coordinates = $('#ctl00_ContentBody_lnkConversions').attr('href'),
                latitude = coordinates.replace(/.*lat=([^&]*)&lon=.*/, "$1"),
                longitude = coordinates.replace(/.*&lon=([^&]*)&.*/, "$1");
            var mapUrl = pgcUrl + 'Maps/mapcompare/?profile_name=' + gccomUsername +
                '&nonefound=on&ownfound=on&location=' + latitude + ',' + longitude +
                '&max_distance=5&submit=Filter';

            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
                '<div style="margin-bottom: 8px;"><a target="_blank" href="' + mapUrl + '">Project-GC map</a> (<a target="_blank" href="' + mapUrl + '&onefound=on">incl found</a>)</div>'
            );
        }

        // Remove the UTM coordinates
        // $('#ctl00_ContentBody_CacheInformationTable div.LocationData div.span-9 p.NoBottomSpacing br').remove();
        if (IsSettingEnabled('removeUTM')) {
            $('#ctl00_ContentBody_LocationSubPanel').html('');
        }

        // Remove ads
        // PGC can't really do this officially
        // $('#ctl00_ContentBody_uxBanManWidget').remove();

        // Remove disclaimer
        // PGC can't really do this officially
        // $('#ctl00_divContentMain div.span-17 div.Note.Disclaimer').remove();

        // Collapse download links
        // http://www.w3schools.com/charsets/ref_utf_geometric.asp (x25BA, x25BC)
        if (IsSettingEnabled('collapseDownloads')) {
            $('<p style="cursor: pointer; margin: 0;" id="DownloadLinksToggle" onclick="$(\'#ctl00_divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow\').toggle();"><span class="arrow">&#x25BA;</span><span class="arrow open">&#x25BC;</span>Print and Downloads</p>').insertAfter('#ctl00_ContentBody_CacheInformationTable div.LocationData');
            $('#ctl00_divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow.open').hide();
        }

        // Resolve the coordinates into an address
        if (IsSettingEnabled('addAddress')) {
            coordinates = $('#ctl00_ContentBody_lnkConversions').attr('href'),
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
                    $('#ctl00_ContentBody_LocationSubPanel').append(formattedAddress + '<br />');
                }
            });
        }

        // Add number of finds per type to the top
        if (IsSettingEnabled('cloneLogsPerType')) {
            $('#ctl00_ContentBody_CacheInformationTable').before('<div>' + $('#ctl00_ContentBody_lblFindCounts').html() + '</div>');
        }

        // Add link to PGC gallery
        if (subscription && IsSettingEnabled('addPgcGalleryLinks')) {
            var html = '<a href="' + pgcUrl + 'Tools/Gallery?gccode=' + gccode + '&submit=Filter"><img src="' + galleryLinkIcon + '" title="Project-GC Gallery"></a> ';
            $('.CacheDetailNavigation ul li:first').append(html);
        }

        // Add map links for each bookmarklist
        if (IsSettingEnabled('addMapBookmarkListLinks')) {
            $('ul.BookmarkList li').each(function() {
                var guid = $(this).children(':nth-child(1)').attr('href').replace(/.*\?guid=(.*)/, "$1");
                var owner = $(this).children(':nth-child(3)').text();

                // Add the map link
                url = 'http://project-gc.com/Tools/MapBookmarklist?owner_name=' + encodeURIComponent(owner) + '&guid=' + encodeURIComponent(guid);
                $(this).children(':nth-child(1)').append('&nbsp;<a href="' + url + '"><img src="' + mapLinkIcon + '" title="Map with Project-GC"></a>');

                // Add gallery link for the bookmark list
                url = 'http://project-gc.com/Tools/Gallery?bml_owner=' + encodeURIComponent(owner) + '&bml_guid=' + encodeURIComponent(guid) + '&submit=Filter';
                $(this).children(':nth-child(1)').append('&nbsp;<a href="' + url + '"><img src="' + galleryLinkIcon + '" title="Project-GC Gallery"></a>');

                // Add profile stats link to the owner
                url = 'http://project-gc.com/ProfileStats/' + encodeURIComponent(owner);
                $(this).children(':nth-child(3)').append('&nbsp;<a href="' + url + '"><img src="' + externalLinkIcon + '" title="Project-GC Profile stats"></a>');
            });
        }

        // Decrypt the hint
        if (IsSettingEnabled('decryptHints')) {
            unsafeWindow.dht();
        }

        // VGPS form
        if (IsSettingEnabled('showVGPS')) {
            GM_xmlhttpRequest({
                method: "GET",
                url: pgcApiUrl + 'GetExistingVGPSLists?gccode=' + gccode,
                onload: function(response) {
                    var result = JSON.parse(response.responseText),
                        vgpsLists = result.data.lists,
                        selected = result.data.selected,
                        existsIn = result.data.existsIn,
                        selectedContent,
                        existsContent,
                        html = '<li><img width="16" height="16" src="http://maxcdn.project-gc.com/images/mobile_telephone_32.png"> <strong>Add to VGPS</strong><br />',
                        listId;

                    html += '<select id="comboVGPS" style="width: 138px;">';
                    for (listId in vgpsLists) {
                        selectedContent = '';
                        if (+selected === +listId) {
                            selectedContent = ' selected="selected"';
                        }

                        existsContent = '';
                        if (existsIn.indexOf(listId) > -1) {
                            existsContent = ' data-exists="true"';
                        }
                        html += '<option value="' + listId + '"' + selectedContent + existsContent + '>' + vgpsLists[listId].name + '</option>';
                    }
                    html += '</select>';
                    if (existsIn.indexOf(String(selected)) == -1) {
                        html += '&nbsp;<button id="btnAddToVGPS">+</button>';
                        html += '&nbsp;<button id="btnRemoveFromVGPS" style="display: none;">-</button>';
                    } else {
                        html += '&nbsp;<button id="btnAddToVGPS" style="display: none;">+</button>';
                        html += '&nbsp;<button id="btnRemoveFromVGPS">-</button>';
                    }
                    html += '</li>';

                    $('div.CacheDetailNavigation ul:first').append(html);

                    $('#comboVGPS').change(function() {
                        selected = $(this).find(':selected').val();
                        if (existsIn.indexOf(String(selected)) == -1) {
                            $('#btnAddToVGPS').css('display', '');
                            $('#btnRemoveFromVGPS').css('display', 'none');
                        } else {
                            $('#btnAddToVGPS').css('display', 'none');
                            $('#btnRemoveFromVGPS').css('display', '');
                        }
                    });
                    $('#btnAddToVGPS').click(function(event) {
                        event.preventDefault();
                        addToVGPS();
                    });
                    $('#btnRemoveFromVGPS').click(function(event) {
                        event.preventDefault();
                        removeFromVGPS();
                    });
                }
            });
        }
    }

    function Page_Logbook() {
        // Since everything in the logbook is ajax, we need to wait for the elements
        waitForKeyElements('#AllLogs tr', Logbook);
        waitForKeyElements('#PersonalLogs tr', Logbook);
        waitForKeyElements('#FriendLogs tr', Logbook);
    }

    function Logbook(jNode) {
        // Add Profile stats and gallery links after each user
        if (IsSettingEnabled('profileStatsLinks')) {
            var profileNameElm = $(jNode).find('p.logOwnerProfileName strong a');
            var profileName = profileNameElm.html();

            if (typeof profileName !== 'undefined') {
                profileName = profileNameElm.append('<a href="' + pgcUrl + 'ProfileStats/' + encodeURIComponent(profileName) + '"><img src="' + externalLinkIcon + '" title="PGC Profile Stats"></a>')
                    .append('<a href="' + pgcUrl + 'Tools/Gallery?profile_name=' + encodeURIComponent(profileName) + '&submit=Filter"><img src="' + galleryLinkIcon + '" title="PGC Gallery"></a>');
            }
        }

        // Save to latest logs
        if (latestLogs.length < 5) {
            var logType = $(jNode).find('div.LogType strong img').attr('src');

            // First entry is undefined, due to ajax
            if (logType) {
                latestLogs.push('<img src="' + logType + '" style="margin-bottom: -4px; margin-right: 1px;">');
                // 2 = found, 3 = dnf, 4 = note, 5 = archive, 22 = disable, 24 = publish, 45 = nm, 46 = owner maintenance, 68 = reviewer note
                var logTypeId = +logType.replace(/.*logtypes\/(\d+)\.png/, "$1");
                if (latestLogs.length === 1 && $.inArray(logTypeId, [3, 5, 22, 45, 68]) !== -1) {
                    latestLogsAlert = true;
                }
            }

            // Show latest logs
            // TODO : Fix this code => latestLogs.length === 5 but it's < 5 higher...
            if (IsSettingEnabled('addLatestLogs') && latestLogs.length === 5) {
                var images = latestLogs.join('');

                $('#ctl00_ContentBody_size p').removeClass('AlignCenter').addClass('NoBottomSpacing');

                if (latestLogsAlert) {
                    $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing OldWarning"><strong>Latest logs:</strong> <span>' + images + '</span></p>');
                } else {
                    $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing">Latest logs: <span>' + images + '</span></p>');
                }
            }
        }
    }

}());