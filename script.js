var map = null;
var log = null;

var raceseries = null;
var racecourse = null;
var racecoursedetails = {};

var routes = null;
var waypoints = null;

var maplet = null;
var mapcenter = null;

var controls = null;
var msg = null;
var tracker = null;

const CENTER_LAT_LNG = [37.866473, -122.317745];
const HIGH_ACCURACY = true;

const MAX_NEW_POSITION_MILLISECOND = 1*1000;
const MAX_CACHE_AGE_MILLISECOND = 20*MAX_NEW_POSITION_MILLISECOND;

const MAPTILE_SERVER = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAPTILE_CR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
//const MAPTILE_SERVER = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
//const MAPTILE_CR = '&copy; <a href="https://map.openseamap.org/legend.php?lang=en&page=license">OpenSeaMap</a>'

const starttimes = [
    "Now",
    "+1 minute",
    "+5 minutes",
    "+10 minutes",
    "@ :00",
    "@ :05",
    "@ :10",
    "@ :15",
    "@ :20",
    "@ :25",
    "@ :30",
    "@ :35",
    "@ :40",
    "@ :45",
    "@ :50",
    "@ :55"
];


const trackOptions = {
  enableHighAccuracy: HIGH_ACCURACY,
  maximumAge: MAX_CACHE_AGE_MILLISECOND,
  timeout: MAX_NEW_POSITION_MILLISECOND
};

var racestart = null;
var racestarttimer = null;
var racestarttimerlast = null;
var racestartword = 0;

function racestartcountdown() {
    const dt = new Date();
    const secs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60];
    const maxsec = secs[secs.length - 1];

    if (racestarttimerlast) {
	const racetim = racestart.getTime();
	const lastsec = Math.trunc((racetim - racestarttimerlast.getTime())/1000);
	const currsec = Math.trunc((racetim - dt.getTime())/1000);
	if (currsec > maxsec)
	    return;
	if (currsec <= 0) {
	    playaudio('starttone');
	    clearInterval(racestarttimer);
	    racestarttimer = null;
	    racestarttimerlast = null;
	    racestartword = 0;
	    return;
	}
	var a;
	for (var i in secs) {
	    var s = secs[i];
	    if (lastsec > s && currsec <= s) {
		report('racestart in ' + s + ' seconds');
		if (racestartword == 0) {
		    playaudio('start', 'in')
		    racestartword = 1;
		}
		playaudio('' + s);
		if (s > 10)
		    playaudio("seconds");
		break;
	    }
	}
    }
    racestarttimerlast = dt;
}

function setstart(sname) {
    var dt = new Date();
    var gt = dt.getTime();
    var hh;
    var mm;
    var mmc;
    var t;

    if (sname == 'Not Set') {racestart = null; return; }

    idx = starttimes.indexOf(sname);
    switch(idx) {
    case 0: t = gt; break;
    case 1: t = gt + 60000; break;
    case 2: t = gt + 60000 * 5; break;
    case 3: t = gt + 60000 * 10; break;
    default:
	dt.setSeconds(0);
	mm = (idx - 4) * 5;
	if (mm < 0) mm = 0;
	else if (mm > 59) mm = 59
	mmc = dt.getMinutes();
	if (mm < mmc)
	    dt.setHours(dt.getHours() + 1);
	dt.setMinutes(mm);
	t = dt.getTime();
	break;
    }
    racestart = new Date(t);
    hh = racestart.getHours();
    if (hh > 12)
	hh -= 12;
    mm = racestart.getMinutes();
    playaudio("start", "at");
    playint(hh);
    if (mm > 0) {
	if (mm < 10) {
	    playaudio('o');
	    playaudio('' + mm);
	} else if (mm < 20) {
	    playaudio('' + mm);
	} else {
	    mm = '' + mm;
	    playaudio(mm[0] + '0');
	    if (mm[1] != '0')
		playaudio(mm[1]);
	}
    }
    report('racestarttime: ' + racestart);
    racestarttimer = setInterval(racestartcountdown, 1000);
}

function setwidth(id, width) {
    document.getElementById(id).style.width = width;
}

function hide(id, p) {
    var e = document.getElementById(id);
    if (e) {
	if (p) {
	    L.DomUtil.addClass(e, 'hide');
	    L.DomUtil.removeClass(e, 'show');
	} else {
	    L.DomUtil.addClass(e, 'show');
	    L.DomUtil.removeClass(e, 'hide');
	}
    }
}

function closeoverlay () {
    setwidth("overlay", "0%");
    hide("cfg", true);
    hide("log", true);
}

function report(message) {
    log.innerHTML += '<br />' + message;
    msg.innerHTML = message;
}

function errorreport(err) {
    report('No location information! ' + err.code + ' - ' + err.message);
    stoptracking();
}

var lastcoords = null;
var lasttime = null;

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
    if (lasttime == position.timestamp)
	return;

    lastcoords = position.coords;
    lat = lastcoords.latitude;
    lon = lastcoords.longitude;
    lasttime = position.timestamp;
    
    var e = new CustomEvent("GEO_EVENT", {
	detail: {
	    'latitude': lat,
	    'longitude': lon,
	    'time': lasttime
	},
	bubbles: true,
	cancelable: true,
	composed: false,
    });
    document.querySelector("#map").dispatchEvent(e);
}

function roundinggetmarks(rounding) {
    var typ = rounding.substring(0, 1);
    var mrk = rounding.substring(2);
    var a;
    var marks;
    if (typ == 'l') {
	if (mrk in routes.lines) {
	    a = routes.lines[mrk];
	    marks = [a[0], a[1]];
	}
    } else if (typ == 'p' || typ == 's') {
	marks = [mrk];
    } else
	marks = [];
    return marks;
}

function mapracecourse() {
    var minlat, maxlat;
    var minlon, maxlon;
    var marks = {};
    var ftime = true;
    var maplbl = [];
    
    if (racecourse) {
	racecourse.forEach(function (rounding) {
	    var a = roundinggetmarks(rounding);
	    if (a)
		a.forEach(function(e) {marks[e]=0;});
	});
    }
    marks = Object.keys(marks).sort();

    marks.forEach(function(mark) {
	var m, newlat, newlon, ml;
	if (mark in routes.waypoints.overrides)
	    m = routes.waypoints.overrides[mark];
	else if (mark in waypoints)
	    m = waypoints[mark];
	else
	    m = null;
	ml = null;
	if (m) {
	    newlat = m[0];
	    newlon = m[1];
	    ml = L.circle([newlat, newlon], {
		color: '#f00',
		fillColor: '#f00',
		fillOpacity: 0.5,
		radius: 15
	    }).bindPopup(m[2]);
	    if (ftime) {
		minlat = maxlat = newlat;
		minlon = maxlon = newlon;
		ftime = false;
	    } else {
		if (minlat > newlat)
		    minlat = newlat;
		else if (maxlat < newlat)
		    maxlat = newlat;
		if (minlon > newlon)
		    minlon = newlon;
		else if (maxlon < newlon)
		    maxlon = newlon;
	    }
	}
	maplbl.push(ml);
    });

    racecoursedetails = {
	'marks': marks,
	'labels': maplbl,
	'minlat': minlat,
	'maxlat': maxlat,
	'minlon': minlon,
	'maxlon': maxlon
    };
}

function showlog () {
    setwidth("overlay", "100%");
    hide("log", false);
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

var marks = {};

function setmark(name) {
    marks[name] = lastcoords;
}

function markpin() {
    setmark('Pin');
    playaudio('pin', 'set')
}

function markrc() {
    setmark('RC');
    playaudio('RC', 'set')
}

// https://stackoverflow.com/questions/38560764/how-to-play-many-audio-files-in-sequence

// https://audiomass.co/

var audiotodo = [];
var audioplaying = null;
//var audiowhen = null;

function playbearing(f) {
    n = Math.round(f);
    playaudio('bearing');
    playint(n);
}

function playspeed(f) {
    playfloat(f);
    playaudio('knots');
}

function playfloat(f) {
    if (f < 0) {
	playaudio('negative');
	f = -f;
    }
    n = Math.trunc(f);
    playint(n);
    f -= n;
    f *= 10;
    n = Math.round(f);
    if (n > 0) {
	playaudio('point');
	playint(n);
    }
}

function playint(n) {
    var s;
    var b = false;

    if (n < 0) {
	playaudio("negative");
	n = -n;
    }

    s = '' + n;
    while (s.length > 2) {
	playaudio(s[0]);
	s = s.substr(1);
	b = true;
    }

    n = n % 100;
    r = n % 10;
    if (n == 0) {
	if (b)
	    playaudio('o', 'o');
	else
	    playaudio('0');
    } else if (n < 10 && b) {
	playaudio('o', s[1]);
    } else if (n <= 20 || r == 0)
	playaudio('' + n);
    else {
	playaudio(s[0]+'0', s[1]);
    }
}

function audioended() {
    var a;
//    report('audioended:  starting with ' + audiowhen);

    if (audiotodo.length > 0) {
	audioplaying = audiotodo.shift();
//	audiowhen = new Date().getTime() + 2000;
	//	report('audioended: playing next audio ' + audioplaying);
//	var dt = (new Date()).getTime();
	audioplaying.play();
//	var e = (new Date()).getTime();
//	console.log('milliseconds to play ' + (e - dt))
    } else {
//	report('audioended: no more audio');
	audioplaying = null;
//	audiowhen = null;
    }
//    report('audioended: finishing with ' + audiowhen);
}

function playaudio() {
    var p;

//    if (audiowhen) {
//	if ((new Date()).getTime() > audiowhen) {
//	    audiowhen = null;
//	    audioplaying = null;
//	    audiotodo = [];
//	    report("playaudio: audio timeout, resetting");
//	}
//    }

    for (var i = 0; i < arguments.length; i++) {
	p = arguments[i];
	a = new Audio('audio/' + p + '.mp3');
	a.onended = audioended;
	audiotodo.push(a);
    }

    if (!audioplaying)
	audioended();
}

function showcfg() {
    setwidth("overlay", "100%");
    hide("cfg", false);
}

function setseries(sname) {
    if (sname == 'Not Set') {
	raceseries = null;
	localStorage.removeItem("raceseries");
    } else {
	raceseries = sname;
	localStorage.setItem("raceseries", sname);
    }
    setconfcourse();
}

// https://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-comma-in-data
function splitcsv(csv) {
        var matches = csv.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
        for (var n = 0; n < matches.length; ++n) {
            matches[n] = matches[n].trim();
            if (matches[n] == ',') matches[n] = '';
        }
        if (csv[0] == ',') matches.unshift("");
        return matches;
}

function loadcachedwaypoints(csv) {
    a = {};
    s = 0
    csv.split(/\r?\n/).forEach(function (line) {
	if (line.length > 0 && s == 1) {
	    i = splitcsv(line);
	    j = []
	    i.forEach(function(n){
		m = n.length;
		if ((n[0] == '"' && n[m-1] == '"') ||
		    (n[0] == "'" && n[m-1] == "'"))
		    n = n.substring(1,m-1);
		j.push(n);
	    });
	    a[j[2]] = [parseFloat(j[0]), parseFloat(j[1]), j[3]];
	}
	s = 1
    });
    waypoints = a;
}

function loadcachedroutes(json) {
    routes = JSON.parse(json);
    for (const [n, v] of Object.entries(routes.waypoints.urls))
	cachefile(v, loadcachedwaypoints);
}

function getElementValue(parent, tag) {
    const e = parent.querySelector(tag);
    if (!e)
	return "";
    if (e.innerHTML != undefined)
	return e.innerHTML;
    const t = e.childNodes[0].textContent;
    if (!t)
	return null
    return t;
}

// https://github.com/We-Gold/gpxjs/blob/main/lib/parse.ts

function loadcachedgpxtrack(gpxstring) {
    const domParser = new window.DOMParser()
    const gpxtrack = domParser.parseFromString(gpxstring, "text/xml")
    const tracks = Array.from(gpxtrack.querySelectorAll("trk"))
    path = [];
    for (const te of tracks) {
	const trksegs = Array.from(gpxtrack.querySelectorAll("trkseg"));
	for (const tse of trksegs) {
	    const trkpts = Array.from(tse.querySelectorAll("trkpt"));
	    for (const tp of trkpts) {
		const lat = parseFloat(tp.getAttribute("lat"));
		const lon = parseFloat(tp.getAttribute("lon"));
		const ele = parseFloat(getElementValue(tp, "ele"));
		const tim = getElementValue(tp, "time");
		const tm = (new Date(tim)).getTime();
		path.push([lat, lon, tm, 0., 0., 0.]);
	    }
	}
    }
    for (var idx = 1; idx < path.length-1; idx++)
	calcpath(idx);

    for (var idx = 1; idx < path.length-1; idx++)
	drawline(idx);

    //polygroup.redraw();

}

function cacheclear() {
    localStorage.clear();
}

async function cachefile(url, procfunc, init = null) {
    if (!url || url == "")
	return;
    txt = localStorage.getItem(url);
    if (txt === null) {
	var r = await fetch(url, init);
	txt = await r.text();
	if (txt.length > 0) {
	    localStorage.setItem(url, txt);
	    procfunc(txt);
	}
    } else {
	procfunc(txt);
    }
}

function loadroutes() {
    var url = document.getElementById("routesurl").value;
    localStorage.setItem("routesurl", url);
    return new Promise(function (resolve) {
	cachefile(url, loadcachedroutes);
	setconfseries();
	return resolve();
    });
}

function loadwaypoints() {
    var url = document.getElementById("waypointsurl").value;
    localStorage.setItem("waypointsurl", url);
    cachefile(url, loadcachedwaypoints);
}

function loadgpxtrack() {
    var url = document.getElementById("gpxtrackurl").value;

    return new Promise(function (resolve) {
	localStorage.setItem("gpxtrackurl", url);
	cachefile(url, loadcachedgpxtrack);
	return resolve();
    });
}

function setvalue(id) {
    var txt = localStorage.getItem(id);
    if (txt)
	document.getElementById(id).value = txt;
    return txt ? true : false;
}

function setconftimes() {
    const e = document.getElementById("racestarttimes");
    var h = "'<option>Not Set</option>'"
    for (const s of starttimes)
	h += '<option>'+s+'</option>';
    e.innerHTML = h;
}

function setconfseries() {
    const e = document.getElementById("raceseries");
    var h = "'<option>Not Set</option>'"
    if (routes) {
	sl = Object.keys(routes.series).sort();
	for (const s of sl)
	    if (s != "help") {
		if (e.value == s)
		    h += '<option selected>'+s+'</option>';
		else
		    h += '<option>'+s+'</option>';
	    }
    }
    e.innerHTML = h;
}

function setcourse(sname) {
    if (racecourse) {
	racecourse = null;
	if (racecoursedetails) {
	    if ('mapped' in racecoursedetails) {
		var l = racecoursedetails['mapped'];
		for (const e of l) {
		    maplet.removeLayer(e);
		}
	    }
	    racecoursedetails = null;
	}
    }
    if (sname == 'Not Set') {
	localStorage.removeItem("racecourse");
    } else {
	racecourse = routes.series[raceseries][sname];
	localStorage.setItem("racecourse", sname);
	mapracecourse();
	mapracemarks();
    }
    if (mapcenter) {
	mapcenter = midmap();
	maplet.panTo(mapcenter);
    }
}

function mapracemarks() {
    if (!racecourse)
	return;
    var m = [];
    racecoursedetails['labels'].forEach(function (e) {
	e.addTo(maplet);
	m.push(e);
    });
    racecoursedetails['mapped'] = m;
}

function setconfcourse() {
    const e = document.getElementById("racecourse");
    var h;
    if (e.value)
	h = "'<option>Not Set</option>'"
    else
	h = "'<option selected>Not Set</option>'"

    var reg = /^\d+$/;

    if (raceseries) {
	cl = Object.keys(routes.series[raceseries]);
	n = true
	for (const s of cl)
	    if (reg.test(s) == false) {
		n = false;
		break;
	    }
	if (n)
	    cl = cl.sort(function(a, b) {return a-b;});
	else
	    cl = cl.sort();
	for (const s of cl) {
	    if (e.value == s)
		h += '<option selected>'+s+'</option>';
	    else
		h += '<option>'+s+'</option>';
	}
    }
    e.innerHTML = h;
}

function updatemap(event) {
    var d = event.detail;
    drawnewsegment([d.latitude, d.longitude, d.time]);
}

function nmb(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) return [0., 0.];

    const torad = Math.PI / 180.;
    const todeg = 180. / Math.PI;
    const radlat1 = lat1 * torad;
    const radlat2 = lat2 * torad;
    const radtheta = (lon2 - lon1) * torad;

    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1)
        dist = 1;
    dist = Math.acos(dist) * todeg * 60 // 1 nmile = 1 minute
    //console.log('dist: ' + dist);
    
    const y = Math.sin(radtheta) * Math.cos(radlat2);
    const x = Math.cos(radlat1) * Math.sin(radlat2) -
          Math.sin(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    const brng = Math.atan2(y, x) * todeg;
    //console.log('brng: ' + brng);

    return [dist, (brng + 360) % 360];
}

var path = []; // lat, lon, time, meters from prior, knots, bearing

function calcpath(idx) {

    const tom = 1852;

    const c = path[idx];
    const p = path[idx-1];
    const n = path[idx+1];

    //console.log('idx: ' + idx);
    //console.log('c: ' + c);
    //console.log('p: ' + p);
    //console.log('n: ' + n);
    
    var plat = p[0], plon = p[1], ptim = p[2];
    var clat = c[0], clon = c[1], ctim = c[2];
    var nlat = n[0], nlon = n[1], ntim = n[2];

    var xp = nmb(plat, plon, clat, clon);
    var xc = nmb(clat, clon, nlat, nlon);
    var xn = nmb(plat, plon, nlat, nlon);

    var dpc = xp[0], bpc = xp[1];
    var dcn = xc[0], bcn = xc[1];
    var dpn = xn[0], bpn = xn[1];

    //console.log('ctim: ' + ctim);
    //console.log('ptim: ' + ptim);
    //console.log('ntim: ' + ntim);

    //console.log('dpc: ' + dpc);
    //console.log('dcn: ' + dcn);

    var kpc = 1000 * 60 * 60 * dpc / (ctim - ptim); // nm/h
    var kcn = 1000 * 60 * 60 * dcn / (ntim - ctim);

    //console.log('kpc: ' + kpc);
    //console.log('kcn: ' + kcn);

    var k = (kcn + kpc) / 2;

    path[idx] = [c[0], c[1], c[2], dpc * tom, k, bpn];
    //console.log(path[idx]);

    if (idx == 1)
	path[idx] = [p[0], p[1], p[2], dpc * tom, k, bpn];
}



var lastline = null;
var lastspeed = null;
var polygroup = null;

function drawline(idx) {
    var old = true;
    const c = path[idx];
    const lat = c[0];
    const lon = c[1];
    const dis = c[3];
    const knt = c[4];
    const clr = ['#00ff000', '#99ff00', '#eeff00', '#ffff00', '#ffbb00', '#ffee00', '#ffcc00', '#ff9900', '#ff0000'];
    const cl = clr.length;
    var k = Math.trunc(knt);
    var pts = [[lat, lon]];

    if (k >= cl)
	k = cl - 1;
    
    if ((lastline == null) || (lastspeed == null)) {
	old = false;
    } else {
	if (k != lastspeed) {
	    old = false;
	}
    }

    if (lastline) {
	lastline._latlngs.push(pts[0]);
	if (old)
	    return;
	//lastline.redraw();
    }

    lastline = L.polyline(pts, {
	color: clr[k],
	bubblingMouseEvents: true
    });

    polygroup.addLayer(lastline);
    maplet.setView([lat, lon], 15);
    //maplet.fitBounds(lastline.getBounds());
    
    lastspeed = k;
}

function drawnewsegment(detail) {
    return new Promise(function (resolve) {
	path.push([detail[0], detail[1], detail[2], 0.0, 0.0, 0.0]);
	if (path.length > 2) {
	    calcpath(path.length-2);
	    drawline(path.length-2);
	    //polygroup.redraw();
	}
	return resolve(detail);
    });
}

function onload() {
    map = document.getElementById("map");
    log = document.getElementById("log");

    maplet = L.map("map");
    maplet.setView(CENTER_LAT_LNG, 13);
    polygroup = L.featureGroup().addTo(maplet);

    map.addEventListener("GEO_EVENT", updatemap);

    L.tileLayer(MAPTILE_SERVER, {
	maxZoom: 19,
	attribution: MAPTILE_CR
    }).addTo(maplet);


    L.Control.Textbox = L.Control.extend({
	options: { position: 'bottomleft' },
	onAdd: function (map) {
	    var container = L.DomUtil.create('div', 'leaflet-control');
	    container.id = 'msg';
	    container.innerHTML = 'Initialized';
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
            L.DomEvent.on(button, 'click', showcfg);
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

    if (setvalue("routesurl")) {
	loadroutes();
	if (setvalue("raceseries")) {
	    setseries(document.getElementById("raceseries").value);
	    if (setvalue("racecourse")) {
		setcourse(document.getElementById("racecourse").value);
	    }
	}
    }
    setvalue("waypointsurl");
    setconftimes();
    setconfseries();
    setconfcourse();
}
