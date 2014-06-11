var fs = require('fs')
    , page = require('webpage').create()
    , whiskers = require('../lib/modules/whiskers');
if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}
function getHeaderValue(headers, headerName){
    var matchingHeaders=headers.filter(function(h){return h.name===headerName});
    return (matchingHeaders && matchingHeaders.length)?matchingHeaders[0].value:null;
}
function headerISODateToSeconds(headers, headerName){
    var value=getHeaderValue(headers, headerName)
    return (value)?Date.parse(value):null;
}
function getMaxAge(headers){
    var value=getHeaderValue(headers, 'Cache-Control')
        , matches=/max-age=(\d+)/.exec(value);
    return (matches && matches.length)? parseInt(matches[1]):null;

}
function createHAR(address, title, startTime, endTime, resources){
    var startTimeSeconds=Date.parse(startTime);
    var endTimeSeconds=Date.parse(endTime);
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply,
            startTimeSeconds = Date.parse(startTime);
        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
        }

        entries.push({
            startedDateTime: request.time.toISOString(),
            time: endReply.time - request.time,
            request: {
                method: request.method,
                url: request.url,
                _domain: /^\w+:\/\/([a-z0-9\-\.]+)/.exec(request.url)[1],
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            comments: {//rb
                lastModified:headerISODateToSeconds(endReply.headers, 'Last-Modified'),
                expires:headerISODateToSeconds(endReply.headers, 'Expires'),
                serverRequestDate:headerISODateToSeconds(endReply.headers, 'Date'),
                maxAge:getMaxAge(endReply.headers),
                isGzipped:endReply.headers.some(function(h){return (h.name==='Content-Encoding' && h.value==='gzip')}),
                mimeType:(endReply.contentType)?endReply.contentType.substring(0,(endReply.contentType.indexOf(';')===-1)?endReply.contentType.length :endReply.contentType.indexOf(';')):"",
                mimeGroup:(endReply.contentType)?endReply.contentType.substring(0,endReply.contentType.indexOf('/')):""
            },
            timings: {
                blocked: request.time - startTimeSeconds, //rb
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - request.time,
                receive: endReply.time - startReply.time,
                ssl: -1,
                lifetime: endReply.time - startTimeSeconds//rb
            },
            stackedTimings: {//rb
                blocked: request.time - startTimeSeconds, //rb
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - startTimeSeconds,
                receive: endReply.time - startTimeSeconds,
                ssl: -1,
                lifetime: endReply.time - startTimeSeconds//rb
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2 (+rb extensions)',
            creator: {
                name: "PhantomJS",
                version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
            },
            pages: [{
                startedDateTime: startTime.toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    startTime:startTimeSeconds,
                    endTime:endTimeSeconds,
                    totalTime:entries[entries.length-1].stackedTimings.lifetime,
                    onLoad: endTimeSeconds - startTimeSeconds
                }
            }],
            entries: entries
        }
    };
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
function run(params, callback){
    var page = require('webpage').create();

    page.address = params.url;
    page.resources = [];

    page.onLoadStarted = function () {
        page.startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        page.resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            page.resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            page.resources[res.id].endReply = res;
        }
    };
    page.onError = function(msg){console.log("[ERROR]",msg)};
    page.open(page.address, function(status) {
        //console.log("content: ",page.content);
        page.endTime = new Date();

        var har, data, formatted;
        page.title = page.evaluate(function () {
            return document.title;
        });
        har = createHAR(page.address, page.title, page.startTime, page.endTime, page.resources);
        data=JSON.stringify(har, null, 4);
        formatted=format('templates/netsniff.html', {DATA:data});
        return (callback && "function" === typeof callback)?callback(data, formatted):data;
    });
}
exports.version="0.2.0";
exports.run=run;
