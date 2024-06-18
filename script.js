var map = null;
var log = null;

var maplet = null;
var controls = null;
var msg = null;
var tracker = null;

const CENTER_LAT_LNG = [37.866473, -122.317745];
const HIGH_ACCURACY = true;
const LOW_ACCURACY = false;
const MAX_CACHE_AGE_MILLISECOND = 10*1000;
const MAX_NEW_POSITION_MILLISECOND = 5*1000;
const MAPTILE_SERVER = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAPTILE_CR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
//const MAPTILE_SERVER = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
//const MAPTILE_CR = '&copy; <a href="https://map.openseamap.org/legend.php?lang=en&page=license">OpenSeaMap</a>'


const trackOptions = {
  enableHighAccuracy: HIGH_ACCURACY,
  maximumAge: MAX_CACHE_AGE_MILLISECOND,
  timeout: MAX_NEW_POSITION_MILLISECOND,
};

function report(message) {
    log.innerHTML += '<br />' + message;
    msg.innerHTML = message;
}

function errorreport(err) {
    report('No location information! ' + err.code + ' - ' + err.message);
    stoptracking();
}

var lastcoords = null;

function llfmt(c) {
    if (c.latitude >= 0.0) {
	lat = c.latitude.toFixed(6);
	if (c.latitude < 10.0) sgn = "+0";
	else sgn = "+";
    } else {
	lat = (-c.latitude).toFixed(6);
	if (c.latitude < -10.0) sgn = "-";
	else sgn = "-0";
    }
    lat = sgn + lat;

    if (c.longitude >= 0.0) {
	lon = c.longitude.toFixed(6);
	if (c.longitude < 10.0) sgn = "+00";
	else if (c.longitude < 100.0) sgn = "+0";
	else sgn = "+";
    } else {
	lon = (-c.longitude).toFixed(6);
	if (c.longitude < -100.0) sgn = "-";
	else if (c.longitude < -10.0) sgn = "-0";
	else sgn = "-00";
    }
    lon = sgn + lon;

    return lat + ", " + lon;
}

function positionupdate(position) {
    lastcoords = position.coords;
    const ts = (new Date(Date.now())).toLocaleTimeString().trim();
    const a = ts.split(' ');
    report('(' + llfmt(lastcoords) + ', ' + lastcoords.accuracy.toFixed(0) + ') at ' + a[0]);
}

function showlog () {
    console.log('showlow');
}

function stoptracking () {
    var e = controls._container.firstChild.firstChild;
    L.DomUtil.removeClass(e, 'fa-stop');
    L.DomUtil.addClass(e, 'fa-play');
    if (tracker) {
	navigator.geolocation.clearWatch(tracker);
	tracker = null;
    }
}

function toggletracking () {
    var e = controls._container.firstChild.firstChild;
    
    if (L.DomUtil.hasClass(e, 'fa-play') && navigator.geolocation) {
	L.DomUtil.removeClass(e, 'fa-play');
	L.DomUtil.addClass(e, 'fa-stop');
	tracker = navigator.geolocation.watchPosition(positionupdate, errorreport, trackOptions);
    } else {
	stoptracking();
    }

}

function markpin() {
    console.log('markpin');
}

function markrc() {
    console.log('markrc');
}

function showracestart() {
    console.log('showracestart');
}

function showconfig() {
    console.log('showconfig');
}

function onload() {
    map = document.getElementById("map");
    log = document.getElementById("log");

    maplet = L.map("map");
    maplet.setView(CENTER_LAT_LNG, 13);

    L.tileLayer(MAPTILE_SERVER, {
	maxZoom: 19,
	attribution: MAPTILE_CR
    }).addTo(maplet);


    L.Control.Textbox = L.Control.extend({
	options: { position: 'bottomleft' },
	onAdd: function (map) {
	    var container = L.DomUtil.create('div', 'leaflet-bar');
	    container.id = 'msg';
	    container.innerHTML = 'Initializing';
	    return container;
	},
	onRemove: function(map) {}
    })

    var tb = new L.Control.Textbox();
    tb.addTo(maplet);
    msg = document.getElementById("msg");

    L.Control.Controls = L.Control.extend({
	options: { position: 'topleft' },
	onAdd: function (map) {
	    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button;

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', toggletracking);
	    L.DomUtil.create('i', 'fa fa-play', button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', showlog);
	    L.DomUtil.create('i', "fa fa-bars", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', markrc);
	    L.DomUtil.create('i', "fa fa-ship", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', markpin);
	    L.DomUtil.create('i', "fa fa-map-pin", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', showracestart);
	    L.DomUtil.create('i', "fa fa-hourglass", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', showconfig);
	    L.DomUtil.create('i', "fa fa-gear", button);

	    // play stop map-pin ship
	    // bars flag anchor filter list tag info leaf wrench repeat road crosshairs
	    // hourglass hourglass-end
            return container;
	},
	onRemove: function(map) {}
    });

    controls = new L.Control.Controls();
    controls.addTo(maplet);
}
