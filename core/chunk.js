

function run(params, callback) {
	var page = require('webpage').create();

	page.onConsoleMessage = function(msg) {
		console.log(msg);
	};
	page.open(params.url, function(status) {
		page.viewportSize = { width: params.width, height: params.height };
		page.includeJs("http://fasterness.com/includes/visible.js", function(){
		   var data =page.evaluate(function(){
				var elements=getElementsNotInViewport();
				elements.forEach(function(element){
					if (element.parentNode) element.parentNode.removeChild(element);
				});
				var sheetCount=0,ruleCount=0, matched=[], matches;
				Array.prototype.slice.apply(document.styleSheets).forEach(function(styleSheet){
					if(styleSheet.cssRules){
						//try{
							Array.prototype.slice.apply(styleSheet.cssRules).forEach(function(rule){
								try{
									matches=document.querySelectorAll(rule.selectorText);
									//console.log(rule.selectorText, matches);
									if(matches && matches.length){
										matched.push({rule:rule.selectorText, text:rule.cssText, matches:matches.length||0, stylesheet:styleSheet.href||'embedded'})
									}
									ruleCount++;
								}catch(e){
									console.error('<!--', rule.selectorText, rule.cssText, e, '-->');
								}
							})
					}
					sheetCount++;
				});
        //remove style tags
        var tags=document.querySelectorAll("style");
        Array.prototype.slice.call(tags, 0).forEach(function(t, i){
          var p = t.parentNode;
          p.removeChild(t);
          t=null;

        })
        console.error("LINK TAGS ",tags.length);
        //remove linked stylesheets
       var tags=document.querySelectorAll("link[rel='stylesheet']");

        Array.prototype.slice.call(tags, 0).forEach(function(t, i){
          var p = t.parentNode;
          p.removeChild(t);
          t=null;

        })
        var style=document.createElement("style");
        document.head.appendChild(style);
        matched.forEach(function(rule){
          style.innerText+=rule.text;
        });
        console.error("STYLE TAGS ",tags.length);
        var scripts=document.querySelectorAll("script");
        Array.prototype.slice.call(scripts, 0).forEach(function(s, i){
          var p=s.parentNode;
          p.removeChild(s);
          document.body.appendChild(s);
        });
        console.log(document.head.innerHTML)
        console.log(document.body.innerHTML)
				return {sheets:sheetCount,rules:ruleCount, matched:matched};
			});
			page.render('capture.png');
			return (callback && "function" === typeof callback) ? callback(data, null) : data;
		});
		//phantom.exit(1);
	});
}

function format(file, data) {
	var fs = require('fs'),
		whiskers = require('../lib/modules/whiskers'),
		template;
	if (!fs.exists(file)) {
		console.error("Unable to find template: %s", file);
		phantom.exit();
	} else {
		template = html = fs.read(file);
	}
	return whiskers.render(template, data);
}

exports.version = "0.0.1";
exports.run = run;
