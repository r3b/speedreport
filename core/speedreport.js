var fs = require('fs')
    , page = require('webpage').create()
    , whiskers = require('../lib/modules/whiskers');
function run(params, callback){
    var t=Date.now()
        , pageInfo={url:params.url, assets:[]}
        , requests={}
        , responses={};
    page.onResourceRequested = function (r) {
        if(r)requests[r.id]=r;
    };
    page.onResourceReceived = function (r) {
        if(r && !(r.id in responses)){
            responses[r.id]=r;
        } else {
            for(var i in responses[r.id]){
                if(responses[r.id].hasOwnProperty(i) && !(i in r)){
                    r[i]=responses[r.id][i];
                }
            }
            r.received=responses[r.id].time;
            pageInfo.assets.push({
                request:requests[r.id],
                response:r
            });
        }
    };
    page.onError=function(){
        console.error("error");
        console.dir(arguments);
    }
    page.onLoadFinished = function(status) {
        // trigger this only once
        if (this.onLoadFinishedEmitted) {
            return;
        }
        this.onLoadFinishedEmitted = true;

        var data, formatted;
        pageInfo.requestTime=params.time;
        pageInfo.responseTime=Date.now();
        return (callback && "function" === typeof callback)?callback(pageInfo):pageInfo;
    };
    page.open(params.url);
}
function format(file, data){
    var template;
    if(!fs.exists(file)){
        console.error("Unable to find template: %s", file);
        phantom.exit();
    }else{
        template=html = fs.read(file);
    }
    return whiskers.render(template, data);
}
function save(data){
    //http://api.usergrid.com/rbridges/speedreport/reports
}
function printToFile(filename, data) {
    var f
        , g
        , html
        , myfile=filename+'.html'
        , fileid
        , myjson=filename+'.js'
        , jspath
        , keys = []
        , values = [];

    /*if(!phantom.args[1]){
        fileid = phantom.args[0].replace('http://','').replace('https://','').replace(/\//g,'');
        fileid = fileid.split('?')[0];
        myjson = 'speedreports/' + fileid + '.js';
        myfile = 'speedreports/' + fileid + '.' + extension;
    }else{
        fileid = phantom.args[1];
        myjson = 'speedreports/' + fileid + '.js';
        myfile = 'speedreports/' + fileid + '.' + extension;
    }*/

    if(myfile!==null){
        try {
            data = "var reportdata = " + data + ";";
            if(fs.exists(myfile)){
                fs.remove(myfile);
            }
            if(!fs.exists('templates/speedreport.html')){
                console.error("Unable to find template: %s", 'templates/speedreport.html');
                phantom.exit();
            }else{
                html = fs.read('templates/speedreport.html');
            }
            html=html.replace('{{REPORT_DATA_URI}}', fileid + '.js');
            if(phantom.args[1]){
                html=html.replace('{{url}}', phantom.args[1]);
            }else{
                html=html.replace('{{url}}', phantom.args[0]);
            }

            f = fs.open(myfile, "w");
            f.write(html);
            f.flush();
            f.close();
        } catch (e) {
            console.log("//problem writing to file",e);
            console.log(html);
        }
    }

    try {
        g = fs.open(myjson, "w");
        g.write(data);
        g.flush();
        g.close();
    } catch (e) {
        console.error("problem writing to file",e);
    }
}
exports.version="0.2.0";
exports.run=run;
