#!/usr/bin/env phantomjs
/**
 * PhantomJS-based web performance metrics collector
 *
 * Usage:
 *  ./speedreport.js
 *    --url=<page to check>
 *    [--timeout=5]
 *    [--format=json|html]
 *    [--verbose]
 *    [--silent]
 *    [--modules=moduleOne,moduleTwo]
 *    [--user-agent='Custom user agent']
 *
 * @version 0.4
 */

// parse script arguments
var args = require('system').args,
    params = require('./lib/args').parse(args),
    speedreport = require('./core/netsniff.js'),
    time=Date.now(),
    instance;
var Promise = require('./core/promise.js').Promise;
var Ajax = require('./core/ajax.js').Ajax;
params.time=Date.now();
function usage(){
    console.error("Usage:\n\t./speedreport.js\n\t\t--url=<page to check>\n\t\t[--timeout=5]\n\t\t[--format=json|html]\n\t\t[--verbose]\n\t\t[--silent]\n\t\t[--modules=moduleOne,moduleTwo]\n\t\t[--user-agent='Custom user agent']");
    phantom.exit();
}
try {
    if(!params.url){
        console.error("You must provide a url");
        usage();
    }
    if(!/https?:\/\//.test(params.url)){
        console.error("the provided url is not valid");
        usage();
    }
    speedreport.run(params, function(data, formatted){
        if(data===null){
            console.error("Could not generate report.");
            usage();
        }
        data.type='report';
        var appname=params.app||params.appname||"speedreport";
        Ajax.post('http://api.usergrid.com/rbridges/'+appname+'/reports', data).then(function(err, response){
            var response=JSON.parse(response.responseText);
            if(response.error){
                console.error(response.error_description);
            }else{
                console.log("Data posted successfully to http://api.usergrid.com/rbridges/"+appname+response.entities[0].metadata.path)
            }
            phantom.exit();
        });
    });
}
catch(ex) {
    console.log('speedreport v' + speedreport.version + ' failed with an error:');
    console.log(ex);
    phantom.exit(1);
}
