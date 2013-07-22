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
    exporter = require('./lib/exporter'),
    params = require('./lib/args').parse(args),
    cssCheck = require('./core/cssCheck.js');

if(params.url===undefined){
    console.warn("USAGE: phantomjs --web-security=false cssCheck.js --url=<http://your-site.com/index.html> --format=<JSON|HTML|SVG>");
    phantom.exit();    
}
if(params.format===undefined){
    params.format="html";
}
try {
    cssCheck.run(params, function(data, formatted){
        switch(params.format.toLowerCase()){
            case 'svg':
                exporter.exportMarkup(formatted, '#container', function(data){
                    console.log(data);
                    phantom.exit();
                });
                break;
            case 'json':
                console.log(data);
                phantom.exit();
                break;
            default:
                exporter.exportMarkup(formatted, 'html', function(data){
                    console.log(data);
                    phantom.exit();
                });
                break;
        }
    });
}
catch(ex) {
    console.log('cssCheck v' + cssCheck.version + ' failed with an error:');
    phantom.exit(1);
}
