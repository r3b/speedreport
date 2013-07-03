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
        switch(status) {
            case 'success':
                try {
                    //pageInfo.requestTime=Date.parse(pageInfo.assets.filter(function(x){return (x.request.id==1)})[0].request.time);
                    data=JSON.stringify(pageInfo, undefined, 4)
                    //printToFile('speedreports/test', data);
                    formatted=format('templates/speedreport.html', {DATA:data});
                }catch(e){
                    console.error("error writing to file ",e);
                }
                break;

            default:
                console.error('/* FAIL to load the address */');
                break;
        }
        return (callback && "function" === typeof callback)?callback(formatted):data;
    };
    page.open(params.url);
}
function normalizeReportData(data){
    //data.requestTime=data.assets.filter(function(x){return (x.request.id==1)})[0].request.time;
    data.duration=data.responseTime-data.requestTime;
    if(data.duration<0){
        data.duration=0;
    }
    data.blocked=0;
    data.latency=0;
    data.downloadTime=0;
    data.lifetime=0;
    data.pageLifetime=0;
    data.stacked=[];
    data.stackedProperties=['Blocking', 'Latency', 'Download time', 'Lifetime'];
    data.stackedColors=['steelblue', 'yellow', 'red', 'green'];
    data.assetCount=data.assets.length;
    data.mimeTypes={};
    data.mimeGroups={};
    data.assets.forEach(function(asset){
        asset.request.time=Date.parse(asset.request.time);
        asset.response.time=Date.parse(asset.response.time);
        asset.response.received=Date.parse(asset.response.received);
        asset.blocked=asset.request.time-data.requestTime;
        asset.latency=asset.response.received-asset.request.time;
        asset.latencyStacked=asset.blocked+asset.latency;
        asset.downloadTime=asset.response.time-asset.response.received;
        asset.downloadTimeStacked=asset.latencyStacked+asset.downloadTime;
        asset.lifetime=asset.response.time-asset.request.time;
        asset.pageLifetime=asset.response.time-data.requestTime;
        asset.stacked=[asset.blocked,asset.latencyStacked,asset.downloadTimeStacked, asset.pageLifetime];
        asset.mimeType=asset.response.contentType;
        if(asset.mimeType.indexOf(';')!==-1){
            asset.mimeType=asset.response.contentType.substring(0,asset.response.contentType.indexOf(';'));
        }
        asset.mimeGroup=asset.mimeType.substring(0,asset.mimeType.indexOf('/'));
        data.blocked+=asset.blocked;
        data.latency+=asset.latency;
        data.downloadTime+=asset.downloadTime;
        data.lifetime+=asset.lifetime;
        data.pageLifetime+=asset.pageLifetime;
        data.stacked.push(asset.stacked);
        if(asset.mimeType in data.mimeTypes){
            data.mimeTypes[asset.mimeType].push(asset);
        }else{
            data.mimeTypes[asset.mimeType]=[asset];
        }
    })
    return data;
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