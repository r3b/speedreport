/**
 * PhantomJS-based tool to determine CSS used above the fold
 *
 * Usage:
 *  phantomjs --web-security=false ./aboveTheFold.js
 *    --url=<page to check>
 *    [--format=json|html]
 *
 * @version 0.0.1
 */

// parse script arguments
var args = require('system').args,
    params = require('./lib/args').parse(args),
    aboveTheFold = require('./core/aboveTheFold');

//var visible = require('./core/visible.js');
if(params.url===undefined){
    console.warn("USAGE: phantomjs --web-security=false aboveTheFold.js <http://your-site.com/index.html> --width=1280 --height=1024");
    phantom.exit();    
}
try {
	("height" in params)||(params.height=1024);
	("width" in params)||(params.width=1280);
	aboveTheFold.run(params, function(data, formatted){
	    console.log("//total styles: "+data.matched.length);
	    data.matched.forEach(function(rule){
	    	console.log("//from: "+rule.stylesheet)
	    	console.log(rule.text);
	    });
	    phantom.exit();
	});
}catch(ex) {
    console.log('aboveTheFold v' + aboveTheFold.version + ' failed with an error:');
    console.log(ex);

    phantom.exit(1);
}