/* global $: true */
/* global waitForKeyElements: true */
/* global GM: true */
/* global unsafeWindow: true */
/* globals i18next, i18nextXHRBackend, i18nextBrowserLanguageDetector */
// jshint newcap:false
// jshint multistr:true
// jshint esversion:8

// ==UserScript==
// @author          Ground Zero Communications AB
// @license         The MIT License (MIT)
// @name            Geocaching.com + Project-GC
// @namespace       PGC
// @description     Adds links and data to Geocaching.com to make it collaborate with PGC
// @icon            https://project-gc.com/favicon-32x32.png
// @match           http://www.geocaching.com/*
// @match           https://www.geocaching.com/*
// @exclude         https://www.geocaching.com/profile/profilecontent.html
// @exclude         https://www.geocaching.com/help/*
// @version         3.0.0
// @require         http://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js
// @require         https://greasyfork.org/scripts/383527-wait-for-key-elements/code/Wait_for_key_elements.js?version=701631
// @require         https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require         https://unpkg.com/i18next@21.9.1/i18next.min.js
// @require         https://unpkg.com/i18next-xhr-backend@3.2.2/i18nextXHRBackend.js
// @require         https://unpkg.com/i18next-browser-languagedetector@6.1.4/i18nextBrowserLanguageDetector.js
// @grant           GM.xmlHttpRequest
// @grant           GM.setValue
// @grant           GM.getValue
// @grant           GM.addStyle
// @connect         maps.googleapis.com
// @connect         project-gc.com
// @connect         img.geocaching.com
// @connect         s3.amazonaws.com
// @connect         nominatim.openstreetmap.org
// @connect         *
// @updateURL       https://github.com/magma1447/greasemonkey-geocaching-projectgc/raw/master/greasemonkey-geocaching-projectgc.user.js
// @downloadURL     https://github.com/magma1447/greasemonkey-geocaching-projectgc/raw/master/greasemonkey-geocaching-projectgc.user.js
// ==/UserScript==


// MIT License
// Copyright (c) 2014 Ground Zero Communications AB
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
// The above copyright notice and this permission notice (including the next paragraph) shall be included in all copies or substantial
// portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
// FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(function() {

    'use strict';

    const pgcUrl    = 'https://project-gc.com',
          pgcApiUrl = pgcUrl + '/api/v1',
          path      = window.location.pathname,
          icons     = {
              externalLink:            pgcUrl + '/images/external_small.png',
              galleryLink:             pgcUrl + '/images/pictures_16.png',
              challengeCheckerSuccess: pgcUrl + '/images/check16.png',
              challengeCheckerFail:    pgcUrl + '/images/cancel16.png',
              mapLink:                 pgcUrl + '/images/map_app_16.png',
          };

    let loggedIn               = null,
        subscription           = null,
        pgcUsername            = null,
        imperialFlag           = null,
        gccomUsername          = null,
        latestLogs            = [],
        latestLogsAlert     = false,
        settings                 = {},
        challengeCheckerResults = null,
        _language             = '';


    function metersToFeet(meters) {
        return Math.round(meters * 3.28084);
    }

    function formatDistance(distance) {
        distance = parseInt(distance, 10);
        distance = imperialFlag ? metersToFeet(distance) : distance;
        distance = distance.toLocaleString();

        return distance;
    }

    function getUrlParameter(sParam) {
        let sPageURL = decodeURIComponent(window.location.search.substring(1)),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }

        return false;
    }

    function isSettingEnabled(setting) {
        return settings[setting];
    }

    /**
     * getGcCodeFromPage
     * @return string
     */
    function getGcCodeFromPage() {
        return $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoCode').html();
    }

    function getSettingsItems() {
        return {
            showVGPS: {
                title: i18next.t('menu.showvpgs'),
                default: true
            },
            addChallengeCheckers: {
                title: i18next.t('menu.addcc'),
                default: true
            },
            makeCopyFriendly: {
                title: i18next.t('menu.makeCopyFriendly'),
                default: true
            },
            addPgcMapLinks: {
                title: i18next.t('menu.addPgcMapLinks'),
                default: true
            },
            addLatestLogs: {
                title: i18next.t('menu.addLatestLogs'),
                default: true
            },
            cloneLogsPerType: {
                title: i18next.t('menu.cloneLogsPerType'),
                default: true
            },
            addPGCLocation: {
                title: i18next.t('menu.addPGCLocation'),
                default: true
            },
            addAddress: {
                title: i18next.t('menu.addAddress'),
                default: true
            },
            removeUTM: {
                title: i18next.t('menu.removeUTM'),
                default: true
            },
            addPgcFp: {
                title: i18next.t('menu.addPgcFp'),
                default: true
            },
            showWeekday: {
                title: i18next.t('menu.showWeekday'),
                default: true
            },
            profileStatsLinks: {
                title: i18next.t('menu.profileStatsLinks'),
                default: true
            },
            tidy: {
                title: i18next.t('menu.tidy'),
                default: true
            },
            collapseDownloads: {
                title: i18next.t('menu.collapseDownloads'),
                default: false
            },
            addPgcGalleryLinks: {
                title: i18next.t('menu.addPgcGalleryLinks'),
                default: true
            },
            addMapBookmarkListLinks: {
                title: i18next.t('menu.addMapBookmarkListLinks'),
                default: true
            },
            decryptHints: {
                title: i18next.t('menu.decryptHints'),
                default: true
            },
            addElevation: {
                title: i18next.t('menu.addElevation'),
                default: true
            },
            removeDisclaimer: {
                title: i18next.t('menu.removeDisclaimer'),
                default: true
            },
            addGeocacheLogsPerProfileCountry: {
                title: i18next.t('menu.addGeocacheLogsPerProfileCountry'),
                default: true
            },
            openDraftLogInSameWindow: {
                title: i18next.t('menu.openDraftLogInSameWindow'),
                default: true
            },
            geocacheNoteFont: {
                title: i18next.t('menu.geocacheNoteFont'),
                default: true
            },
            logbookLinks: {
                title: i18next.t('menu.logbookLinks'),
                default: true
            },
            addMyNumberOfLogs: {
                title: i18next.t('menu.addMyNumberOfLogs'),
                default: true
            },
            hideMapFromPrintGeocachePage: {
                title: i18next.t('menu.hideMapFromPrintGeocachePage'),
                default: true
            },
            addCachedChallengeCheckerResults: {
                title: i18next.t('menu.addCachedChallengeCheckerResults'),
                default: true
            },
            hideLogVoting: {
                title: i18next.t('menu.hideLogVoting'),
                default: false
            }
        };
    }

    function saveSettings(e) {
        e.preventDefault();
        settings = {};

        for (let item in getSettingsItems()) {
            settings[item] = Boolean($('#pgcUserMenuForm input[name="' + item + '"]').is(':checked'));
        }

        const json = JSON.stringify(settings);
        GM.setValue('settings', json);

        $('#pgcUserMenuWarning').css('display', 'inherit');
    }

    async function readSettings() {
        settings = await GM.getValue('settings');
        if (typeof(settings) !== 'undefined') {
            settings = JSON.parse(settings);
            if (settings === null) {
                settings = [];
            }
        }
        else {
            settings = [];
        }

        const items = getSettingsItems();
        for (let item in items) {
            if (typeof(settings[item]) === 'undefined') {
                settings[item] = items[item].default;
            }
        }
    }

    /**
     * addToVGPS
     */
    function addToVGPS(gccode) {
        const listId = $('#comboVGPS').val();

        if (typeof(gccode) === 'undefined') { // The map provides the gccode itself
            gccode = getGcCodeFromPage();
        }

        GM.xmlHttpRequest({
            method: "PUT",
            url: pgcApiUrl + '/virtual-gps/vgpsid:' + listId + '/geocaches',
            headers: { 'Content-Type': 'application/json', 'X-App-ID': '10' },
            data: JSON.stringify({ gccodes: [gccode] }),
            onload: function(response) {
                const result = JSON.parse(response.responseText),
                    msg = (result.status.message === 'ok') ? i18next.t('vpgs.added') : i18next.t('vpgs.notadded');

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
        return true;
    }

    /**
     * removeFromVGPS
     */
    function removeFromVGPS(gccode) {
        const listId = $('#comboVGPS').val();

        if (typeof(gccode) === 'undefined') { // The map provides the gccode itself
            gccode = getGcCodeFromPage();
        }

        GM.xmlHttpRequest({
            method: "DELETE",
            url: pgcApiUrl + '/virtual-gps/vgpsid:' + listId + '/geocaches',
            headers: { 'Content-Type': 'application/json', 'X-App-ID': '10' },
            data: JSON.stringify({ gccodes: [gccode] }),
            onload: function(response) {
                const result = JSON.parse(response.responseText),
                    msg = (result.status.message === 'ok') ? i18next.t('vpgs.removed') : i18next.t('vpgs.notre');

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

    function pagePrintGeocachePage() {
        // Remove the disclaimer
        $('div.TermsWidget').css('display', 'none');


        // Get rid of the Logs section if it's not asked for. But keep it if we asked for it, even though there are 0 logs.
        if( getUrlParameter('lc') === false ) {
            $('div.item.ui-widget > div.item-header > h2.ui-sortable-handle').each(function() {
                if( $(this).html() === 'Logs' ) {    // Will only work with English
                    $(this).parent().parent().addClass('no-print').css('display', 'none');
                    return false;   // Break .each loop
                }
            });
        }


        if(isSettingEnabled('hideMapFromPrintGeocachePage')) {
            $('#map').parent().parent().addClass('no-print');
            $('#map').parent().prev().children('span.ui-icon').removeClass('ui-icon-minusthick').addClass('ui-icon-plusthick');
            $('#map').parent().css('display', 'none');
        }
    }

    function pageMessagecenter() {
        const target = document.getElementById('currentMessage');
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if(mutation.type === "childList") {
                    const userlink = $(".user-meta a.current-user-image").attr("href"), username = $(".user-meta span.current-user-name").html();
                    $(".user-meta span.current-user-name").html("<a href='"+userlink+"'>"+username+"</a>");
                }
            });
        });

        const config = { childList: true };
        observer.observe(target, config);
    }

    function draft(jNode) {
        $(jNode).find(".draft-content > a").removeAttr('target');
    }

    function pageDrafts() {
        if (isSettingEnabled("openDraftLogInSameWindow")) {
          waitForKeyElements('#draftsHub > ul.draft-list > li.draft-item', draft);
        }
    }

    function pageMap() {
        if (isSettingEnabled('showVGPS')) {

            setTimeout(function() {
                $('#map_canvas div.leaflet-popup-pane').bind('DOMSubtreeModified', function(event) {
                    if (event.target.className === 'leaflet-popup-pane' && $('#pgc_vgps').length === 0) {
                        const gccode = $('#gmCacheInfo div.code').first().text();

                        $('#gmCacheInfo div.links').after('<div id="pgc_vgps"></div>');

                        GM.xmlHttpRequest({
                            method: "GET",
                            url: pgcApiUrl + '/virtual-gps?gccode=' + gccode,
                            headers: { 'X-App-ID': '10' },
                            onload: function(response) {
                                const result = JSON.parse(response.responseText);
                                if (result.status.message !== 'ok') {
                                    return;
                                }

                                let vgpsLists = result.data.lists,
                                    selected = result.data.selected,
                                    existsIn = result.data.existsIn,
                                    selectedContent,
                                    existsContent,
                                    html,
                                    listId;


                                html = '<img src="https://project-gc.com/images/mobile_telephone_32.png" style="width: 24px; height: 24px; margin-bottom: -6px;">';

                                html += '<select id="comboVGPS" style="margin-bottom: 4px;">';
                                for (let k in vgpsLists) {
                                    listId = vgpsLists[k].id;

                                    selectedContent = '';
                                    if (+selected === +listId) {
                                        selectedContent = ' selected="selected"';
                                    }
                                    existsContent = '';
                                    if (existsIn.indexOf(listId) > -1) {
                                        existsContent = ' data-exists="true"';
                                    }

                                    html += '<option value="' + listId + '"' + selectedContent + existsContent + '>' + vgpsLists[k].name + '</option>';
                                }
                                html += '</select>';

                                if (existsIn.indexOf(selected) === -1) {
                                    html += '&nbsp;<button id="btnAddToVGPS">+</button>';
                                    html += '&nbsp;<button id="btnRemoveFromVGPS" style="display: none;">-</button>';
                                }
                                else {
                                    html += '&nbsp;<button id="btnAddToVGPS" style="display: none;">+</button>';
                                    html += '&nbsp;<button id="btnRemoveFromVGPS">-</button>';
                                }

                                $('#pgc_vgps').html(html);


                                $('#btnAddToVGPS').click(function(event) {
                                    event.preventDefault();
                                    addToVGPS(gccode);
                                });
                                $('#btnRemoveFromVGPS').click(function(event) {
                                    event.preventDefault();
                                    removeFromVGPS(gccode);
                                });
                            }
                        });
                    }
                });
            }, 500);
        }

    }

    function logbook(jNode) {
        // Add Profile stats and gallery links after each user
        if (isSettingEnabled('profileStatsLinks')) {
            const profileNameElm = $(jNode).find('a.h5');
            let profileName = profileNameElm.html();

            if (typeof profileName !== 'undefined') {
                profileName = profileNameElm.append('<a href="' + pgcUrl + '/ProfileStats/' + encodeURIComponent(profileName) + '"><img src="' + icons.externalLink + '" title="' + i18next.t("other.prostats")+'"></a>')
                    .append('<a href="' + pgcUrl + '/Tools/Gallery?filter_pr_profileName=' + encodeURIComponent(profileName) + '&submit=Filter"><img src="' + icons.galleryLink + '" title="' + i18next.t("other.gallery")+'"></a>');
            }
        }

        if(isSettingEnabled('addCachedChallengeCheckerResults') && typeof(challengeCheckerResults) !== 'undefined' && challengeCheckerResults !== null) {
            const classes = $(jNode).attr('class');
            const logId = classes.match(/l-[0-9]+/)[0].replace('l-', '');
            if(typeof(challengeCheckerResults[logId]) !== 'undefined') {
                if(challengeCheckerResults[logId]['status'] === 'success') {
                    $(jNode).find('div.LogDisplayLeft').first().append('<hr style="margin-top: 12px; margin-bottom: 12px;"><p><br>' + challengeCheckerResults[logId]['lastRun'] + ' UTC: <img src="' + icons.challengeCheckerSuccess + '"></p>');
                }
                else if(challengeCheckerResults[logId]['status'] === 'fail') {
                    $(jNode).find('div.LogDisplayLeft').first().append('<hr style="margin-top: 12px; margin-bottom: 12px;"><p>' + i18next.t("other.checker")+'<br>' + challengeCheckerResults[logId]['lastRun'] + ' UTC: <img src="' + icons.challengeCheckerFail + '"></p>');
                }
            }
        }

        if(isSettingEnabled('hideLogVoting')) {
            $('div.upvotes').css('display','none');
            $('div.sort-logs').css('display','none');
        }


        // Save to latest logs
        if (latestLogs.length < 5) {
            // 2022-08-23, Issue #109: Fix for latestLogs, using span instead of div.
            let node = $(jNode).find('span.h4 img[src]'),
                logType = {};

            if (node.length === 0) {
                 return false;
            }

            logType = {
                'src': node.attr('src'),
                'alt': node.attr('alt'),
                'title': node.attr('title')
            };

            logType.id = +logType.src.replace(/.*logtypes\/(\d+)\.png/, "$1");

            // First entry is undefined, due to ajax
            if (logType.src) {
                latestLogs.push('<img src="' + logType.src + '" alt="' + logType.alt + '" title="' + logType.title + '" style="margin-bottom: -4px; margin-right: 1px;">');
                // 2 = found, 3 = dnf, 4 = note, 5 = archive, 22 = disable, 24 = publish, 45 = nm, 46 = owner maintenance, 68 = reviewer note
                if ($.inArray(logType.id, [3, 5, 22, 45, 68]) !== -1) {
                    latestLogsAlert = true;
                }
            }

            // Show latest logs
            // Enhanced Nov 2016 to show icons for up to 5 of the latest logs
            if (isSettingEnabled('addLatestLogs') && latestLogs.length <= 5) {
                const images = latestLogs.join('');

                $('#latestLogIcons').remove();
                $('#ctl00_ContentBody_size p').removeClass('AlignCenter').addClass('NoBottomSpacing');

                if (latestLogsAlert) {
                    $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing OldWarning" id="latestLogIcons"><strong>' + i18next.t("other.latest2")+'</strong> <span>' + images + '</span></p>');
                }
                else {
                    $('#ctl00_ContentBody_size').append('<p class="NoBottomSpacing" id="latestLogIcons">' + i18next.t("other.latest2")+' <span>' + images + '</span></p>');
                }
            }
        }
    }

    function pageLogbook() {
        // Since everything in the logbook is ajax, we need to wait for the elements
        waitForKeyElements('#AllLogs tr', logbook);
        waitForKeyElements('#PersonalLogs tr', logbook);
        waitForKeyElements('#FriendLogs tr', logbook);
    }

    function pageProfile() {
        // Override gc.com function on alerting for external links to not alert for Project-GC URLs
        const gcAlertOverride = document.createElement('script');
        gcAlertOverride.type = "text/javascript";
        gcAlertOverride.innerHTML = `(function() {
                let _old_isGeocachingDomain = isGeocachingDomain;
                isGeocachingDomain = function(url) {
                    return (_old_isGeocachingDomain.apply(this, arguments)
                        || url == "project-gc.com"
                        || url == "www.project-gc.com");
                };
            })();`;
        document.getElementsByTagName('head')[0].appendChild(gcAlertOverride);
    }

    // ==========================================
    // pageGeocachePage
    // ==========================================
    function pageGeocachePage() {
        let gccode = getGcCodeFromPage(),
            placedBy = $('#ctl00_ContentBody_mcd1 a').html(),
            coordinates, latitude, longitude, url;

        if (subscription) {

            // Get geocache data from Project-GC
            GM.xmlHttpRequest({
                method: "GET",
                url: pgcApiUrl + '/userscript/geocache/gccode:' + gccode,
                headers: { 'X-App-ID': '10' },
                onload: function(response) {
                    if (response.status === 404) {
                        return;
                    }
                    const result = JSON.parse(response.responseText);
                    if (result.status.message !== 'ok') {
                        return;
                    }
                    let geocacheData = result.data.geocache,
                        bearing = result.data.bearing,
                        geocacheOwner = result.data.owner,
                        challengeCheckerTagIds = result.data.challengeCheckerTagIds,
                        geocacheLogsPerCountry = result.data.geocacheLogsPerCountry,
                        myNumberOfLogs = result.data.myLogCount,
                        location = [],
                        fp = 0,
                        fpp = 0,
                        fpw,
                        elevation = '',
                        html = '';


                    challengeCheckerResults = result.data.challengeCheckerResults;

                    // Add an alert in top if there are Found it-logs which doesn't seem to fulfill the requirements
                    if(challengeCheckerResults !== false) {
                        const suspiciousFoundItLogs = [];
                        for(let logId in challengeCheckerResults) {
                            if(typeof challengeCheckerResults[logId] !== 'undefined' && !challengeCheckerResults[logId]['status']) {
                                suspiciousFoundItLogs.push(logId);
                            }
                        }

                        if(suspiciousFoundItLogs.length !== 0) {
                            let suspiciousFoundItLog = '<p style="color: #ff6c00;" class=" NoBottomSpacing"><strong>' + i18next.t('vpgs.issue') + '</strong></p>\
                                        <ul style="color: #ff6c00;" class="">\
                                            <li>' + i18next.t('vpgs.notfull') + ' <br>';

                            for(let i = 0 ; i < suspiciousFoundItLogs.length ; i++) {
                                suspiciousFoundItLog = suspiciousFoundItLog + ' <a href="https://www.geocaching.com/seek/log.aspx?LID=' + suspiciousFoundItLogs[i] + '">' + challengeCheckerResults[suspiciousFoundItLogs[i]]['profileName'] + '</a><br>';
                            }
                            suspiciousFoundItLog = suspiciousFoundItLog + i18next.t('cpage.suspiciousFoundItLog') +'</li></ul>';

                            $('div.span-6.right.last').last().next().after(suspiciousFoundItLog);
                        }
                    }
                    //--


                    if (geocacheData) {

                        // If placed by != owner, show the real owner as well.
                        if (placedBy !== geocacheOwner) {
                            $('#ctl00_ContentBody_mcd1 span.message__owner').before(' (' + geocacheOwner + ')');
                        }

                        // Append link to Profile Stats for the cache owner
                        // Need to real cache owner name from PGC since the web only has placed by
                        if (isSettingEnabled('profileStatsLinks')) {
                            $('#ctl00_ContentBody_mcd1 span.message__owner').before('<a href="' + pgcUrl + '/ProfileStats/' + encodeURIComponent(geocacheOwner) + '"><img src="' + icons.externalLink + '" title="' + i18next.t('cpage.stats') +'"></a>');
                        }

                        // Add FP/FP%/FPW below the current FP + mouseover for FP% and FPW with decimals
                        if (isSettingEnabled('addPgcFp') &&
                                geocacheData.favoritePoints !== null &&
                                geocacheData.favoritePointsPct !== null &&
                                geocacheData.favoritePointsWilson !== null) {
                            fp  = +geocacheData.favoritePoints;
                            fpp = +geocacheData.favoritePointsPct;
                            fpw = +geocacheData.favoritePointsWilson;
                            $('#uxFavContainerLink').append('<p title="' + fpp + '%, ' + fpw + 'W" style="text-align: center; background-color: #f0edeb;border-bottom-left-radius: 5px;border-bottom-right-radius:5px;">PGC: ' + fp + ' FP, ' + Math.round(fpp) + '%, ' + Math.round(fpw) + 'W</p>');
                            $('.favorite-container').css({
                                "border-bottom-left-radius": "0",
                                "border-bottom-right-radius": "0"
                            });
                        }

                        // Add elevation (Metres above mean sea level = mamsl)
                        if (isSettingEnabled('addElevation')) {
                            const formattedElevation = formatDistance(geocacheData.elevation),
                                elevationUnit = imperialFlag ? 'ft' : 'm',
                                elevationArrow = (geocacheData.elevation >= 0) ? '&#x21a5;' : '&#x21a7;';
                                elevation = formattedElevation + ' ' + elevationUnit + ' ' + elevationArrow;

                            if (geocacheData.elevation >= 0) {
                                html = '<span> (' + elevation + ')</span>';
                            }
                            else {
                                html = '<span class="OldWarning"> (' + elevation + ')</span>';
                            }

                            ($('#uxLatLonLink').length > 0 ? $('#uxLatLonLink') : $('#uxLatLon').parent()).after(html);
                        }

                        // Add PGC location
                        if (isSettingEnabled('addPGCLocation')) {
                            if (geocacheData.country.length > 0) {
                                location.push(geocacheData.country);
                            }
                            if (geocacheData.region !== null && geocacheData.region.length > 0) {
                                location.push(geocacheData.region);
                            }
                            if (geocacheData.county !== null && geocacheData.county.length > 0) {
                                location.push(geocacheData.county);
                            }
                            location = location.join(' / ');

                            const gccomLocationData = $('#ctl00_ContentBody_Location').html();
                            $('#ctl00_ContentBody_Location').html('<span style="text-decoration: line-through;">' + gccomLocationData + '</span><br><span>' + location + '</span>');
                        }

                        // Add bearing from home
                        $('#lblDistFromHome').append(' <span>(' + Math.round(bearing*10)/10 + '&deg;)</span>');

                        // Add challenge checkers
                        if (isSettingEnabled('addChallengeCheckers') && challengeCheckerTagIds.length > 0) {
                            html = '<div id="checkerWidget" class="CacheDetailNavigationWidget TopSpacing BottomSpacing"><h3 class="WidgetHeader">' + i18next.t('cpage.checkers') +'' + i18next.t('cpage.plural') +'</h3><div class="WidgetBody" id="PGC_ChallengeCheckers">';
                            for (let i = 0; i < challengeCheckerTagIds.length; i++) {
                                html += '<a href="https://project-gc.com/Challenges/' + gccode + '/' + challengeCheckerTagIds[i] + '" style="display: block; width: 200px; margin: 0 auto;"><img src="https://project-gc.com/Images/Checker/' + challengeCheckerTagIds[i] + '" title="' + i18next.t('vpgs.title') +'" alt=' + i18next.t('vpgs.alt') +'></a>';
                            }
                            html += '</div></div>';
                            $('#ctl00_ContentBody_detailWidget').before(html);
                        }

                        // Display warning message if cache is logged and no longer be logged
                        if (geocacheData.locked) {
                            $('ul.OldWarning').append('<li>' + i18next.t('cpage.locked') +'</li>');
                        }

                        // Add geocache logs per profile country table
                        if (isSettingEnabled('addGeocacheLogsPerProfileCountry')) {
                            html = '<div id="geocacheLogsPerCountry" style="border: dashed; border-color: #aaa; border-width: thin;">';

                            if(typeof(geocacheLogsPerCountry['willAttend']) !== 'undefined' && geocacheLogsPerCountry['willAttend'].length > 0) {
                                html += '<p style="margin-left: 10px; margin-bottom: 0;"><strong>' + i18next.t('cpage.prcountry') +'</strong> <small>' + i18next.t('cpage.pgc') +'</small></p>';
                                html += '<ul style="list-style: none; margin-left: 0; margin-bottom: 0;">';
                                let unknowns = null;
                                for (let i = 0; i < geocacheLogsPerCountry['willAttend'].length; i++) {
                                    if(geocacheLogsPerCountry['willAttend'][i].flagPath === null) {
                                        unknowns = geocacheLogsPerCountry['willAttend'][i].count;
                                        continue;
                                    }
                                    html += '<li style="display: inline; padding-right: 20px;"><span style="display: inline-block;"><img src="' + pgcUrl + geocacheLogsPerCountry['willAttend'][i].flagPath + '" alt="' + $('<div/>').text(geocacheLogsPerCountry['willAttend'][i].country).html() + '" title="' + $('<div/>').text(geocacheLogsPerCountry['willAttend'][i].country).html() + '"> ' + geocacheLogsPerCountry['willAttend'][i].count + '</span></li>';
                                }
                                if(unknowns !== null) {
                                    html += '<li style="display: inline; padding-right: 20px;"><span style="display: inline-block;">(plus ' + unknowns + ' undetermined)</span></li>';
                                }
                                html += '</ul>';
                                html += '<span style="display: block; text-align: right; padding-right: 10px;"><small>' + geocacheLogsPerCountry['willAttend'].length + ' unique countries</small></span>';
                                html += '<span style="display: block; text-align: right; padding-right: 10px;"><small><a href="https://project-gc.com/Tools/EventStatistics?gccode=' + encodeURIComponent(gccode) + '">Event statistics</a></small></span>';
                            }

                            if(typeof(geocacheLogsPerCountry['found']) !== 'undefined' && geocacheLogsPerCountry['found'].length > 0) {
                                html += '<p style="margin-left: 10px; margin-bottom: 0;"><strong> ' + i18next.t('other.prcouuntry')+'</strong> <small>' + i18next.t('other.accord')+'</small></p>';
                                html += '<ul style="list-style: none; margin-left: 0; margin-bottom: 0;">';
                                let unknowns = null;
                                for (let i = 0; i < geocacheLogsPerCountry['found'].length; i++) {
                                    if(geocacheLogsPerCountry['found'][i].flagPath === null) {
                                        unknowns = geocacheLogsPerCountry['found'][i].count;
                                        continue;
                                    }
                                    html += '<li style="display: inline; padding-right: 20px;"><span style="display: inline-block;"><img src="' + pgcUrl + geocacheLogsPerCountry['found'][i].flagPath + '" alt="' + $('<div/>').text(geocacheLogsPerCountry['found'][i].country).html() + '" title="' + $('<div/>').text(geocacheLogsPerCountry['found'][i].country).html() + '"> ' + geocacheLogsPerCountry['found'][i].count + '</span></li>';
                                }
                                if(unknowns !== null) {
                                    html += '<li style="display: inline; padding-right: 20px;"><span style="display: inline-block;">(plus ' + unknowns + ' undetermined)</span></li>';
                                }
                                html += '</ul>';
                                html += '<span style="display: block; text-align: right; padding-right: 10px;"><small>' + geocacheLogsPerCountry['found'].length + ' ' + i18next.t('other.unique')+'</small></span>';
                            }

                            html += '</div>';

                            $('#ctl00_ContentBody_lblFindCounts').append(html);
                        }

                        // Add my number of logs above the log button
                        if (isSettingEnabled('addMyNumberOfLogs')) {
                            $('<p style="margin: 0;"><small>' + i18next.t('other.have')+' ' + myNumberOfLogs + ' ' + i18next.t('other.accordpgc')+'</small></p>').insertBefore('#ctl00_ContentBody_GeoNav_logButton');
                        }

                        // Append the same number to the added logbook link
                        if (isSettingEnabled('logbookLinks')) {
                            $('#pgc-logbook-yours').html('' + i18next.t('other.yours')+' (' + myNumberOfLogs + ')')

                        }
                    }


                    // Since everything in the logbook is ajax, we need to wait for the elements
                    // We also want to wait on challengeCheckerResults
                    waitForKeyElements('#cache_logs_table tbody tr', logbook);
                }

            });
        }

        // Add weekday of place date
        if (isSettingEnabled('showWeekday')) {
            const match = $('meta[name="description"]')[1].content.match(/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/);
            if (match) {
                const date = new Date(match[3], match[1]-1, match[2]);
                const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const text = $($('#ctl00_ContentBody_mcd2')[0].childNodes[0]).text();
                const pos = text.indexOf(':') + 2;
                let newText = text.substring(0, pos);
                newText += weekday[date.getDay()] + ', ';
                newText += text.substring(pos, text.length);
                const newNode = document.createTextNode(newText);
                $('#ctl00_ContentBody_mcd2')[0].replaceChild(newNode, $('#ctl00_ContentBody_mcd2')[0].childNodes[0]);
            }
        }

        // Tidy the web
        if (isSettingEnabled('tidy')) {
            $('#ctl00_divContentMain p.Clear').css('margin', '0');
            $('div.Note.PersonalCacheNote').css('margin', '0');
            $('h3.CacheDescriptionHeader').remove();
            $('#ctl00_ContentBody_EncryptionKey').remove();
            $('#ctl00_ContentBody_GeoNav_foundStatus').css('margin-bottom', '0');
        }

        // Make it easier to copy the gccode
        if (isSettingEnabled('makeCopyFriendly')) {
            const url = 'https://coord.info/' + encodeURIComponent(gccode);
            const clipboardSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').html(
                '<div style="margin-right: 15px; margin-bottom: 10px;">' +
                '<p style="font-size: 125%; margin-bottom: 0"><span id="ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoCode">' + gccode + '</span></p>' +
                '<div style="display: inline-flex; align-items: center; gap: 4px;">' +
                '<input id="coordInfoUrl" size="25" type="text" value="' + url + '" onclick="this.setSelectionRange(0, this.value.length);" readonly>' +
                '<button id="btnCopyCoordInfoUrl" type="button" title="Copy to clipboard" style="cursor:pointer; border:1px solid #ccc; background:#f5f5f5; border-radius:3px; padding:3px 6px; height: 40px; margin-bottom: 4px; display:inline-flex; align-items:center;">' + clipboardSVG + '</button>' +
                '</div>' +
                '</div>'
            );

            $('#btnCopyCoordInfoUrl').on('click', function (e) {
                e.preventDefault();
                navigator.clipboard.writeText(url).then(() => {
                    $(this).html('✓').css('color', 'green');
                    setTimeout(() => { $(this).html(clipboardSVG).css('color', ''); }, 1500);
                });
            });

            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').css('font-weight', 'inherit');
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div').css('margin', '0 0 5px 0');
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel div p').css('font-weight', 'bold');
        }

        // Add PGC Map links
        if (isSettingEnabled('addPgcMapLinks')) {
            coordinates = $('#ctl00_ContentBody_MapLinks_MapLinks li a').attr('href'),
                latitude = coordinates.replace(/.*lat=([^&]*)&lng=.*/, "$1"),
                longitude = coordinates.replace(/.*&lng=(.*)$/, "$1");
            // let mapUrl = pgcUrl + 'Maps/mapcompare/?profile_name=' + gccomUsername +
            //     '&nonefound=on&ownfound=on&location=' + latitude + ',' + longitude +
            //     '&max_distance=5&submit=Filter';
            const mapUrl = pgcUrl + '/LiveMap/#c=' + latitude + ',' + longitude + ';z=14';

            // $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
            //     '<div style="margin-bottom: 8px;"><a target="_blank" href="' + mapUrl + '">Project-GC map</a> (<a target="_blank" href="' + mapUrl + '&onefound=on">incl found</a>)</div>'
            // );
            $('#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoLinkPanel').append(
                '<div style="margin-bottom: 8px;"><a target="_blank" href="' + mapUrl + '">' + i18next.t('other.live')+'</a></div>'
            );
        }

        // Remove the UTM coordinates
        // $('#ctl00_ContentBody_CacheInformationTable div.LocationData div.span-9 p.NoBottomSpacing br').remove();
        if (isSettingEnabled('removeUTM')) {
            $('#ctl00_ContentBody_LocationSubPanel').html('');

            // And move the "N 248.3 km from your home location"
            $('#ctl00_ContentBody_LocationSubPanel').after($('#lblDistFromHome'));
        }

        // Remove ads
        // Project-GC shouldn't provide the option to hide ads
        // $('#ctl00_ContentBody_uxBanManWidget').remove();

        // Remove disclaimer
        if (isSettingEnabled('removeDisclaimer')) {
            $('#divContentMain div.span-17 div.Note.Disclaimer').remove();
        }

        // If the first log is a DNF, display a blue warning on top of the page
        // 2022-08-24, Issue #111, fixes display of blue text warning of last log is DNF.
        if ($('#cache_logs_table span.h4 img').attr('src') === '/images/logtypes/3.png') {
            const htmlFirstLogDnf = '<p style="color: #006cff;" class=" NoBottomSpacing"><strong>' + i18next.t('other.issue') + '</strong></p>\
                                   <ul style="color: #006cff;" class="">\
                                   <li>' + i18next.t('other.latest') + ' <a href="#cache_logs_table">' + i18next.t('other.please') + '</a> ' + i18next.t('other.before')+'</li>\
                                   </ul>';
            $('div.span-6.right.last').last().next().after(htmlFirstLogDnf);
        }

        // Collapse download links
        // http://www.w3schools.com/charsets/ref_utf_geometric.asp (x25BA, x25BC)
        if (isSettingEnabled('collapseDownloads')) {
            $('<p style="cursor: pointer; margin: 0;" id="DownloadLinksToggle" onclick="$(\'#divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow\').toggle();"><span class="arrow">&#x25BA;</span><span class="arrow open">&#x25BC;</span>' + i18next.t('other.print')+'</p>').insertBefore('#divContentMain div.DownloadLinks');
            $('#divContentMain div.DownloadLinks, #DownloadLinksToggle .arrow.open').hide();
        }

        // Resolve the coordinates into an address
        if (isSettingEnabled('addAddress')) {
            coordinates = $('#ctl00_ContentBody_MapLinks_MapLinks li a').attr('href'),
                latitude = coordinates.replace(/.*lat=([^&]*)&lng=.*/, "$1"),
                longitude = coordinates.replace(/.*&lng=(.*)$/, "$1"),
                url = 'https://nominatim.openstreetmap.org/reverse?lat=' + latitude + '&lon=' + longitude + '&format=json';

            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    const result = JSON.parse(response.responseText);
                    if (!result.display_name) {
                        return false;
                    }
                    let formattedAddress = result.address.road;
                    if (result.address.house_number) {
                        formattedAddress = formattedAddress + ' ' + result.address.house_number;
                    }
                    if (result.address.city) {
                        formattedAddress = formattedAddress + ', ' + result.address.city;
                    }
                    $('#ctl00_ContentBody_LocationSubPanel').append(formattedAddress + '<br />');
                }
            });
        }

        // Add number of finds per type to the top
        if (isSettingEnabled('cloneLogsPerType') && typeof $('#ctl00_ContentBody_lblFindCounts').html() !== 'undefined') {
            $('#ctl00_ContentBody_CacheInformationTable').before('<div>' + $('#ctl00_ContentBody_lblFindCounts').html() + '</div>');
        }

        // Add link to PGC gallery
        if (subscription && isSettingEnabled('addPgcGalleryLinks')) {
            const html = '<a href="' + pgcUrl + '/Tools/Gallery?filter_gc_val=' + gccode + '&submit=Filter"><img src="' + icons.galleryLink + '" title="' + i18next.t('other.gallery')+'"></a> ';
            $('.CacheDetailNavigation ul li:first').append(html);
        }

        // Add map links for each bookmarklist
        if (isSettingEnabled('addMapBookmarkListLinks')) {
            $('ul.BookmarkList li').each(function() {
                const bmlCode = $(this).children(':nth-child(1)').attr('href').replace(/.*\/lists\/(.*)/, "$1");
                const owner = $(this).children(':nth-child(3)').text();

                // Add the map link
                url = 'https://project-gc.com/Tools/MapBookmarklist?filters_pr_profileName=' + encodeURIComponent(pgcUsername) + '&filters_bml_ownerProfileName=' + encodeURIComponent(owner) + '&filters_bml_bmlReferenceCode=' + encodeURIComponent(bmlCode) + '&submit=Filter';
                $(this).children(':nth-child(1)').append('&nbsp;<a href="' + url + '"><img src="' + icons.mapLink + '" title="' + i18next.t('other.map')+'"></a>');

                // Add gallery link for the bookmark list
                url = 'https://project-gc.com/Tools/Gallery?filter_bml_ownerProfileName=' + encodeURIComponent(owner) + '&filter_bml_bmlReferenceCode=' + encodeURIComponent(bmlCode) + '&submit=Filter';
                $(this).children(':nth-child(1)').append('&nbsp;<a href="' + url + '"><img src="' + icons.galleryLink + '" title="' + i18next.t('other.gallery')+'"></a>');

                // Add profile stats link to the owner
                url = 'https://project-gc.com/ProfileStats/' + encodeURIComponent(owner);
                $(this).children(':nth-child(3)').append('&nbsp;<a href="' + url + '"><img src="' + icons.externalLink + '" title="' + i18next.t('other.prostats')+'"></a>');
            });
        }

        // Decrypt the hint
        if (isSettingEnabled('decryptHints') && $('#ctl00_ContentBody_lnkDH')[0].title === i18next.t('other.decrypt')) {
            $('#ctl00_ContentBody_lnkDH')[0].click();
        }

        // VGPS form
        if (isSettingEnabled('showVGPS')) {
            GM.xmlHttpRequest({
                method: "GET",
                url: pgcApiUrl + '/virtual-gps?gccode=' + gccode,
                headers: { 'X-App-ID': '10' },
                onload: function(response) {
                    const result = JSON.parse(response.responseText);
                    if (result.status.message !== 'ok') {
                        return;
                    }

                    let vgpsLists = result.data.lists,
                        selected = result.data.selected,
                        existsIn = result.data.existsIn,
                        selectedContent,
                        existsContent,
                        html = '<li style="border: 1px dashed lightgray;"><img width="16" height="16" src="https://project-gc.com/images/mobile_telephone_32.png"> <strong> ' + i18next.t('vpgs.send') + ' </strong><br />',
                        listId;

                    html += '<select id="comboVGPS" style="width: 164px; display: inline-block;">';
                    for (let k in vgpsLists) {
                        listId = vgpsLists[k].id;

                        selectedContent = '';
                        if (+selected === +listId) {
                            selectedContent = ' selected="selected"';
                        }

                        existsContent = '';
                        if (existsIn.indexOf(listId) > -1) {
                            existsContent = ' data-exists="true"';
                        }
                        html += '<option value="' + listId + '"' + selectedContent + existsContent + '>' + vgpsLists[k].name + '</option>';
                    }
                    html += '</select>';
                    html += '&nbsp;';
                    if (existsIn.indexOf(selected) === -1) {
                        html += '<input id="btnAddToVGPS" type="button" value="+">';
                        html += '<input id="btnRemoveFromVGPS" type="button" value="-" style="display: none;">';
                    }
                    else {
                        html += '<input id="btnAddToVGPS" type="button" value="+" style="display: none;">';
                        html += '<input id="btnRemoveFromVGPS" type="button" value="-">';
                    }
                    html += '</li>';

                    $('div.CacheDetailNavigation ul:first').append(html);

                    $('#comboVGPS').change(function() {
                        selected = +$(this).find(':selected').val();
                        if (existsIn.indexOf(selected) === -1) {
                            $('#btnAddToVGPS').css('display', '');
                            $('#btnRemoveFromVGPS').css('display', 'none');
                        }
                        else {
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

        // Change font in personal cache note to monospaced
        if (isSettingEnabled('geocacheNoteFont')) {
            $("#viewCacheNote,#cacheNoteText").css("font-family", "monospace").css("font-size", "12px");
            $("#viewCacheNote").on("DOMSubtreeModified", function() {
                $(".inplace_field").css("font-family", "monospace").css("font-size", "12px");
            });
        }


        if (isSettingEnabled('logbookLinks')) {
            // 2022-08-24, fixes #112: Extra single quote showing up in LogBookLinks near "Friends".
            $('\
                <span>&nbsp;|&nbsp;</span><a id="pgc-logbook-yours" href="' + $('#ctl00_ContentBody_uxLogbookLink').attr('href') + '#tabs-2">Yours</a>\
                <span>&nbsp;|&nbsp;</span><a href="' + $('#ctl00_ContentBody_uxLogbookLink').attr('href') + '#tabs-3">' + i18next.t("other.Friends")+'</a>\
                ').insertAfter( $('#ctl00_ContentBody_uxLogbookLink') );
        }
    }

    function router() {
        if (path.match(/^\/geocache\/.*/) !== null) {
            pageGeocachePage();
        }
        else if (path.match(/^\/seek\/cache_details\.aspx.*/) !== null) {
            pageGeocachePage();
        }
        else if (path.match(/^\/seek\/cache_logbook\.aspx.*/) !== null) {
            pageLogbook();
        }
        // else if (path.match(/^\/bookmarks\/.*/) !== null) {
        //    pageBookmarks();
        // }
        else if (path.match(/^\/map\/.*/) !== null) {
            pageMap();
        }
        else if(path.match(/^\/profile\/.*/) !== null) {
            pageProfile();
        }
        else if (path.match(/^\/account\/drafts/) !== null) {
            pageDrafts();
        }
        else if (path.match(/^\/account\/messagecenter/) !== null) {
            pageMessagecenter();
        }
        else if (path.match(/^\/seek\/cdpf\.aspx/) !== null) {
            pagePrintGeocachePage();
        }
    }

    function buildPGCUserMenu() {
        let loggedInContent, subscriptionContent = '';

        gccomUsername = false;
        if ($('.username')[0]) {
            gccomUsername = $('.username').html();
        }

        if (loggedIn === false) {
            loggedInContent = '<a href="' + pgcUrl + '/User/Login" target="_blank">' + i18next.t("header.not") + '</a>';
        }
        else {
            loggedInContent = '<a href="' + pgcUrl + '/ProfileStats/' + pgcUsername + '"><strong' + (pgcUsername !== gccomUsername ? ' style="color: red;"' : '') + '>' + pgcUsername + '</strong></a>';
            subscriptionContent = '<a href="https://project-gc.com/Home/Membership" target="_blank">' + (subscription ? i18next.t("header.Paid") : i18next.t("header.Missing")) + ' ' + i18next.t("header.membership") + '</a>';
        }

        GM.addStyle('\
            #pgc .player-profile, #pgc_gclh .li-user-info {width: auto;}\
            #pgc .player-profile:hover {text-decoration: none;}\
            #pgc .player-profile a:hover {text-decoration: underline;}\
            #pgc .player-profile a {text-decoration: none;color: white;}\
            #pgc_gclh img:hover {cursor:pointer;}\
            #pgc_gclh .draft-indicator {display: none;}\
            #pgcUserMenuForm > li:hover, #pgcUserMenuForm_gclh > li:hover { background-color: #e3dfc9; }\
            #pgcUserMenuForm > li, #pgcUserMenuForm_gclh > li { display: block; }\
            #pgcUserMenuForm input[type="checkbox"], #pgcUserMenuForm_gclh input[type="checkbox"] { opacity: inherit; width: inherit; height:inherit; overflow:inherit; position:inherit; }\
            #pgcUserMenuForm button, #pgcUserMenuForm_gclh button { display: inline-block !important; background: #ede5dc url(images/ui-bg_flat_100_ede5dc_40x100.png) 50% 50% repeat-x !important; border: 1px solid #cab6a3 !important; border-radius: 4px; color: #584528 !important; text-decoration: none; width: auto !important; font-size: 14px; padding: 4px 6px !important;}\
            #pgcUserMenuForm button:hover, #pgcUserMenuForm_gclh button:hover { background: #e4d8cb url(images/ui-bgflag_100_e4d8cb_40x100.png) 50% 50% repeat-x !important; }\
            #pgcUserMenu, #pgcUserMenu_gclh { right: 1rem;  }\
            #pgcUserMenu > form, #pgcUserMenu_gclh > form { background-color: white; color: #5f452a; }\
            .profile-panel .li-user-info {min-width: 160px;}\
        ');

        let settings = '<ul id="pgcUserMenu" class="dropdown-menu menu-user submenu" style="display:none; z-index: 1005;"><form id="pgcUserMenuForm" style="display: block; columns: 2; font-size: 14px; background-color: #fff !important;">';

        const items = getSettingsItems();
        for (let item in items) {
            const isChecked = isSettingEnabled(item) ? ' checked="checked"' : '';
            // Explicitly set the styles as some pages (i.e. https://www.geocaching.com/account/settings/profile) are missing the required css.
            settings += '<li style="margin: .2em 1em; white-space: nowrap; display: flex;"><label style="font-weight: inherit; margin-bottom: 0" for="' + item + '"><input type="checkbox" id="' + item + '" name="' + item + '"' + isChecked + ' >&nbsp;' + items[item].title + '</label>&nbsp;<small>(default: ' + items[item].default + ')</small></li>';
        }

        settings += '\
                <li style="margin: .2em 1em; background: 0;">\
                    <button onclick="document.getElementById(\'pgcUserMenuForm\').reset(); document.getElementById(\'pgcUserMenu\').style.display=\"none\"; return false;">' + i18next.t("menu.Cancel") + '</button>\
                    <button onclick="document.getElementById(\'pgcUserMenuForm\').reset(); return false;">' + i18next.t("menu.Reset") + '</button>\
                    <button id="pgcUserMenuSave">' + i18next.t("menu.Save") + '</button>\
                </li>\
                <li id="pgcUserMenuWarning" style="display: none; margin: .5em 1em; color: red; background: 0;"><a href="#" onclick="location.reload();" style="color: red; padding: 0; text-decoration: underline; display: inline;">' + i18next.t("menu.Reload") + '</a> ' + i18next.t("menu.activate") + '</li>\
            </form>\
        </ul>';

        const pgc = '<li id="pgc"><div class="player-profile flex items-center gap-2">' + $('#gc-header .player-profile').html() + '</div></li>';
        $('.user-menu').prepend(pgc);
        // Icon
        $('#pgc div').prepend('<a href="' + pgcUrl + '"></a>');
        $('#pgc img').attr('src', 'https://project-gc.com/favicon.ico');
        $('#pgc img').attr('style', 'border-radius:100%;');
        $('#pgc img').appendTo('#pgc a');
        // Username
        $('#pgc .username').html(loggedInContent);
        // Subscription
        $('#pgc .username + span').html(subscriptionContent);

        // Menu Toggle
        const button = $('.toggle-user-menu').last().parent().clone();
        $(button).find('button').attr('id', 'pgcUserMenuButton');
        $(button).attr('id', 'pgcButton');
        $(button).append(settings);
        // Add Toggle Button
        $('#pgc').after(button);

        $("#pgcUserMenuButton").click(function(e) {
            $('#pgcUserMenu').show();
            e.preventDefault();
        })
        $('body').click(function(e) {
            if (!$(e.target).parents('#pgcUserMenu')[0] && (!$(e.target).parents('#pgcButton')[0] && $("#pgcUserMenu").css('display') !== 'none')) {
                $("#pgcUserMenu").hide();
            }
        })

        $('#pgcUserMenuSave').click(function(e) {
            saveSettings(e);
        });

        // Workaround for users that also use the GClh
        function checkForGClh(waitCount) {
            if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0]) {
                const gclhPgc = '<li id="pgc_gclh" class="li-user"><div class="li-user-info">' + $($('.li-user')[0]).find('a').html() + '</div>'
                             + '<button id="pgcUserMenuButton_gclh" class="li-user-toggle dropdown">' + $($('.li-user')[0]).find('button').html() + '</button>'
                             + settings + '</li>';
                $('#ctl00_uxLoginStatus_divSignedIn').prepend(gclhPgc);
                // Icon
                $('#pgc_gclh img').attr('src', 'https://project-gc.com/favicon.ico');
                $('#pgc_gclh img').attr('style', 'border-radius:100%;');
                $('#pgc_gclh img')[0].onclick = function() {open(pgcUrl);};
                // User
                $('#pgc_gclh .user-name').html(loggedInContent);
                // Subscription
                $('#pgc_gclh .cache-count').html(subscriptionContent);


                // Rename the settings
                $('#pgc_gclh .dropdown-menu.menu-user').attr('id', 'pgcUserMenu_gclh');
                $('#pgc_gclh .dropdown-menu.menu-user form').attr('id', 'pgcUserMenuForm_gclh');
                $('#pgc_gclh .dropdown-menu.menu-user form li:nth-last-child(2) button:nth-last-child(1)').attr('id', 'pgcUserMenuSave_gclh');
                $('#pgc_gclh .dropdown-menu.menu-user form li:nth-last-child(1)').attr('id', 'pgcUserMenuWarning_gclh');

                $("#pgcUserMenuButton_gclh").click(function(e) {
                    e.preventDefault();
                    $('#pgcUserMenu_gclh').toggle();
                })

                $('#pgcUserMenuSave_gclh').click(function(e) {
                    saveSettings(e);
                });

            }
            else {
                waitCount++;
                if (waitCount <= 1000) {
                    setTimeout(function () {
                        checkForGClh(waitCount);
                    }, 10);
                }
            }
        }
        checkForGClh(0);
    }

    /**
     * Check that we are authenticated at Project-GC.com, and that it's with the same username
     */
    function checkPGCLogin() {
        GM.xmlHttpRequest({
            method: "GET",
            url: pgcApiUrl + '/user',
            headers: { 'X-App-ID': '10' },
            onload: function(response) {
                if (response.status === 401) {
                    loggedIn     = false;
                    subscription = false;
                    waitForHeader(0);
                    router();
                    return;
                }

                const result = JSON.parse(response.responseText);
                if (result.status.message !== 'ok') {
                    alert(response.responseText);
                    return;
                }

                pgcUsername  = result.data.name;
                imperialFlag = result.data.imperial;
                loggedIn     = true;
                subscription = result.data.pgcMembershipExpiresAt !== null &&
                    new Date(result.data.pgcMembershipExpiresAt) > new Date();
                _language    = result.data.locale;
                i18next.changeLanguage(_language);

                function waitForHeader(waitCount) {
                    if ($('.user-menu')[0]) {
                        buildPGCUserMenu();
                    }
                    else {
                        waitCount++;
                        if (waitCount <= 1000) {
                            setTimeout(function () {
                                waitForHeader(waitCount);
                            }, 10);
                        }
                    }
                }
                waitForHeader(0);
                router();
            },
            onerror: function(response) {
                alert(response);
            }
        });
    }

    function run() {
        readSettings();
        checkPGCLogin();
    }

    function loadTranslations() {
        return new Promise((resolve) => {
            i18next
                .use(i18nextXHRBackend)
                .use(i18nextBrowserLanguageDetector)
                .init({
                    supportedLngs: [
                        'ca_ES', 'cs_CZ', 'da_DK', 'de_DE', 'en_AU', 'en_CA', 'en_GB', 'en_US', 'es_ES', 'fi_FI',
                        'fr_FR', 'hu_HU', 'it_IT', 'ko_KR', 'lv_LV', 'nb_NO', 'nl_NL', 'pl_PL', 'pt_BR', 'pt_PT',
                        'sk_SK', 'sl_SI', 'sv_SE', 'tr_TR'
                    ],
                    whitelist: [
                        'ca_ES', 'cs_CZ', 'da_DK', 'de_DE', 'en_AU', 'en_CA', 'en_GB', 'en_US', 'es_ES', 'fi_FI',
                        'fr_FR', 'hu_HU', 'it_IT', 'ko_KR', 'lv_LV', 'nb_NO', 'nl_NL', 'pl_PL', 'pt_BR', 'pt_PT',
                        'sk_SK', 'sl_SI', 'sv_SE', 'tr_TR'
                    ],
                    fallbackLng: [ 'en_US' ],
                    'lng': navigator.language,
                    ns: ['userscript'],
                    defaultNS: ['userscript'],
                    backend: {
                        loadPath: pgcUrl + '/locale/{{ns}}.php?lng={{lng}}',
                        crossDomain: true
                    }
                }, (err) => {
                    if (err) {
                        if (err.indexOf('failed parsing') > -1 && err.indexOf('en_US') > -1) {
                            i18next.changeLanguage('en_US');
                            resolve(loadTranslations());
                            return;
                        }
                        console.log("Error occurred when loading language data", err);
                        resolve();
                        return;
                    }

                    resolve();
                });
        });
    }

    async function init() {
        await loadTranslations();
        run();
    }

    // Don't run the script for iframes
    if (window.top === window.self) {
        init();
    }
}());
