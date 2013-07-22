function run(params, callback){
    var page = require('webpage').create();
    page.onConsoleMessage = function (msg) {console.log(msg);};
    page.open(params.url, function(status) {
        var pageInfo=page.evaluate(function(){
            var sheetCount=0,ruleCount=0, unmatchedRuleCount=0, unmatched=[], matched=[], matches;
            Array.prototype.slice.apply(document.styleSheets).forEach(function(styleSheet){
                if(styleSheet.cssRules){
                    try{
                        Array.prototype.slice.apply(styleSheet.cssRules).forEach(function(rule){
                            matches=document.querySelectorAll(rule.selectorText);
                            //console.log(rule.selectorText, matches);
                            try{
                                if(matches && matches.length){
                                    matched.push({rule:rule.selectorText, matches:matches.length||0, stylesheet:styleSheet.href||'embedded'})
                                }else{
                                    unmatchedRuleCount++;
                                    unmatched.push({rule:rule.selectorText, matches:0, stylesheet:styleSheet.href||'embedded'})
                                }
                            }catch(e){
                                //console.error('<!--', rule.selectorText, e, '-->');
                            }
                            ruleCount++;
                        })
                    }catch(e1){
                        //console.error('<!--', styleSheet.href, e1, '-->');
                    }
                }
                sheetCount++;
            });
            return {sheets:sheetCount,rules:ruleCount, unmatched:unmatched, matched:matched}
        });
        data=JSON.stringify(pageInfo, undefined, 4)
        //console.log(data);
        formatted=format('templates/cssCheck.html', {DATA:data});
        //console.log(formatted);
        return (callback && "function" === typeof callback)?callback(data, formatted):data;
    });
}
function format(file, data){
    var fs = require('fs')
        , whiskers = require('../lib/modules/whiskers')
        , template;
    if(!fs.exists(file)){
        console.error("Unable to find template: %s", file);
        phantom.exit();
    }else{
        template=html = fs.read(file);
    }
    return whiskers.render(template, data);
}



exports.version="0.0.1";
exports.run=run;