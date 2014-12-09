    var Promise = require('./promise.js').Promise;

    Function.prototype.bind=(function(){}).bind||function(a,b){b=this;return function(){b.apply(a,arguments)}}

    function partial(){
        var self=this;
        var args = Array.prototype.slice.call(arguments);
        var fn=args.shift();
        console.log(args);
        return function(){
            var args2 = args.concat(Array.prototype.slice.call(arguments));

            return fn.apply(self,args2)
        }
    }
    function Ajax() {
        function encode(data) {
            var result = "";
            if (typeof data === "string") {
                result = data;
            } else {
                var e = encodeURIComponent;
                for (var i in data) {
                    if (data.hasOwnProperty(i)) {
                        result += '&' + e(i) + '=' + e(data[i]);
                    }
                }
            }
            return result;
        }
        function request(m, u, d) {
            console.log("REQUEST", JSON.stringify(arguments));
            var p = new Promise(), timeout;
            (function(xhr) {
                xhr.onreadystatechange = function() {
                    this.readyState ^ 4 || (clearTimeout(timeout), p.done(null, this));
                };
                xhr.onerror=function(response){
                    clearTimeout(timeout);
                    p.done(response, null);
                }
                xhr.oncomplete=function(response){
                    clearTimeout(timeout);
                }
                console.log(m, u);
                xhr.open(m, u);
                if (d) {
                    if("object"===typeof d){
                        d=JSON.stringify(d);
                    }
                    console.log("Data length:",d.length);a
                    xhr.setRequestHeader("Content-Type", "application/json");
                    xhr.setRequestHeader("Accept", "application/json");
                }
                timeout = setTimeout(function() {
                    xhr.abort();
                    p.done("API Call timed out.", null)
                }, 30000);
                //TODO stick that timeout in a config variable
                xhr.send(encode(d));
            }(new XMLHttpRequest()));
            return p;
        };
        this.request=request;
        this.get = partial(request,'GET');
        this.post = partial(request,'POST');
        this.put = partial(request,'PUT');
        this.delete = partial(request,'DELETE');
    }
exports.Ajax = new Ajax();
exports.version="0.2.0";
