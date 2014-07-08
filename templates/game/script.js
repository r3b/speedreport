var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '~', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(delims),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#']
      .concat(unwise).concat(autoEscape),
    nonAuthChars = ['/', '@', '?', '#'].concat(delims),
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-zA-Z0-9][a-z0-9A-Z_-]{0,62}$/,
    hostnamePartStart = /^([a-zA-Z0-9][a-z0-9A-Z_-]{0,62})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always have a path component.
    pathedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    };
function parseHost(host) {
  var out = {};
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      out.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) out.hostname = host;
  return out;
}
function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && typeof(url) === 'object' && url.href) return url;

  if (typeof url !== 'string') {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var out = {},
      rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    out.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      out.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {
    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    // don't enforce full RFC correctness, just be unstupid about it.

    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the first @ sign, unless some non-auth character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    var atSign = rest.indexOf('@');
    if (atSign !== -1) {
      var auth = rest.slice(0, atSign);

      // there *may be* an auth
      var hasAuth = true;
      for (var i = 0, l = nonAuthChars.length; i < l; i++) {
        if (auth.indexOf(nonAuthChars[i]) !== -1) {
          // not a valid auth.  Something like http://foo.com/bar@baz/
          hasAuth = false;
          break;
        }
      }

      if (hasAuth) {
        // pluck off the auth portion.
        out.auth = decodeURIComponent(auth);
        rest = rest.substr(atSign + 1);
      }
    }

    var firstNonHost = -1;
    for (var i = 0, l = nonHostChars.length; i < l; i++) {
      var index = rest.indexOf(nonHostChars[i]);
      if (index !== -1 &&
          (firstNonHost < 0 || index < firstNonHost)) firstNonHost = index;
    }

    if (firstNonHost !== -1) {
      out.host = rest.substr(0, firstNonHost);
      rest = rest.substr(firstNonHost);
    } else {
      out.host = rest;
      rest = '';
    }

    // pull out port.
    var p = parseHost(out.host);
    var keys = Object.keys(p);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      out[key] = p[key];
    }

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    out.hostname = out.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = out.hostname[0] === '[' &&
        out.hostname[out.hostname.length - 1] === ']';

    // validate a little.
    if (out.hostname.length > hostnameMaxLen) {
      out.hostname = '';
    } else if (!ipv6Hostname) {
      var hostparts = out.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            out.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    // hostnames are always lower case.
    out.hostname = out.hostname.toLowerCase();

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = out.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s);
      }
      out.hostname = newOut.join('.');
    }

    out.host = (out.hostname || '') +
        ((out.port) ? ':' + out.port : '');
    out.href += out.host;

    // strip [ and ] from the hostname
    if (ipv6Hostname) {
      out.hostname = out.hostname.substr(1, out.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    out.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    out.search = rest.substr(qm);
    out.query = rest.substr(qm + 1);
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    out.search = '';
    out.query = {};
  }
  if (rest) out.pathname = rest;
  if (slashedProtocol[proto] &&
      out.hostname && !out.pathname) {
    out.pathname = '/';
  }

  //to support http.request
  if (out.pathname || out.search) {
    out.path = (out.pathname ? out.pathname : '') +
               (out.search ? out.search : '');
  }

  return out;
}
function createImageTexture(options){
	options=options||{};
	var canvas = document.createElement('canvas');
	canvas.width=options.width||1024;
	canvas.height=options.height||1024;
	var context = canvas.getContext('2d');
	if(options.background){
		context.fillStyle = options.background;//'#999999';
		context.fillRect(0,0,canvas.width,canvas.height);
	}
	var src=options.src,
		text=options.text,
		xi=options.imageX||0,
		yi=options.imageY||0,
		wi=options.imageWidth,
		hi=options.imageHeight,
		iconSize=Math.round(canvas.height/3),
		fontHeight=Math.round(canvas.height/5);
	if(src){
		var imageObj = new Image();
		imageObj.onload = function() {
			console.log(src, "loaded");
			wi=wi||imageObj.width;
			hi=hi||imageObj.height;
			context.drawImage(imageObj, xi, yi, wi, hi, canvas.width-iconSize, canvas.height-iconSize, iconSize, iconSize);
			// console.log(src,text, canvas);
			("function"===typeof options.callback)&&options.callback(canvas);
			// document.body.appendChild(canvas);

		};
		imageObj.src = src;
	}
	if(options.text){
		context.font = 'bold 40pt Calibri';
  		context.fillText(options.text, 60, 20);
	}
	if(!src){
		("function"===typeof options.callback)&&options.callback(canvas);
	}
	return canvas; 
}
function createSprite(src, width, height){
	var canvas = document.createElement('canvas');
	canvas.width=width||1024;
	canvas.height=height||1024;
	var context = canvas.getContext('2d');
	var imageObj = new Image();
	imageObj.onload = function() {
		console.log(src, "loaded");
		var wi=imageObj.width,
			hi=imageObj.height;
		context.drawImage(imageObj, 0, 0, wi, hi, 0, 0, canvas.width, canvas.height);
	};
	imageObj.src = src;
	return canvas;
}
function getTextureImageByMimeType(mimetype){
	var texture="other.gif";
	switch(mimetype){
		case "application/x-javascript":
		case "application/javascript":
		case "text/javascript":
			texture="js.png";
			break;
		case "text/css":
			texture="css3.png";
			break;
		case "text/html":
			texture="html5.png";
			break;
		default:
      texture="other.gif";
			break;
	}
	return texture;
}
function getFilenameFromURL(url){
	url=urlParse(url);
	return url.pathname;
}
function partial(){
    var self=this,args = Array.prototype.slice.call(arguments);
    var fn=args.shift();
    return fn.bind(self, args);
}
function repeat(count, delay, fn, complete){
  if("function" === typeof fn){
    setTimeout(function(){
      fn.call();
      if(--count > 0){
        repeat(count,delay,fn);
      }else{
        if("function" === typeof complete)complete();
      }
    }, delay)
  }
}
function deg2rad(deg){return Math.round(100*deg*(Math.PI/180))/100;}
function rad2deg(rad){return Math.round(100*rad*(180/Math.PI))/100;}
function point(a,r){return (function(a){return [Math.round(r*Math.sin(a)), Math.round(r*Math.cos(a))]})(deg2rad(a));}
function dist(a,b){
  var dx=b[0]-a[0];
  var dy=b[1]-a[1];
  return Math.sqrt(dx*dx + dy*dy);
}
function angleFromPole(point){
  return ((point.x<0)?-1:1)*Math.round(rad2deg(Math.asin(point.y/(Math.sqrt(point.x*point.x + point.y*point.y)))));
}
function midpoint(a,b){return [((a[0]+b[0])/2),((a[1]+b[1])/2)];}
function walk(/*arg1, arg2, arg3, ..., fn */){
	return (function(args){
		var fn=args.shift();
		return (Array.isArray(args[0])?walk.apply(null,[fn].concat(args[0])):args.reduce(fn));
	})(Array.prototype.slice.call(arguments,0))
}
function Max(){return walk(function(p,c){return Math.max(p,c);},Array.prototype.slice.call(arguments,0));}
function Min(){return walk(function(p,c){return Math.min(p,c);},Array.prototype.slice.call(arguments,0));}
function norm(){
	var args=Array.prototype.slice.call(arguments,0);
	if(args.length===1 && Array.isArray(args[0])){
		args=args[0];
	}
	var min=Min(args);
	var max=Max(args)+10;
	var count=args.length;
	return args.map(function(x){
		return Math.round(1 + (x-min)*(count-10)/(max-min))+5;
	});
}
function Bitmap(src, width, height) {
  this.image = new Image();
  this.image.src = src;
  this.width = width;
  this.height = height;
}

var CIRCLE=Math.PI*2;
var MOBILE=/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
var display = document.getElementById('display');
var loop, player, controls, camera;

function Controls() {
	this.codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
	this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
	document.addEventListener('keydown', this.onKey.bind(this, true), false);
	document.addEventListener('keyup', this.onKey.bind(this, false), false);
	document.addEventListener('touchstart', this.onTouch.bind(this), false);
	document.addEventListener('touchmove', this.onTouch.bind(this), false);
	document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
}

Controls.prototype.onTouch = function(e) {
	var t = e.touches[0];
	this.onTouchEnd(e);
	if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
	else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
	else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
};

Controls.prototype.onTouchEnd = function(e) {
	this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
	e.preventDefault();
	e.stopPropagation();
};

Controls.prototype.onKey = function(val, e) {
	var state = this.codes[e.keyCode];
	if (typeof state === 'undefined') return;
	this.states[state] = val;
	e.preventDefault && e.preventDefault();
	e.stopPropagation && e.stopPropagation();
};
function bluesky(canvas, width, height, bright){
  bright=bright||192
  var color=function(){
    var random = Math.random,r=g=(random() * bright/2) | 0, b=bright+(random() * (bright/2)) | 0;
    return [r,g,b,128]
  }
  perlinNoise(canvas, width, height, color)
}
function grassy(canvas, width, height, bright){
  bright=bright||24
  var color=function(){
    var random = Math.random,r=b=(random() * bright) | 0, g=bright+(random() * (256-bright)) | 0;
    return [r,g,b,128]
  }
  perlinNoise(canvas, width, height, color)
}
function randomNoise(canvas, x, y, width, height, colorFunc) {
    x = x || 0;
    y = y || 0;
    width = width || canvas.width;
    height = height || canvas.height;
    var g = canvas.getContext("2d"),
        imageData = g.getImageData(x, y, width, height),
        random = Math.random,
        pixels = imageData.data,
        n = pixels.length,
        i = 0;
    while (i < n) {
        
        (function(r,g,b,a){
          pixels[i++] = r;
          pixels[i++] = g;
          pixels[i++] = b;
          pixels[i++] = a;
        }.apply(this, colorFunc(i)))
    }
    g.putImageData(imageData, x, y);
    return canvas;
}
 
function perlinNoise(canvas, width, height, colorFunc) {
    var c2=document.createElement('canvas');
    c2.width=width||128;
    c2.height=height||128;
    var noise = randomNoise(c2, 0, 0, 128, 128, colorFunc||grassy);
    var g = canvas.getContext("2d");
    g.save();
    
    /* Scale random iterations onto the canvas to generate Perlin noise. */
    for (var size = 4; size <= noise.width; size *= 2) {
        var x = (Math.random() * (noise.width - size)) | 0,
            y = (Math.random() * (noise.height - size)) | 0;
        g.globalAlpha = 4 / size;
        g.drawImage(noise, x, y, size, size, 0, 0, canvas.width, canvas.height);
    }
 
    g.restore();
    return canvas;
}
function Map(){
	var uuid=(location.hash)?location.hash.substring(1):"";
	var reportUrl="http://api.usergrid.com/rbridges/spooky/reports/"+uuid;
	var blocks=[];
	this.loaded=false;
	this.size=0;
	this.wallGrid;
	this.light=1;
	Ajax.get(reportUrl).then(function(err,data){
		var data=JSON.parse(data.responseText);
		var report=data.entities.pop();
		this.size=report.log.entries.length*2;
		this.wallGrid=Array.apply(0, Array(this.size * this.size)).map(function () { return 0 });
		this.gridData=Array.apply(0, Array(this.size * this.size)).map(function () { return 0 });
    var totalTime=report.log.entries[report.log.entries.length-1].stackedTimings.lifetime||1000;
    this.skybox=createImageTexture({background:'#A9F5F2', callback:function(canvas){bluesky(canvas, 192-(192*2000/totalTime));}});

    this.land=createImageTexture({background:'#0B610B', callback:function(canvas){grassy(canvas, 24-(24*2000/totalTime));}});

    this.raining=(totalTime>2000);

    console.log(report.log.entries)
		report.log.entries.forEach(function(entry){
			var pathname=getFilenameFromURL(entry.request.url);
			if(pathname.length>1 && /\//.test(pathname)){
				pathname=pathname.substring(pathname.lastIndexOf('/')+1);
			}
			var mimetype=entry.response.content.mimeType.replace(/;.*/,'');
			var texture=createImageTexture({
				src:getTextureImageByMimeType(mimetype),
				background:'#555555',
				width:1024,
				height:1024,
				callback:function(canvas){
					var ctx=canvas.getContext('2d');
					ctx.fillStyle = '#ffffff';
					ctx.globalAlpha = 1;
					ctx.font = 'normal 90pt Times New Roman';
			  		ctx.fillText(pathname, 5, 120);
			  		ctx.fillText(entry.request._domain, 5, 220);
			  		ctx.fillText("blocked: "+entry.timings.blocked, 5, 320);
			  		ctx.fillText("latency: "+entry.timings.wait, 5, 420);
			  		ctx.fillText("receive: "+entry.timings.receive, 5, 520);
				}
			});
			entry.texture=texture;
			blocks.push(entry);
		});
		(function(self){
			var blockingTime=norm(blocks.map(function(b){return b.timings.blocked}));
			blocks.forEach(function(x,i){
				var p=point(45,blockingTime[i])
				x.x=p[0];
				x.y=p[1];
				while(self.get(x.x,x.y)!==0){
          x.x++;
        };
				self.set(x.x,x.y,1);
        self.setEntry(x.x,x.y,x);
			})
			// console.log("blocks", self.wallGrid);
			// for(var i=0;i<self.wallGrid.length;i+=self.size){
			// 	for (var j=0,line=""; j<self.size;j++)line+=(self.wallGrid[i+j])?'X':'_';
			// 	console.log(line);
			// }

		})(this);
		this.loaded=true;
		(function(map){
			player = new Player(1,1, deg2rad(45));
			controls = new Controls();
			camera = new Camera(display, MOBILE ? 160 : 320, Math.PI*0.3);
			loop = new GameLoop();

			loop.start(function frame(seconds) {
				map.update(seconds);
				player.update(controls.states, map, seconds);
				camera.render(player, map);
			});
		})(this);
	}.bind(this));
}
Map.prototype.get=function(x,y){
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
	return this.wallGrid[y * this.size + x];
};
Map.prototype.set=function(x,y,v){
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return;
	this.wallGrid[y * this.size + x]=v;
};
Map.prototype.getEntry=function(x,y){
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
	return this.gridData[y * this.size + x];
};
Map.prototype.setEntry=function(x,y,v){
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return;
	this.gridData[y * this.size + x]=v;
};
Map.prototype.cast = function(point, angle, range) {
  var self = this;
  var sin = Math.sin(angle);
  var cos = Math.cos(angle);
  var noWall = { length2: Infinity };

  return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

  function ray(origin) {
    var stepX = step(sin, cos, origin.x, origin.y);
    var stepY = step(cos, sin, origin.y, origin.x, true);
    var nextStep = stepX.length2 < stepY.length2
      ? inspect(stepX, 1, 0, origin.distance, stepX.y)
      : inspect(stepY, 0, 1, origin.distance, stepY.x);

    if (nextStep.distance > range) return [origin];
    return [origin].concat(ray(nextStep));
  }

  function step(rise, run, x, y, inverted) {
    if (run === 0) return noWall;
    var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
    var dy = dx * (rise / run);
    return {
      x: inverted ? y + dy : x + dx,
      y: inverted ? x + dx : y + dy,
      length2: dx * dx + dy * dy
    };
  }

  function inspect(step, shiftX, shiftY, distance, offset) {
    var dx = sin < 0&&cos>0 ? shiftX : 0;
    var dy = cos < 0&&sin>0 ? shiftY : 0;
    step.height = (self.get(step.x - dx, step.y - dy)===0)?0:1;
    step.distance = distance + Math.sqrt(step.length2);
    if (shiftX&&!shiftY) step.shading = cos < 0 ? 2 : 0;
    else step.shading = sin < 0 ? 2 : 1;
    step.offset = offset - Math.floor(offset);
    return step;
  }
};

Map.prototype.update=function(seconds){
  // if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
  // else if (Math.random() * 5 < seconds) this.light = 2;  
};

function Player(x, y, direction) {
	this.x = x;
	this.y = y;
	this.direction = direction;
	this.paces=0;
	this.weapon = createSprite("phantomjs.png", 128, 128);
}

Player.prototype.rotate = function(angle) {
	this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
  // console.log("turn",this.direction);
};

Player.prototype.walk = function(distance, map) {
  var dx = Math.cos(this.direction) * distance;
  var dy = Math.sin(this.direction) * distance;
  if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
  if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
  // console.log("step",this.x,this.y);
  this.paces += distance;
};
Player.prototype.walkTo = function(point, map) {
  var delta=dist([this.x,this.y],[point.x,point.y]);
  var step=(delta<0)?-1:1;
  var self=this;
  // console.log("walk to",point.x,point.y, delta, step);
  this.turnToward(point, map, function(){
    repeat(Math.abs(delta), 10, function(){self.walk(step,map)});  
  })
  
  // this.paces += distance;
};
Player.prototype.turnToward=function(point, map, callback){
  var y=point.y;
  var x=y*Math.tan(rad2deg(this.direction));
  var a=dist([this.x,this.y],[point.x,point.y]);
  var b=dist([this.x,this.y],[x,y]);
  var c=dist([point.x,point.y],[x,y]);
  var C=Math.acos((c*c-b*b-a*a)/(2*a*b));
  // console.log([this.x,this.y],[point.x,point.y],[x,y],a,b,c,C);
  var angle=rad2deg(C);
  var dir=(point.x>this.x>0)?-1:1;
  var step=(C/10)*dir;
  var self=this;
  // console.log("turn to",point.x,point.y, C, step, dir);
  repeat(Math.abs(C), 10, function(){self.rotate(deg2rad(step))}, callback)
}
Player.prototype.update = function(controls, map, seconds) {
	if (controls.left) this.rotate(-Math.PI * seconds);
	if (controls.right) this.rotate(Math.PI * seconds);
	if (controls.forward) this.walk(3 * seconds, map);
	if (controls.backward) this.walk(-3 * seconds, map);
};






function Camera(canvas, resolution, fov) {
	this.ctx = canvas.getContext('2d');
	this.width = canvas.width = window.innerWidth * 0.5;
	this.height = canvas.height = window.innerHeight * 0.5;
	this.resolution = resolution;
	this.spacing = this.width / resolution;
	this.fov = fov;
	this.range = MOBILE ? 8 : 14;
	this.lightRange = 5;
	this.scale = (this.width + this.height) / 1200;
}

Camera.prototype.render = function(player, map) {
  this.drawLand(player.direction, map.land, map.light);
	this.drawSky(player.direction, map.skybox, map.light);
	this.drawColumns(player, map);
	this.drawWeapon(player.weapon, player.paces);
};

Camera.prototype.drawSky = function(direction, sky, ambient) {
	var width = this.width * (CIRCLE / this.fov);
	var left = -width * direction / CIRCLE;

	this.ctx.save();
	this.ctx.drawImage(sky.image||sky, left, 0, width, this.height/2);
	if (left < width - this.width) {
	  this.ctx.drawImage(sky.image||sky, left + width, 0, width, this.height/2);
	}
	if (ambient > 0) {
	  this.ctx.fillStyle = '#ffffff';
	  this.ctx.globalAlpha = ambient * 0.1;
	  this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
	}
	this.ctx.restore();
};
Camera.prototype.drawLand = function(direction, land, ambient) {
	var width = this.width * (CIRCLE / this.fov);
	var left = -width * direction / CIRCLE;

	this.ctx.save();
	this.ctx.drawImage(land.image||land, left, this.height/2, width, this.height/2);
	if (left < width - this.width) {
	  this.ctx.drawImage(land.image||land, left + width, this.height/2, width, this.height/2);
	}
	if (ambient > 0) {
	  this.ctx.fillStyle = '#ffffff';
	  this.ctx.globalAlpha = ambient * 0.1;
	  this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
	}
	this.ctx.restore();
};
Camera.prototype.drawColumns = function(player, map) {
  this.ctx.save();

  for (var column = 0; column < this.resolution; column++) {
    var angle = this.fov * (column / this.resolution - 0.5);
    var ray = map.cast(player, player.direction + angle, this.range);
    this.drawColumn(column, ray, angle, map);
  }
  this.ctx.restore();
};

Camera.prototype.drawWeapon = function(weapon, paces) {
	var bobX = Math.cos(paces * 2) * this.scale * 6;
	var bobY = Math.sin(paces * 4) * this.scale * 6;
	var left = this.width * 0.66 + bobX;
	var top = this.height * 0.6 + bobY;
	this.ctx.drawImage(weapon, left, top, weapon.width * this.scale, weapon.height * this.scale);
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
	var ctx = this.ctx;
	var left = Math.floor(column * this.spacing);
	var width = Math.ceil(this.spacing);
	var hit = -1;

	while (++hit < ray.length && ray[hit].height <= 0);
	for (var s = ray.length - 1; s >= 0; s--) {
	  var step = ray[s];
    if(map.raining){
      var rainDrops = Math.pow(Math.random(), 3) * s;
      var rain = (rainDrops > 0) && this.project(0.1, angle, step.distance);
    }

	  if (s === hit) {
  		var texture = map.getEntry(step.x,step.y).texture;
  		if(!texture)continue;
	    var textureX = Math.floor(texture.width * step.offset);
	    var wall = this.project(step.height, angle, step.distance);

	    ctx.globalAlpha = 1;
      try{
        ctx.drawImage((texture.image)?texture.image:texture, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);
      }catch(e){
        console.log(map.getEntry(step.x,step.y))
        throw e
      }
	    
	    ctx.fillStyle = '#000000';
	    ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0.1);

	    ctx.fillRect(left, wall.top, width, wall.height);
	  }
	  if(map.raining){
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
    }
	}
};

Camera.prototype.project = function(height, angle, distance) {
	var z = distance * Math.cos(angle);
	var wallHeight = this.height * height / z;
	var bottom = this.height / 2 * (1 + 1 / z);
	return {
	  top: bottom - wallHeight,
	  height: wallHeight
	}; 
};








function GameLoop() {
	this.frame = this.frame.bind(this);
	this.lastTime = 0;
	this.callback = function() {};
}

GameLoop.prototype.start = function(callback) {
	this.callback = callback;
	requestAnimationFrame(this.frame);
};

GameLoop.prototype.frame = function(time) {
	var seconds = (time - this.lastTime) / 1000;
	this.lastTime = time;
	if (seconds < 0.2) this.callback(seconds);
		requestAnimationFrame(this.frame);
};

// var CIRCLE=Math.PI*2;
// var MOBILE=false;
// var display = document.getElementById('display');
// // var player = new Player(15.3, -1.2, Math.PI * 0.3);
// var map = new Map();
// var player = new Player(-10,-10, deg2rad(45));
// var controls = new Controls();
// var camera = new Camera(display, 320, Math.PI*0.4);
// var loop = new GameLoop();

// loop.start(function frame(seconds) {
// 	if(map.loaded){
// 		map.update(seconds);
// 		player.update(controls.states, map, seconds);
// 		camera.render(player, map);
// 	}else{
// 		console.log("Still loading")
// 	}
// });
var map = new Map();
