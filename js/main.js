// wrap everything in a self-executing anonymous function to move to local scope
(function(){


//pseudo-global variables
var attrArray = ["Civilian Labor Force", "Employment", "Unemployment", "Unemployment Rate(percent)", "College Graduate(percent)"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoConicEqualArea()
        .center([-105.6, 38.8])
        .rotate([0, 0, 0])
        .parallels([-34, 35])
        .scale(4500)
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
            var usStates = topojson.feature(us, us.objects.usstateboundaries),
            coloradoCounties = topojson.feature(colorado, colorado.objects.coloradocountyboundaries).features;

            //add us states to map
            var states = map.append("path")
            .datum(usStates)
            .attr("class", "states")
            .attr("d", path);
        

            //join csv data to GeoJSON enumeration units
            coloradoCounties = joinData(coloradoCounties, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //Example 1.3 line 24...add enumeration units to the map
            setEnumerationUnits(coloradoCounties, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        };
}; //end of setMap()

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#91C4D9",
        "#4B8CA6",
        "#245C73",
        "#0A3140",
        "#021826",
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};


//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

function joinData(coloradoCounties, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvCounty = csvData[i]; //the current region
        var csvKey = csvCounty.LABEL; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<coloradoCounties.length; a++){
        
            var geojsonProps = coloradoCounties[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.LABEL; //the geojson primary key
        
            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
            
                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvCounty[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return coloradoCounties;
};
     

function setEnumerationUnits(coloradoCounties, map, path, colorScale){
    //add CO counties to map
    var counties = map.selectAll(".counties")
        .data(coloradoCounties)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "counties " + d.properties.LABEL;
        })
        .attr("d", path)
        .style("fill", function(d){
            // return colorScale(d.properties[expressed]);
            return choropleth(d.properties, colorScale);
        });
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, 390000]);

    //Example 2.4 line 8...set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.LABEL;
        })
        .attr("width", chartWidth / csvData.length - 3)
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]))+ topBottomPadding;
        })
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });


    //below Example 2.8...create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 50)
        .attr("y", 40)
        .attr("class", "chartTitle")
        // .text("Employment in CO " + expressed[3] + " in each county");

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale)
        // .orient("left");

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData) {
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });

        console.log(attrOptions);
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
    };

})(); //last wrap