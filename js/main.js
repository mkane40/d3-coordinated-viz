//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([-105.6, 38.8])
        .rotate([-2, 0, 0])
        .parallels([43, 62])
        .scale(2500)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/unemployment_2016_raw.csv") //load attributes from csv
        .defer(d3.json, "data/UsStates.topojson") //load background spatial data
        .defer(d3.json, "data/ColoradoCounties.topojson") //load choropleth spatial data
        .await(callback);

        function callback(error, csvData, us, colorado){
            //translate europe TopoJSON
            var usStates = topojson.feature(us, us.objects.us-state-boundaries),
            coloradoCounties = topojson.feature(colorado, colorado.objects.colorado-county-boundaries).features;

            console.log(usStates);

            //add us states to map
        var states = map.append("path")
            .datum(usStates)
            .attr("class", "states")
            .attr("d", path);

        //add CO counties to map
        var counties = map.selectAll(".counties")
            .data(coloradoCounties)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "counties " + d.properties.County;
            })
            .attr("d", path);
    };










};