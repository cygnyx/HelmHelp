var map = null;
var log = null;
var maplet = null;
var controls = null;
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

function report(msg) {
    log.innerHTML += '<br />' + msg;
}

function errorreport(err) {
    report('No location information! ' + err.code + ' - ' + err.message);
}

var lastcoords = null;

function watchstarted(position) {
    lastcoords = position.coords;
    const ts = (new Date(Date.now())).toISOString();
    report('(' + lastcoords.latitude + ', ' + lastcoords.longitude + ', ' + lastcoords.accuracy + ') at ' + ts);
}

function showlog () {
    console.log('showlow');
}

function toggletracking () {
    var e = controls._container.firstChild.firstChild;
    
    if (L.DomUtil.hasClass(e, 'fa-play')) {
	L.DomUtil.removeClass(e, 'fa-play');
	L.DomUtil.addClass(e, 'fa-stop');
	tracker = navigator.geolocation.watchPosition(watchstarted, errorreport, trackOptions);
    } else if (navigator.geolocation) {
	L.DomUtil.removeClass(e, 'fa-stop');
	L.DomUtil.addClass(e, 'fa-play');
	if (tracker) {
	    navigator.geolocation.clearWatch(tracker);
	    tracker = null;
	}
    }
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


    L.Control.Controls = L.Control.extend({
	options: { position: 'topleft' },
	onAdd: function (map) {
	    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button;

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', function(){ toggletracking(); });
	    L.DomUtil.create('i', 'fa fa-play', button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', function(){ showlog(); });
	    L.DomUtil.create('i', "fa fa-bars", button);


	    // play stop bars flag anchor filter list tag info leaf ship wrench repeat road crosshairs map-pin
	    // hourglass hourglass-end
            return container;
	},
	onRemove: function(map) {},
    });

    controls = new L.Control.Controls();
    controls.addTo(maplet);
}
