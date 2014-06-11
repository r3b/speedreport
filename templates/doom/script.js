var CIRCLE = Math.PI * 2;
var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)

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
function createImageCanvas(src){
	var canvas = document.createElement('canvas');
	canvas.width=1024;
	canvas.height=1024;
	var context = canvas.getContext('2d');
	var imageObj = new Image();
	imageObj.onload = function() {
		context.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, 0, 0, 1024, 1024)
	};
	imageObj.src = src;
	return canvas.toDataURL(); 
}

function Bitmap(src, width, height) {
	this.image = new Image();
	// this.image.src = createImageCanvas(src);
	this.image.src = src;
	this.width = this.image.width||width;
	this.height = this.image.height||height;
}

function Player(x, y, direction) {
	this.x = x;
	this.y = y;
	this.direction = direction;
	this.weapon = new Bitmap('phantomjs.png', 100, 105);
	this.paces = 0;
}

Player.prototype.rotate = function(angle) {
	this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
};

Player.prototype.walk = function(distance, map) {
	var dx = Math.cos(this.direction) * distance;
	var dy = Math.sin(this.direction) * distance;
	if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
	if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
	this.paces += distance;
};

Player.prototype.update = function(controls, map, seconds) {
	if (controls.left) this.rotate(-Math.PI * seconds);
	if (controls.right) this.rotate(Math.PI * seconds);
	if (controls.forward) this.walk(3 * seconds, map);
	if (controls.backward) this.walk(-3 * seconds, map);
};

function Map(size) {
	this.size = size;
	this.wallGrid = new Uint8Array(size * size);
	// this.skybox = new Bitmap('Atl_skyline_from_Piedmont_Park.jpg', 4000, 1290);
	this.skybox = new Bitmap(generateImage("#ffffff"), 1024, 1024);//new Bitmap('CityPan-Flat-Grassy-More.jpg', 4000, 1290);
	this.wallTextureTypes=[
		new Bitmap('html5.png', 600, 517),
		new Bitmap('css3.png', 1024, 1024),
		new Bitmap('js.png', 1052, 1052),
		new Bitmap('other.gif', 500, 500),
	];
	this.wallTextures=Array.apply(0, Array(size * size)).map(function (x, y) { return 3 });
	this.light = 0;
}

Map.prototype.get = function(x, y) {
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
	return this.wallGrid[y * this.size + x];
};

Map.prototype.randomize = function() {
	for (var i = 0; i < this.size * this.size; i++) {
	  this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
	}
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
	  var dx = cos < 0 ? shiftX : 0;
	  var dy = sin < 0 ? shiftY : 0;
	  step.height = self.get(step.x - dx, step.y - dy);
	  step.distance = distance + Math.sqrt(step.length2);
	  if (shiftX) step.shading = cos < 0 ? 2 : 0;
	  else step.shading = sin < 0 ? 2 : 1;
	  step.offset = offset - Math.floor(offset);
	  return step;
	}
};

Map.prototype.update = function(seconds) {
	if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
	else if (Math.random() * 5 < seconds) this.light = 2;
};
Map.prototype.getTextureByMimetype = function(mimetype){
	var texture=3;
	switch(mimetype){
		case "application/x-javascript":
		case "application/javascript":
		case "text/javascript":
			texture=2;
			break;
		case "text/css":
			texture=1;
			break;
		case "text/html":
			texture=0;
			break;
		default:
			break;
	}
	return texture;
}
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
	this.drawSky(player.direction, map.skybox, map.light);
	this.drawColumns(player, map);
	this.drawWeapon(player.weapon, player.paces);
};

Camera.prototype.drawSky = function(direction, sky, ambient) {
	var width = this.width * (CIRCLE / this.fov);
	var left = -width * direction / CIRCLE;

	this.ctx.save();
	this.ctx.drawImage(sky.image, left, 0, width, this.height);
	if (left < width - this.width) {
	  this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
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
	this.ctx.drawImage(weapon.image, left, top, weapon.width * this.scale, weapon.height * this.scale);
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
	var ctx = this.ctx;
	var texture = map.wallTextureTypes[map.wallTextures[column]];
	var left = Math.floor(column * this.spacing);
	var width = Math.ceil(this.spacing);
	var hit = -1;

	while (++hit < ray.length && ray[hit].height <= 0);

	for (var s = ray.length - 1; s >= 0; s--) {
	  var step = ray[s];
	  // var rainDrops = Math.pow(Math.random(), 3) * s;
	  // var rain = (rainDrops > 0) && this.project(0.1, angle, step.distance);

	  if (s === hit) {
	    var textureX = Math.floor(texture.width * step.offset);
	    var wall = this.project(step.height, angle, step.distance);

	    ctx.globalAlpha = 1;
	    ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);
	    
	    ctx.fillStyle = '#000000';
	    ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
	    ctx.fillRect(left, wall.top, width, wall.height);
	  }
	  
	  // ctx.fillStyle = '#ffffff';
	  // ctx.globalAlpha = 0.15;
	  // while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
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
function generateImage(color){
	var canvas = document.createElement('canvas');
	canvas.width=1024;
	canvas.height=1024;
	var context = canvas.getContext('2d');
    context.globalAlpha = 0.75;
    context.fillStyle = color;
    context.fillRect(0, 0, 1024, 1024);
    context.fill();
	return canvas.toDataURL();  
}
function getColorByMimetype(mimetype){
	mimetype=mimetype.replace(/;.*/,'');
	var color;
	switch(mimetype){
		case "application/x-javascript":
		case "application/javascript":
		case "text/javascript":
			color="#ff0000";
			break;
		case "text/css":
			color="#00ff00";
			break;
		case "text/html":
			color="#0000ff";
			break;
		default:
			color="#ffffff";
			break;
	}
	return color;

}
function getEntryTexture(entry){
	return generateImage(getColorByMimetype(entry.response.content.mimeType));
}
function deg2rad(deg){return deg*(Math.PI/180);}
function rad2deg(rad){return rad*(180/Math.PI);}
function point(a,r){return (function(a){return [r*Math.sin(a),r*Math.cos(a)]})(deg2rad(a));}
function distance(a,b){return Math.sqrt(Math.abs(a[0],b[0])+Math.abs(a[1],b[1]));}
function midpoint(a,b){return [((a[0]+b[0])/2),((a[1]+b[1])/2)];}
function norm(x, min, max, count){return 1 + (x-min)*(count-1)/(max-min);}

var display = document.getElementById('display');
// var player = new Player(15.3, -1.2, Math.PI * 0.3);
var player = new Player(0,-10, Math.PI);
var map = new Map(32);
var controls = new Controls();
var camera = new Camera(display, 160, Math.PI*0.4);
var loop = new GameLoop();

var uuid=(location.hash)?location.hash.substring(1):"";
var reportUrl="http://api.usergrid.com/rbridges/spooky/reports/"+uuid;
Ajax.get(reportUrl).then(function(err,data){

	var data=JSON.parse(data.responseText);
	var report=data.entities.pop();
	var times=report.log.entries.map(function(x){
		return x.time;
	});
	var timeSeries=times.reduce(function(p,c){
		if(p.max){
			p.max=Math.max(p.max,c);
		}else{
			p.max=c;
		}
		if(p.min){
			p.min=Math.min(p.min,c);
		}else{
			p.min=c;
		}
		p.count++;
		return p;
	},{max:null,min:null,count:0});
	var timeNorm=times.map(function(x){
		return norm(x,timeSeries.min,timeSeries.max,12);
	})
	report.log.entries.forEach(function(entry, i){
		var p1=point(45, timeNorm[i]);
		var x = p1[0];
		var y = p1[1];
		var pt= Math.round((y* map.size)+x);
		while((map.wallGrid[pt]>0)){pt+=Math.cos(player.direction);}
		map.wallGrid[pt]=1;
		map.wallTextures[pt]=map.getTextureByMimetype(entry.response.content.mimeType.replace(/;.*/,''));
		console.log(i,timeNorm[i],x,y,pt, map.wallGrid[pt], entry.request.url);
	});
	for(var i=0;i<map.wallGrid.length;i+=map.size){
		for (var j=0,line=""; j<map.size;j++){
			line+=map.wallGrid[i+j].toString();
		}
		console.log(line);
	}
	loop.start(function frame(seconds) {
		map.update(seconds);
		player.update(controls.states, map, seconds);
		camera.render(player, map);
	});

})
