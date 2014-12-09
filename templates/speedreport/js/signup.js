(function(){
  var clicked=false,
      button=document.getElementById('signup');
  function handler(e) {
    e.cancelBubble=true;
    e.stopPropagation();
    if(clicked)return;
    clicked=true;
      var url=document.getElementById('url').value,
          email=document.getElementById('email').value;
      console.log("CLICK", url,email);
      if(url.length>0 && email.length>0){
        Ajax.get("http://ec2-54-90-19-214.compute-1.amazonaws.com/test?url="+encodeURIComponent(url)+"&email="+encodeURIComponent(email)).then(function(err,data){
          var panel=button.parentElement;
          panel.innerHTML="<p>Thanks! We'll email you soon!</p>";
        });
      }else{
        (function(){clicked=false;}())
      }
    return false;
  }
  button.addEventListener("click", handler);
}());
