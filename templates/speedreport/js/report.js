function getFilename(url){
    var filename=/\/([^\/\?\&\#]+)([?#&].*)?$/.exec(url);
    if(filename){
      return filename[1];
    }
    return url;
}
function showTooltip(item){
  var tooltip=d3.select("div#tooltip")
  // var item=d.log.entries[i];
  var filename=getFilename(item.request.url);
  tooltip.html('<h4>'+filename+'</h4><br/>'+
          'contentType:&nbsp;<strong>'+item.mimeType+'</strong><br/>'+
          'blocking:&nbsp;<strong>'+item.timings.blocked+'ms</strong><br/>'+
          'latency:&nbsp;<strong>'+item.timings.wait+'ms</strong><br/>'+
          'download time:&nbsp;<strong>'+item.timings.receive+'ms</strong><br/>'+
          'total:&nbsp;<strong>'+item.timings.lifetime+'ms</strong><br/>'+
          'size:&nbsp;<strong>'+item.response.bodySize+' bytes</strong><br/>'
      )
}
function normalizeReportData(data){
  console.log(data);
  data.duration=data.log.pages[0].pageTimings.startTime-data.log.pages[0].pageTimings.endTime;
  data.blocked=0;
  data.latency=0;
  data.downloadTime=0;
  data.lifetime=0;
  data.pageLifetime=0;
  data.stacked=[];
  data.offsets=[];
  data.stackedProperties=['Blocking', 'Request Time', 'Latency', 'Download time', 'Lifetime'];
  data.stackedColors=['steelblue', 'orange', 'orangered', 'red', 'green'];
  data.assetCount=data.assets.length;
  data.mimeTypes={};
  data.mimeGroups={};
  data.log.entries.forEach(function(asset){
    asset.request.time=Date.parse(asset.request.time);
    asset.response.time=Date.parse(asset.response.time);
    asset.response.received=Date.parse(asset.response.received);
    asset.mimeType='UNKNOWN';
    asset.mimeGroup='UNKNOWN';
    var headers=asset.response.headers.filter(function(h){return h.name==='Content-Type';});
    if(headers && headers.length){
      if(headers[0].value && headers[0].value.length){
        asset.mimeType=headers[0].value;
      }
    }
    if(asset.mimeType && asset.mimeType.indexOf(';')!==-1){
      asset.mimeType=asset.mimeType.substring(0,asset.mimeType.indexOf(';'));
      asset.mimeGroup=asset.mimeType.substring(0,asset.mimeType.indexOf('/'));
    }
    asset.stacked=[
      asset.timings.blocked,
      asset.timings.send,
      asset.timings.wait,
      asset.timings.receive,
      asset.timings.lifetime
    ];
    asset.offsets=[
      0,
      asset.timings.blocked,
      asset.timings.blocked+asset.timings.send,
      asset.timings.blocked+asset.timings.send+asset.timings.wait,
      0
    ]
    data.stacked.push(asset.stacked);
    data.offsets.push(asset.offsets);
    if(asset.mimeType in data.mimeTypes){
      data.mimeTypes[asset.mimeType].push(asset);
    }else{
      data.mimeTypes[asset.mimeType]=[asset];
    }
  })
  return data;
}
function createBarGraph(data){
  function highlightProperty(d,i){
    if(!data.stayHighlighted){
      chart.selectAll('g.bargraph').style('opacity','0.1')
      chart.selectAll('g.bargraph:nth-child('+(i+1)+')').style('opacity','1')
    }
  }
  function unhighlightProperty(d,i){
    if(!data.stayHighlighted){
      chart.selectAll('g.bargraph').style('opacity','1')
    }
  }
  function highlightPropertyClick(d,i){
    data.stayHighlighted=!(data.stayHighlighted||false);
    highlightProperty(d,i);
  }
  function unhighlightPropertyClick(d,i){
    data.stayHighlighted=false;
    unhighlightProperty(d,i);
  }
  var w=600
      , thickness=25
      , h=thickness*data.assetCount
      , dist = d3.scale.linear().domain([0, data.log.entries.length]).range([0, h])//distribution
      , durations=data.log.entries.map(function(d){return d.timings.lifetime})
      , maxDuration= data.log.entries.reduce(function(p,c,i,a){return Math.max(p,c.timings.lifetime)},0)
      , legendWidth=w/5
      , mag = d3.scale.linear().domain([0, maxDuration]).rangeRound([1,w]).clamp(true)//magnitude
      , chart=d3
          .select('#barGraph')
          .html('')
          .append('svg')
          .attr("class", "chart")
          .attr("width", w)
          .attr("height", h+25)
          .on("click", unhighlightPropertyClick)
      , legend=d3
          .select('#barGraph')
          .append('svg')
          .attr("class", "legend")
          .attr("width", w)
          .attr("height", thickness)
      , properties=[4,3,2,1,0];
      d3.select('#barGraphContainer').style('display','block');
  legend
      .selectAll("rect")
      .data(properties)
      .enter()
      .append("rect")
      .attr("fill", function(d,i){return data.stackedColors[d]})
      .attr("x", function(d, i) { return i*legendWidth; })
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", thickness)
      .on("click", highlightPropertyClick)
      .on("mouseout", unhighlightProperty)
      .on("mouseover", highlightProperty)
  ;
  legend
      .selectAll('text')
      .data(properties)
      .enter()
      .append("text")
      .attr("x", function(d, i) { return i*legendWidth; })
      .attr("y", thickness)
      .attr("width", legendWidth)
      .attr("height", thickness)
      .attr("dx", ".35em") // padding-right
      .attr("dy", -6) // vertical-align: middle
      .attr("text-anchor", "start") // text-align: right
      .style('font-size','0.75em')
      .text(function(d,i){return data.stackedProperties[d]})
      .on("click", highlightPropertyClick)
      .on("mouseout", unhighlightProperty)
      .on("mouseover", highlightProperty)
  //each property has its own bar graph in its own layer
  properties.forEach(function(property){
    var _data=data.stacked.map(function(stack){return stack[property]});
    chart
        .append("g")
        .attr('class','bargraph')
        .attr('id',data.stackedProperties[property])
        .attr("transform", "translate(0,25)")
        .selectAll("rect")
        .data(_data)
        .enter()
        .append("rect")
        .on('mouseover',function(d,i){showTooltip(data.log.entries[i])})
        .style('opacity',0)
        .attr("fill", data.stackedColors[property])
        .attr("x", function(d,i){return mag(data.offsets[i][property])})
        .attr("y", function(d, i) { return dist(i); })
        .attr("width", function(d,i){return mag(d);})
        .attr("height", thickness)
        .transition()
        .delay(function(d,i){return data.log.entries[i].timings.blocked})
        .duration(function(d,i){return data.log.entries[i].timings.lifetime})
        .style('opacity',0.75)
  });
  //URLs
  chart
      .append("g")
      .attr('id','urls')
      .attr("transform", "translate(0,25)")
      .selectAll("text")
      .data(data.log.entries.map(function(x){return x.request.url}))
      .enter()
      .append("text")
      .attr("x", 0)
      .attr("y", function(d, i) { return dist(i+1); })
      .attr("height", thickness)
      .attr("dx", ".35em") // padding-right
      .attr("dy", -6) // vertical-align: middle
      .attr("text-anchor", "start") // text-align: right
      .style('font-size','0.75em')
      .text(function(d){return getFilename(d);})
      .on('mouseover',function(d,i){showTooltip(data.log.entries[i])})
  var ticks=chart
      .append("g")
      .attr("transform", "translate(0,25)")
  ticks.selectAll("line")
      .data(mag)
      .enter().append("line")
      .attr("x1", mag)
      .attr("x2", mag)
      .attr("y1", 0)
      .attr("y2", h)
      .style("stroke", "#ccc");
  //tick labels
  ticks.selectAll(".rule")
      .data(mag)
      .enter().append("text")
      .attr("class", "rule")
      .attr("x", mag)
      .attr("y", 0)
      .attr("dy", -3)
      .attr("text-anchor", "middle")
      .text(function(d,i){return d+'ms'});
  //Y-Axis
  ticks.append("line")
      .attr("y1", 0)
      .attr("y2", h)
      .style("stroke", "#000");
}
function createBubbleChart(data){
  var r=document.getElementById('contentBubbles').offsetWidth
    , layout_gravity = 0.12
    , damper = 0.1
    , center = {
        x: r / 2,
        y: r / 2
      }
    , dataBySize=data.log.entries.map(function(x){return x.response.bodySize})
    , dataByContentType=data.log.entries.map(function(x){return x.mimeType}).filter(function (e, i, arr) {
        return arr.lastIndexOf(e) === i;
      })
    , colorScale=d3.scale.category10().domain(dataByContentType).range()
    , mag = d3.scale.linear().domain([0, d3.max(dataBySize)]).rangeRound([5, r/4])//magnitude
    , magCharge = d3.scale.linear().domain([0, d3.max(dataBySize)]).rangeRound([-r/10, -r/25])//magnitude
    , svg=d3
      .select('#contentBubbles')
      .append('svg')
      .attr("class", "bubblechart")
      .attr("width", r)
      .attr("height", r)
    , force = d3.layout.force()
      .nodes(data.log.entries)
      .size([r, r])
      .linkDistance(10)
      .gravity(layout_gravity)
      .charge(function(d,i){return -Math.pow(mag(d.response.bodySize), 2.0)/8})
      .friction(0.9)
      .on("tick", tick)
    , nodes = force.nodes()
    , links = force.links()
    , node = svg.selectAll(".node")
    , link = svg.selectAll(".link");
    d3.select('#contentBubblesContainer').style('display','block');
  restart();
  function tick(e) {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node
        .attr("x", function(d){return d.x + (center.x - d.x) * (damper + 0.02) * e.alpha * 1.1})
        .attr("y", function(d){return d.y + (center.y - d.y) * (damper + 0.02) * e.alpha * 1.1})
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });

  }

  function restart() {
    link = link.data(links);
    link.enter().insert("line", ".node")
      .attr("class", "link");
    node = node.data(nodes);
    node.enter()
      .insert("circle", ".cursor")
      .attr("class", "node")
      .attr("r", function(d){return mag(d.response.bodySize)})
      .attr("fill", function(d,i){return colorScale[dataByContentType.indexOf(d.mimeType)]})
      .attr("stroke", 'black')
      .on('mouseover',function(d,i){showTooltip(data.log.entries[i])})
      // .on('mouseout',hideTooltip)
      .call(force.drag);
    force.start();
  }
}
var uuidValueRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isUUID(uuid) {
  return (!uuid)?false:uuidValueRegex.test(uuid);
}
var BASE='http://api.usergrid.com/rbridges/speedreport/reports';
var id=location.search.substring(1);
if(id){
  Ajax.get(BASE+'/'+id).then(function(err, response){
    var response_data=JSON.parse(response.responseText);
    response_data=response_data.entities[0];
    response_data.assets=response_data.log.entries;
    console.log(response_data.log);
    document.getElementById('title').innerText="Performance data for "+response_data.log.pages[0].id.replace(/https?:\/\//,'');
    var data=normalizeReportData(response_data)
      , tooltip = d3.select("#tooltip").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
      // , tooltipBubble = d3.select("#tooltip")//.append("div")
      //   .attr("class", "tooltipBubble")
      //   .style("opacity", 0);
    createBarGraph(data);
    createBubbleChart(data);
  })
}else{
  location.replace("index.html")
}
