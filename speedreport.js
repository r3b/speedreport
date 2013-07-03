#!/usr/bin/env phantomjs
/**
 * PhantomJS-based web performance metrics collector
 *
 * Usage:
 *  ./phantomas.js
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
    speedreport = require('./core/speedreport'),
    time=Date.now(),
    instance;
params.time=Date.now();
// run phantomas
//instance = new phantomas(params);

try {
    speedreport.run(params, function(data){
        console.log(data);
        phantom.exit();
    });
}
catch(ex) {
    console.log('speedreport v' + speedreport.version + ' failed with an error:');
    console.log(ex);

    phantom.exit(1);
}
