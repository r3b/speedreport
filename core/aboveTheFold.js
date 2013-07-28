

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
						/*}catch(e1){
							console.error('<!--', styleSheet.href, e1, '-->');
						}*/
					}
					sheetCount++;
				});
				return {sheets:sheetCount,rules:ruleCount, matched:matched};
			});
			var formatted = JSON.stringify(data, null, 4);
			page.render('capture.png');
			return (callback && "function" === typeof callback) ? callback(data, formatted) : data;
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