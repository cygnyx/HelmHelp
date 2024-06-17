const map = document.getElementById("map");
const CENTER_LAT_LNG = [37.866473, -122.317745];
const HIGH_ACCURACY = true;
const LOW_ACCURACY = false;
const MAX_CACHE_AGE_MILLISECOND = 10000;
const MAX_NEW_POSITION_MILLISECOND = 1000;

var maplet = null;
var path = null;
var currentMarker = null;

const trackOptions = {
  enableHighAccuracy: HIGH_ACCURACY,
  maximumAge: MAX_CACHE_AGE_MILLISECOND,
  timeout: MAX_NEW_POSITION_MILLISECOND,
};


function onload() {
    maplet = L.map("map").setView(CENTER_LAT_LNG, 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(maplet);
}
