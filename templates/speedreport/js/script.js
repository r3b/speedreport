(function(){
  var reportUrl="http://api.usergrid.com/rbridges/speedreport/reports/?ql=order+by+created+desc&limit=25",
      list=document.getElementById('list'),
      next,
      previous,
      current="_",
      cursors=[],
      fetching=false,
      _next=document.getElementById('next'),
      _previous=document.getElementById('previous');
  function fetch(url){
    if(fetching)return;
    fetching=true;
    Ajax.get(url).then(function(err,data){
      var data=JSON.parse(data.responseText),
          reports=data.entities;
      next=data.cursor||null;
      list.innerHTML="";
      console.log(data);
      reports.forEach(function(report){
        var li=document.createElement('li'),
            a=document.createElement('a');
        a.href='report.html?'+report.uuid;
        a.innerText=report.log.pages[0].id;
        li.appendChild(a);
        list.appendChild(li);
      });
      if(next){
        _next.style.opacity="1";
      }else{
        _next.style.opacity="0.05";
      }
      if(previous){
        _previous.style.opacity="1";
      }else{
        _previous.style.opacity="0.05";
      }
      console.log(previous, current, next);
      fetching=false;
    });
  }
  fetch(reportUrl);
  _next.addEventListener("click", function(){
    if(!next)return;
    cursors.push(previous);
    previous=current;
    current=next;
    fetch(reportUrl+"&cursor="+current)
  });
  _previous.addEventListener("click", function(){
    if(!previous)return;
    current=previous;
    previous=cursors.pop();
    next=null;
    fetch(reportUrl+"&cursor="+current)
  });
}());
