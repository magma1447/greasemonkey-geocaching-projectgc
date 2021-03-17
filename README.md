# greasemonkey-geocaching-projectgc

Adds links and data to Geocaching.com to make it collaborate with Project-GC.com.
Some (most) features are for paying members at Project-GC only.

## Compatibility
* Requires Greasemonkey to run in Firefox.
* Requires Tampermonkey to run in Chrome.

## Existing features
* Add to/remove from VGPS form.
* Adds Favorite points (FP/FP%/FPW).
* Adds challenge checker links if a checker exists at Project-GC.
* Adds address for the coordinates (Google reverse geocoding).
* Clones number of logs per type to the top.
* Add a "latest logs" to the top.
* Add links to Profile stats for cache owner.
* Add links to Profile stats for every profile in the logbooks.
* Adds a copy friendly link to the geocache page, and copy friendly gccode.
* Adds link to Project-GC gallery.
* Minor adjustments to tidy the web.
  * Remove rot13 decrypt widget.
  * Remove "Description" text.
  * Change some spacings.
* Adds country/region/county data from Project-GC.
* Show the real cache owner name after the "placed by".
* Add links to PGC profile gallery for each name in the logbook.
* Add links to gallery from bookmark lists, from geocache pages.
* Add links to plot bookmark lists on maps, from geocache pages.
* Add links to Profile stats for bookmark list owners, from geocache pages.
* Autodecrypt hints.
* Add meters/feet above mean sea level.
* Add warning if the latest log is a DNF.
* Show exif location data for images in Gallery and Logbook.
* Adds button to map bookmark lists.
* Remove open in new tab from Drafts.
* Found/Will attend/Attended per country.
* Monospace font for personal cache notes.
* Minor tweaks on Print cache page.
* Hide up-vote buttons from logs.

## Open source libraries used
Exif parsing solved with a fork of https://github.com/exif-js/exif-js

## License
The client side script (this script) is MIT licensed (license file commited in repository). However, the server side API is property of Ground Zero Communications AB.

## Credits
* Idea and initial work: Jonas "lillfiluren" Högström.
* Cleanup and actually make things work properly (cross browser compatible): "Surfoo".
* Other contributors, https://github.com/magma1447/greasemonkey-geocaching-projectgc/graphs/contributors
