/**
 * PhantomJS-based CSS metrics collector
 *
 * Usage:
 *  phantomjs --web-security=false ./cssCheck.js
 *    --url=<page to check>
 *    [--format=json|html]
 *
 * @version 0.0.1
 */

// parse script arguments
var args = require('system').args,
    params = require('./lib/args').parse(args),
    cssCheck = require('./core/cssCheck.js');

if(params.url===undefined){
    console.warn("USAGE: phantomjs --web-security=false cssCheck.js <http://your-site.com/index.html>")
    phantom.exit();    
}
try {
    cssCheck.run(params, function(data, formatted){
        console.log(formatted);
        phantom.exit();
    });
}
catch(ex) {
    console.log('cssCheck v' + cssCheck.version + ' failed with an error:');
    console.log(ex);

    phantom.exit(1);
}
