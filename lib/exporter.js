exports.exportMarkup = function exportMarkup(data, selector, callback){
    var server = require('webserver').create();
    var service = server.listen(8080, function(request, response) {
        response.statusCode = 200;
        response.write(data);
        response.close();
    });
    var page = require('webpage').create(), svg="";
    page.onError = function (msg) {console.log(msg);};
    page.onConsoleMessage = function (msg) {console.log(msg);};

    page.open("http://localhost:8080", function(p){
        svg=page.evaluate(function(s){
            return document.querySelector(s).innerHTML;
        }, selector);
        if(callback && "function"===typeof callback)callback(svg);
    });
}