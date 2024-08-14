// Helm Help
// fix tack when pointing north

var map = null;
var log = null;

var raceseries = null;
var racecourse = null;
var racecoursedetails = {};

var routes = null;
var waypoints = null;

var maplet = null;

var controls = null;
var msg = null;
var popbox = null;
var tracker = null;

const CENTER_LAT_LNG = [37.866473, -122.317745];
const HIGH_ACCURACY = true;

const MAX_NEW_POSITION_MILLISECOND = 1*1000;
const MAX_CACHE_AGE_MILLISECOND = 20*MAX_NEW_POSITION_MILLISECOND;

const MAPTILE_SERVER = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAPTILE_CR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

class Bearing {

    constructor (angle) {
	this.direction = angle < 0 ? 360 - (-angle % 360) : angle % 360;
    }

    angleTo(bearing) {
	return this.distancefromto(this.direction, bearing.direction)
    };

    angleFrom(bearing) {
	return -this.distancefromto(this.direction, bearing.direction);
    }

    static distancefromto(a, b) {
	var d = b - a;
	if (d > 180) d -= 360;
	else if (d < -180) d += 360;
	return d;
    }

    compasspoint(rose) {
	return rose[Math.round(this.direction * rose.length / 360) % rose.length];
    }

    compass8() {
	return this.compasspoint(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    }
    
    compass16() {
	return this.compasspoint([
	    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
	]);
    }
    
    compass32() {
	return this.compasspoint([
	    "N", "NbE", "NNE", "NEbN", "NE", "NEbE", "ENE", "EbN",
	    "E", "EbS", "ESE", "SEbE", "SE", "SEbS", "SSE", "SbE",
	    "S", "SbW", "SSW", "SWbS", "SW", "SWbW", "WSW", "WbS",
	    "W", "WbN", "WNW", "NWbW", "NW", "NWbN", "NNW", "NbW"
	]);
    }
    
    compass(points, type) {
	var c;
	points = points || 16;
	type = type || "short";
	if (points <= 8) c = this.compass8();
	else if (points <= 16) c = this.compass16();
	else c = this.compass32();
	if (type == "short")
	    return c;
	var w = [];
	for (var i = 0; i < c.length; i++)
	    switch(c[i]) {
	    case 'N': w.push('north'); break;
	    case 'E': w.push('east'); break;
	    case 'S': w.push('south'); break;
	    case 'W': w.push('west'); break;
	    default: w.push('by'); break;
	    }
	return w.join(' ');
    }

    toString() {
	return ["bearing", this.direction.toFixed(0)].join(' ');
    }
}

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
    const secs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60, 90, 120];
    const maxsec = secs[secs.length - 1];

    if (racestarttimerlast) {
	const racetim = racestart.getTime();
	const lastsec = Math.trunc((racetim - racestarttimerlast.getTime())/1000);
	const currsec = Math.trunc((racetim - dt.getTime())/1000);
	if (currsec < 120) {
	    showpopbox(false);
	    popbox.innerText = '' + currsec;
	}
	if (currsec > maxsec)
	    return;
	if (currsec <= 0) {
	    showpopbox(true);
	    playaudio('starttone');
	    clearInterval(racestarttimer);
	    racestarttimer = null;
	    racestarttimerlast = null;
	    racestartword = 0;
	    return;
	}
	var a = [];
	for (var i in secs) {
	    var s = secs[i];
	    if (lastsec > s && currsec <= s) {
		report('racestart in ' + s + ' seconds');
		if (racestartword == 0) {
		    a.push('start');
		    a.push('in');
		    racestartword = 1;
		}
		a.push('' + s);
		if (s > 10)
		    a.push("seconds");
		playaudio(a);
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
    var a = ["start", "at"];
    a.push(playint(hh));
    if (mm > 0) {
	if (mm < 10) {
	    a.push('o');
	    a.push('' + mm);
	} else if (mm < 20) {
	    a.push('' + mm);
	} else {
	    mm = '' + mm;
	    a.push(mm[0] + '0');
	    if (mm[1] != '0')
		a.push(mm[1]);
	}
    }
    report('racestarttime: ' + racestart);
    playaudio(a);
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

function showpopbox(hidep) {
    hide("popbox", hidep);
}

function closeoverlay () {
    setwidth("overlay", "0%");
    hide("cfg", true);
    hide("log", true);
}

function report(message) {
    //console.log(message);
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

function racemidmap() {
    return [
	(racecoursedetails['minlat'] + racecoursedetails['maxlat']) / 2,
	(racecoursedetails['minlon'] + racecoursedetails['maxlon']) / 2
    ];
}

function showlog () {
    setwidth("overlay", "100%");
    hide("log", false);
}

var gpxexportbutton = null;

function stoptracking () {
    var e = controls._container.firstChild.firstChild;
    report('tracking stopped');
    L.DomUtil.removeClass(e, 'fa-stop');
    L.DomUtil.addClass(e, 'fa-play');
    if (tracker) {
	navigator.geolocation.clearWatch(tracker);
	tracker = null;
	if (gpxexportbutton) {
	    gpxexportbutton.href = gpxdatafile();
	    gpxexportbutton.download = "HelmHelp" + (new Date()).toISOString() + ".gpx";
	}
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

function playbearing(f) {
    n = Math.round(f);
    var a = playaudio('bearing');
    a.push(playint(n));
    return a;
}

function playspeed(f) {
    var a = playfloat(f);
    a.push('knots');
    return a;
}

function playfloat(f) {
    var a = [];
    if (f < 0) {
	a.push('negative');
	f = -f;
    }
    n = Math.trunc(f);
    a.push(playint(n));
    f -= n;
    f *= 10;
    n = Math.round(f);
    if (n > 0) {
	a.push('point');
	a.push(playint(n));
    }
    return a;
}

function playint(n) {
    var s;
    var b = false;
    var a = [];
    
    if (n < 0) {
	a.push("negative");
	n = -n;
    }

    s = '' + n;
    while (s.length > 2) {
	a.push(s[0]);
	s = s.substr(1);
	b = true;
    }

    n = n % 100;
    r = n % 10;
    if (n == 0) {
	if (b) {
	    a.push('o');
	    a.push('o');
	} else
	    a.push('0');
    } else if (n < 10 && b) {
	a.push('o');
	a.push(s[1]);
    } else if (n <= 20 || r == 0)
	a.push('' + n);
    else {
	a.push(s[0]+'0');
	a.push(s[1]);
    }
    return a;
}

// https://stackoverflow.com/questions/38560764/how-to-play-many-audio-files-in-sequence
// https://audiomass.co/


var audiodict = null;

function audioinit() {

    if (audiodict) return;
    
    const clips = [
	"negative", "bearing", "point", "starttone",
	"pin", "RC", "set",
	"start", "in", "at",
	"seconds", "minutes", "knots",
	"90", "80", "70", "60", "50", "40", "30", "20",
	"19", "18", "17", "16", "15", "14", "13", "12", "11",
	"10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0", "o"
    ];

    var a;
    report('process audio - start ' + (new Date()));

    // sound to zero
    // pause instead of play?

    audiodict = {};
    for (const clip of clips) {
	a = new Audio();
	a.src = 'audio/' + clip + '.mp3';
	a.onended = audionext;
	a.autoplay = true;
	a.pause();
	audiodict[clip] = a
    }

    report('process audio - finish ' + (new Date()));
}

var audioqueue = [];

function audionext() {
    var s = audioqueue.shift();
    if (s === undefined)
	return;
    var a = audiodict[s];
    a.play();
}

function playaudio() {
    audioinit();
    var list = [];
    var i, j, b; 

    for (i = 0; i < arguments.length; i++) {
	b = arguments[i];
	if (typeof b == 'string')
	    list.push(b);
	else
	    for (j = 0; j < b.length; j++)
		list.push(b[j]);
    }

    for (const e of list)
	audioqueue.push(e);

    audionext();
}

function showcfg() {
    setwidth("overlay", "100%");
    hide("cfg", false);
}

function sharegpx() {
    var p = null;
    const mt = {type: "application/gpx+xml"};
    var data = gpxdatafile();
    var blob = new Blob([data], mt);
    var fn = "HelmHelp1.gpx";
    var file = new File([blob], fn, mt);
    if ('share' in navigator) {
	report('sharing gpx file with ' + path.length + ' track points.');
	report(data);
	navigator.share({
	    title: fn,
	    text: "Another Helm Help Track",
	    files: [file]
	}).then(function () {
	    report('exported successfully');
	}).catch(function (err) {
	    report('exported error ' + err);
	});
    }
    return p;
}

function gpxdatafile() {
    const latcol = 0;
    const loncol = 1;
    const timcol = 2;
    var dt = new Date();

    if (path.length > 0) {
	dt = path[path.length - 1][timcol];
	dt = new Date(dt);
    }

    var l = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'];
    l.push('<gpx version="1.1" creator="HelmHelp - https://cygnyx.github.io/HelmHelp/" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');
    l.push('<metadata>');
    l.push('<link href="cygnyx.github.io/HelmHelp"><text>Helm Help</text></link>')
    l.push('<time>' + dt.toISOString() + '</time>')
    l.push('<keywords>HelmHelp</keywords>')
    l.push('<metadata>');
    l.push('</metadata>');

    for (const name of Object.keys(marks).sort()) {
	var w = marks[name]
	report('mark ' + name + ' at ' + w.latitude + ' ' + w.longitude);
	l.push('<wpt lat="' + w.latitude + '" lon="' + w.longitude + '"><name>' + name + '</name></wpt>')
    }

    if (racecourse) {
	var rmarks = {}
	racecourse.forEach(function (rounding) {
	    var a = roundinggetmarks(rounding);
	    if (a)
		a.forEach(function(e) {rmarks[e]=0;});
	});
	rmarks = Object.keys(rmarks).sort();
	for (const mark of rmarks) {
	    var m;
	    if (mark in routes.waypoints.overrides)
		m = routes.waypoints.overrides[mark];
	    else if (mark in waypoints)
		m = waypoints[mark];
	    else
		m = null;
	    if (m) {
		l.push('<wpt lat="' + m[0] + '" lon="' + m[1] + '"><name>' + mark + '</name></wpt>')
	    }
	}

	var m;
	l.push('<rte><desc>' +  + '</desc>');
	for (const rounding of racecourse) {
	    var typ = rounding.substring(0, 1);
	    var mrk = rounding.substring(2);
	    var cmt = ''
	    if (typ == 'l') {
		cmt = 'line mark'
		if (mrk in routes.lines) {
		    a = routes.lines[mrk];
		    cmt = mrk;
		    mrk = [a[0], a[1]];
		}
	    } else if (typ == 'p') {
		cmt = "port rounding";
		mrk = [mrk];
	    } else if (typ == 's') {
		cmt = "starboard rounding";
		mrk = [mrk];
	    } else
		mrk = [];
	    for (const name in mrk) {
		var mark = mrk[name];
		if (mark in routes.waypoints.overrides)
		    m = routes.waypoints.overrides[mark];
		else if (mark in waypoints)
		    m = waypoints[mark];
		else
		    m = null;
		if (m)
		    l.push('<rtept lat="' + m[0] + '" lon="' + m[1] + '"><name>' + mark + '</name><cmt>'+cmt+'</cmt></rtept>')
	    }
	l.push('</rte>');
	}
    }


    l.push('<trk><name>Helm Help Track ' + dt.toISOString() + '</name>');
    l.push('<trkseg>');
    for (var i = path.length - 1; i >=0; i--) {
	const e = path[i];
	var ct = new Date(e[timcol]);
	l.push('<trkpt lat="' + e[latcol] + '" lon="' + e[loncol] + '"><time>' + ct.toISOString() + '</time></trkpt>');
    }
    l.push('</trkseg></trk></gpx>');

    return l.join('\n');
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

var lastroutesjson = null;

function loadcachedroutes(json) {
    lastroutesjson = json;
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

function loadcachedgpxtrack(gpxstring, url) {
    const gpxa = url.split(' ');
    var gpxtracktime = null;
    var gpxtrackskip = null;
    var gpxtrackduration = null;
    var sword, fword;

    switch (gpxa.length) {
    default:
	report('bad gpx specification: ' + gpxa);
	return;
    case 0:
	report('no track time information');
	return;
    case 1:
	sword = null;
	fword = null;
	break;
    case 2:
	sword = gpxa[1];
	fword = "5m";
	break;
    case 3:
	sword = gpxa[1];
	fword = gpxa[2];
	break;
    }

    var hhmm;
    var etime;
    if (sword) {
	hhmm = sword.split(':')

	if (hhmm.length == 1) {
	    gpxtracktime = null;
	    etime = hhmm;
	} else {
	    gpxtracktime = hhmm;
	    etime = 0;
	}
    }
    
    function duration(s) {
	if (!s) return s;
	return (s[s.length-1] == 's' ? 1 : 60) * parseInt(s);
    }

    gpxtrackskip = duration(etime);
    gpxtrackduration = duration(fword);
    report('gpx track time ' + [gpxtracktime, gpxtrackskip, gpxtrackduration].join(', '));

    const domParser = new window.DOMParser()
    const gpxtrack = domParser.parseFromString(gpxstring, "text/xml")
    const tracks = Array.from(gpxtrack.querySelectorAll("trk"))
    var st = null;
    var et = null;
    var ftime = true;

    for (const e in tracklines)
	tracklines[e][1].remove();
    tracklines = [];
    for (const e in trackmarks)
	trackmarks[e][1].remove();
    trackmarks = [];

    path = [];
    report('trks: ' + tracks.length);
    for (const te of tracks) {
	const trksegs = Array.from(gpxtrack.querySelectorAll("trkseg"));
	for (const tse of trksegs) {
	    const trkpts = Array.from(tse.querySelectorAll("trkpt"));
	    report('trkseg with ' + trkpts.length + ' points.');
	    for (const tp of trkpts) {
		var lat = parseFloat(tp.getAttribute("lat"));
		var lon = parseFloat(tp.getAttribute("lon"));
		var ele = parseFloat(getElementValue(tp, "ele"));
		var tim = getElementValue(tp, "time");
		if (tim[0] == '"' && tim[tim.length-1] == '"')
		    tim = tim.substr(1,tim.length-2)
		//console.log('tim: ' + tim);
		var tm = (new Date(tim)).getTime();
		//console.log('tm: ' + tm);
		if (ftime) {
		    ftime = false;
		    var etime = null;
		    const rt = new Date(tim);
		    if (gpxtracktime) {
			//console.log(rt);
			if (gpxtracktime[0] != '')
			    rt.setHours(parseInt(gpxtracktime[0]));
			if (gpxtracktime[1] != '')
			    rt.setMinutes(parseInt(gpxtracktime[1]));
			etime = (rt.getTime() - tm) / 1000;
			//console.log('for abs time wait seconds ' + etime);
		    }
		    if (gpxtrackskip)
			etime = (etime ? etime : 0) + gpxtrackskip;
		    var d;
		    if (gpxtrackduration != null && gpxtrackduration < 0) {
			d = etime;
			etime = (etime ? etime : 0) + gpxtrackduration;
		    } else
			d = gpxtrackduration;
		    if (etime)
			st = new Date(tm + (etime * 1000)).getTime();
		    if (!gpxtrackduration)
			et = null;
		    else if (gpxtrackduration < 0)
			et = new Date(tm + (d * 1000)).getTime();
		    else
			et = new Date((st ? st : tm) + (d * 1000)).getTime();
		    //console.log('st: ' + st)
		    //console.log('et: ' + et)
		}
		if (st)
		    if (tm < st) {
			continue;
		    }
		if (et)
		    if (tm > et)
			continue;
		path.unshift([lat, lon, tm, 0., 0., 0.]);
	    }
	}
    }

    report('read ' + path.length + ' points.');

    for (var idx = path.length-1; idx > 0; idx--) {
	calcpath(idx);
    }

    for (var idx = path.length-1; idx >= 0; idx--)
	drawline(idx);

    addtacks(1, path.length-1); // from now to beginning
}

function average() {
    var s = 0;
    for (var i = 0; i < arguments.length; i++)
	s += arguments[i];
    return s / arguments.length;
}

function averagebearing() {
    const b = arguments[0];
    const n = arguments.length;
    const invn = 1.0 / n;
    var v = 0;
    for (var i = 1; i < n; i++)
	v += Bearing.distancefromto(b, arguments[i]) * invn;
    return Math.round(b + v);
}

function scale(f, scale) {
    return Math.round(f / scale) * scale;
}

function addtacks(finish, start) {
    if ((start - finish) < 6)
	return;

    var idx;
    var pb, lpb, nb, pk, rb;
    var bd, lidx = -1, fidx = -1, bdir = 0, lbdir = 0;
    const mb = 60;
    const mtr = 3;
    const knt = 4;
    const dir = 5;

    var tacks = [];

    function ad(idx) {
	const ave = average(
	    path[idx+5][knt], path[idx+4][knt],
	    path[idx+3][knt], path[idx+2][knt],
	    path[idx+1][knt]
	);
	return scale(ave, .1);
    }

    function ab(idx) {
	//report('ab: ' + [ path[idx+5][dir], path[idx+4][dir], path[idx+3][dir], path[idx+2][dir], path[idx+1][dir] ].join(', '));
	const ave = averagebearing(
	    path[idx+5][dir], path[idx+4][dir],
	    path[idx+3][dir], path[idx+2][dir],
	    path[idx+1][dir]
	);
	return ave;
    }


    for (var idx = start - 5; idx >= finish + 5; idx--) {
	if (lidx < -1) {
	    lidx += 1;
	    continue;
	}
	pk = ad(idx);
	pb = ab(idx);
	//report('prior bearing: ' + pb);
	nb = ab(idx-5);
	//report('_next bearing: ' + nb);

	if (lidx < 0)
	    rb = pb; // finding new tack
	else
	    rb = lpb; // continuing old tack
	//report('__ref bearing: ' + rb);
	bd = Bearing.distancefromto(rb, nb); // continuing old tack

	if (bd > mb)
	    bdir = 1;
	else if (bd < -mb)
	    bdir = -1;
	else
	    bdir = 0;

	//report('checking tack at idx, bd, bearing: old, new: ' + [idx, bd, rb, nb, bdir].join(', '));

	if (lidx == -1) {
	    if (bdir != 0) {
		fidx = idx;
		lidx = idx;
		lbdir = bdir;
		lpb = pb;
		report('possible tack at idx, bd, bearing: old, new: ' + [lidx, bd, lpb, nb, bdir].join(', '));
	    }
	} else if (lbdir == bdir && lidx == idx + 1) {
	    lidx = idx;
	    report('continue tack at idx, bd, bearing: old, new: ' + [lidx, bd, rb, nb, bdir].join(', '));
	} else if (fidx - 1 > lidx) {
	    report('likely tack between: ' + fidx + ' and ' + lidx);
	    tacks.push([fidx, lidx]);
	    lidx = -6;
	    fidx = -1;
	    bdir = 0;
	} else if (lidx > -1) {
	    report('not a tack');
	    lidx = -1;
	}
    }

    // cluster tacks
    var i, idx, bi;
    var m0 = 90, m1 = 270;
    var d0, d1;
    var s0, s1;
    var c0, c1;
    var assign = new Array(tacks.length);
    report('cluster:')

    for (var iter = 0; iter < 15; iter++) {
	s0 = 0;	s1 = 0;
	c0 = 0;	c1 = 0;
	for (i = 0; i < tacks.length; i++) {
	    fidx = tacks[i][0];
	    lidx = tacks[i][1];
	    cb = averagebearing(path[fidx][5], path[lidx][5]);
	    d0 = Bearing.distancefromto(m0, cb);
	    d1 = Bearing.distancefromto(m1, cb);
	    if (Math.abs(d0) < Math.abs(d1)) {
		assign[i] = 0;
		s0 += d0;
		c0++;
	    } else {
		assign[i] = 1;
		s1 += d1;
		c1++;
	    }
	}
	if (c0 == 0 || c1 == 0 || s0 == 0 || s1 == 0)
	    break;
	m0 = m0 + Math.round(s0 / c0);
	m1 = m1 + Math.round(s1 / c1);
	m0 = (m0 + 360) % 360;
	m1 = (m1 + 360) % 360;
    }

    report('final mean TWD, dist, cnt: ' + [m0, m1, s0, s1, c0, c1])
    p = c0 > c1 ? 0 : 1;
    for (i = 0; i < tacks.length; i++) {
	fidx = tacks[i][0];
	lidx = tacks[i][1];
	cb = averagebearing(path[fidx][5], path[lidx][5]);
	lat = path[fidx][0];
	lon = path[fidx][1];
	tim = path[fidx][2];
	report(fidx, path[fidx][2]);
	report(lidx, path[lidx][2]);
	if (assign[i] == p) {
	    circ = L.circle([lat, lon],{
		color: '#f00',
		fillOpacity: 0.2,
		radius: 5
	    }).bindPopup(
		'tack: TWD ' + cb + ' Seconds ' + scale((path[lidx][2] - tim)/1000, .1).toFixed(1)
	    ).addTo(maplet);
	    trackmarks.unshift([tim, circ]);
	}
    }
}

function cacheclear() {
    localStorage.clear();
}

async function cachefile(url, procfunc, init = null) {
    if (!url || url == "")
	return;
    url = url.trim();
    var ua = url.split(' ');
    txt = localStorage.getItem(ua[0]);
    if (txt === null) {
	var r = await fetch(ua[0], init);
	txt = await r.text();
	if (txt.length > 0) {
	    localStorage.setItem(ua[0], txt);
	    procfunc(txt, url);
	}
    } else {
	procfunc(txt, url);
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
	maplet.panTo(racemidmap());
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

function nmb(lat1, lon1, lat2, lon2) { // get nm distance and degree bearing
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
    //report('dist: ' + dist);
    
    const y = Math.sin(radtheta) * Math.cos(radlat2);
    const x = Math.cos(radlat1) * Math.sin(radlat2) -
          Math.sin(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    const brng = Math.atan2(y, x) * todeg;
    //report('br x: ' + x);
    //report('br y: ' + y);
    //report('brng: ' + brng);

    return [dist, (brng + 360) % 360];
}

var path = []; // lat, lon, time, meters from prior, knots, bearing

function thedst(a, b) {
    return Math.sqrt(a*a + b*b);
}

function astep(idx, forward) {
    const step = forward ? -1 : 1;
    const plen = path.length - 1;
    const zlvl = 0.000001;
    var lidx = idx;
    var d;
    
    report('at ' + idx + ' search ' + step + ' [0-' + plen + ']');
    if (plen == 0) {
	report('at 0 search exit');
	return 0;
    }
    while (step != 0) {
	if (forward) {
	    if (idx == 0)
		break;
	} else if (idx == plen)
	    break;
	idx += step;
	report('at ' + idx + ' and lidx ' + lidx);
	d = thedst(path[lidx][0] - path[idx][0], path[lidx][1] - path[idx][1]);
	if (d > zlvl)
	    break;
	lidx = idx;
    }
    report('at ' + idx + ' search exit');
    return idx;
}

function getsteps(idx) {
    const pi = astep(idx, false);
    const ci = astep(pi, true);
    const ni = astep(ci, true);

    return [pi, ci, ni];
}

function calcpath(idx) {
    const tom = 1852;
    const plen = path.length - 1;
    //console.log('idx: ' + idx);

    const steps = getsteps(idx);
    const pi = steps[0]
    const ci = steps[1]
    const ni = steps[2]
    
    if (pi == ci || ci == ni) {
	report("wait for more data in calcpath on " + idx);
	return;
    }

    report("using " + pi + " to " + ci + " to " + ni + " in calcpath on " + idx);

    const c = path[ci];
    const p = path[pi];
    const n = path[ni];

    //report('c: ' + c);
    //report('p: ' + p);
    //report('n: ' + n);
    
    var plat = p[0], plon = p[1], ptim = p[2];
    var clat = c[0], clon = c[1], ctim = c[2];
    var nlat = n[0], nlon = n[1], ntim = n[2];

    //report('idx, tim: ' + [idx, scale(p[2]/1000,1)].join(', '));
    //report('idx, pll: ' + [idx, p[0], p[1]].join(', '));
    //report('idx, cll: ' + [idx, c[0], c[1]].join(', '));
    //report('idx, nll: ' + [idx, n[0], n[1]].join(', '));

    var xp = nmb(plat, plon, clat, clon);
    var xc = nmb(clat, clon, nlat, nlon);
    var xn = nmb(plat, plon, nlat, nlon);
    //report('idx, pc: d, b: ' + [idx, xp[0], xp[1]].join(', '));
    //report('idx, cn: d, b: ' + [idx, xc[0], xc[1]].join(', '));
    //report('idx, pn: d, b: ' + [idx, xn[0], xn[1]].join(', '));
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

    function r(n, s) { return Math.round(n * s)/s };

    c[0] = r(c[0], 100000);
    c[1] = r(c[1], 100000);
    var m = r(dpc * tom, 10);
    k = r(k, 10);
    bpn = r(bpn,1);
    path[idx] = [c[0], c[1], c[2], m, k, bpn];
    //report('idx final: ' + path[idx].join(', '));
    //console.log(path[idx]);

    while (idx++ < plen) {
	if (path[idx][3] > 0)
	    break;
	p[0] = r(p[0], 100000);
	p[1] = r(p[1], 100000);
	path[idx+1] = [p[0], p[1], p[2], 0.1, 0.01, bpn];
	//report('idx prior: ' + path[idx].join(', '));
    }
}



var tracklines = [];
var trackmarks = [];

function drawline(idx) {
    var old = false;

    if (path.length <= idx)
	return;

    const c = path[idx];
    const lat = c[0];
    const lon = c[1];
    const tim = c[2];
    const dis = c[3];
    const knt = c[4];
    const ang = c[5];
    const clr = ['#00ff000', '#99ff00', '#eeff00', '#ffff00', '#ffbb00', '#ffee00', '#ffcc00', '#ff9900', '#ff0000'];
    const cl = clr.length;
    var k = Math.trunc(knt);
    var pts = [[lat, lon]];
    var seconds = 100000;
    var circ;
    
    if (trackmarks.length > 0)
	seconds = (tim - trackmarks[0][0]) / 1000;

    if (seconds >= 60) {
	circ = L.circle(pts[0], {
	    color: '#00f',
	    fillOpacity: 0.2,
	    radius: 5
	}).bindPopup(knt.toFixed(1) + ' knots ' + ang.toFixed(0) + ' bearing ' + new Date(tim).toLocaleTimeString()).addTo(maplet);
	trackmarks.unshift([tim, circ]);
    }

    if (k >= cl)
	k = cl - 1;
    
    if (tracklines.length > 0)
	if (k == tracklines[0][0])
	    old = true;

    report('set ' + pts[0] + ' k: ' + k + ' old: ' + old)

    if (tracklines.length > 0) {
	report('set ' + pts[0])
	report('len: ' + tracklines[0][1]._latlngs.length)
	tracklines[0][2].unshift(pts[0]);
	tracklines[0][1].setLatLngs(tracklines[0][2]);
	//	tracklines[0][1]._latlngs.push(pts[0]);
    }

    if (!old) {
	var line = L.polyline(pts, {
	    color: clr[k],
	    bubblingMouseEvents: true
	});
	maplet.addLayer(line);
	
	if (tracklines.length > 0)
	    pts = [tracklines[0][2][0], pts[0]]

	report('new: ' + pts + ' k: ' + k)
	tracklines.unshift([k, line, pts]);
   }
}

function centeratlastposition() {
    const p = path[0];
    const ll = new L.LatLng(p[0], p[1]);

    report('of ' + path.length + ' pan to ' + ll);

    if (currposition) {
	maplet.removeLayer(currposition);
	currposition.setLatLng(ll);
	currposition.addTo(maplet);
    } else {
	currposition = L.circle([p[0], p[1]], {
	    color: '#000',
	    fillColor: '#000',
	    fillOpacity: 1.0,
	    radius: 3
	}).addTo(maplet);
    }

    maplet.panTo(ll);
}

function drawnewsegment(detail) {
    return new Promise(function (resolve) {
	path.unshift([detail[0], detail[1], detail[2], 0.0, 0.0, 0.0]);
	calcpath(1);
	drawline(1);
	centeratlastposition();
	return resolve(detail);
    });
}

var currposition = null;

function onload() {
    map = document.getElementById("map");
    log = document.getElementById("log");

    maplet = L.map("map");
    maplet.setView(CENTER_LAT_LNG, 13);

    map.addEventListener("GEO_EVENT", updatemap);

    L.tileLayer(MAPTILE_SERVER, {
	maxZoom: 19,
	attribution: MAPTILE_CR
    }).addTo(maplet);

    L.Control.Textbox = L.Control.extend({
	options: { position: 'topright' },
	onAdd: function (map) {
	    var container = L.DomUtil.create('div');
	    container.id = 'popbox';
	    return container;
	},
	onRemove: function(map) {}
    })
    var popmsg = new L.Control.Textbox();
    popmsg.addTo(maplet);
    popbox = document.getElementById("popbox");

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
	    L.DomUtil.create('i', 'fa-play', button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', showlog);
	    L.DomUtil.create('i', "fa-bars", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', markrc);
	    L.DomUtil.create('i', "fa-ship", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', markpin);
	    L.DomUtil.create('i', "fa-map-pin", button);

            button = L.DomUtil.create('a', 'leaflet-control-button', container);
            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', showcfg);
	    L.DomUtil.create('i', "fa-gear", button);

	    button = L.DomUtil.create('a', 'leaflet-control-button', container);
	    L.DomEvent.disableClickPropagation(button);
	    L.DomEvent.on(button, 'click', sharegpx);
	    L.DomUtil.create('i', "fa-road", button);
	    if (!('share' in navigator))
   	        gpxexportbutton = button;

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
    setvalue("gpxtrackurl");
    setvalue("waypointsurl");
    setconftimes();
    setconfseries();
    setconfcourse();
}
