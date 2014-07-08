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
// run phantomas
//instance = new phantomas(params);

try {
    speedreport.run(params, function(data, formatted){
        // var data=JSON.parse(data);
        // var name=data.log.pages[0].id;
        // name=name.replace(/^https?:\/\//,'');
        // data.name=name+'_'+params.time;
        data.type='report';
        // console.log(data);
        // phantom.exit();
        // console.log(data.name);
        Ajax.post('http://api.usergrid.com/rbridges/speedreport/reports', data).then(function(err, response){
            var response=JSON.parse(response.responseText);
            if(response.error){
                console.error(response.error_description);
            }else{
                console.log("Data posted successfully to http://api.usergrid.com/rbridges/speedreport"+response.entities[0].metadata.path)
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
