// wrap everything in a self-executing anonymous function to move to local scope
(function(){
    //pseudo-global variables
    var attrArray = ["Melanoma of the Skin", "Lung & Bronchus", "Prostate", "Breast", "Colorectal"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 50,
        rightPadding = 10,
        topBottomPadding = 4,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        chartTranslate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([500,0]);

        //title frame dimensions
    var headerWidth = window.innerWidth * 0.425,
        headerHeight = 60;
        headertopBottomPadding = 10,
        headerInnerWidth = headerWidth - leftPadding - rightPadding,
        headerInnerHeight = headerHeight - headertopBottomPadding * 2

        
//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //style container

    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom()
        .scaleExtent([1,4])
        .translateExtent([[0,0],[width,height]])
        .on("zoom", function () {
            map.attr("transform", d3.event.transform)
    }))
        .append("g");
    

    //create  projection centered on France
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
        .defer(d3.csv, "data/coloradoCancerTypesByCounty_2014_18.csv") //load attributes from csv
        .defer(d3.json, "data/UsStates.topojson") //load background spatial data
        .defer(d3.json, "data/ColoradoCounties.topojson") //load choropleth spatial data
        .await(callback);

        function callback(error, csvData, us, colorado){
            //translate TopoJSON
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

            //enumeration units to the map
            setEnumerationUnits(coloradoCounties, map, path, colorScale, choropleth);

            //add coordinated visualization to the map
            setChart(csvData, colorScale, choropleth);
            createDropDown(csvData, coloradoCounties);
            setTitle();
        };
}; //end of setMap()


//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#E0E9F2",
        "#C9E2F2",
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
    var clusters = ss.ckmeans(domainArray, 7);
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
        var csvCounty = csvData[i]; 
        var csvKey = csvCounty.LABEL; 

        for (var a=0; a<coloradoCounties.length; a++){
            var geojsonProps = coloradoCounties[a].properties; 
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
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    var desc = counties.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to create coordinated bar chart
function setChart(csvData, colorScale, choropleth){
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
        .attr("transform", chartTranslate);

    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.LABEL;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');



    //create vertical axis generator
    var yAxis = d3.axisLeft(yScale)

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", chartTranslate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", chartTranslate);

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
};

//create dropdown menu
function createDropDown(csvData){
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d})
        .text(function(d){ return d});
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
        .transition()
        .duration(500)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition()
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
    updateChart(bars, csvData.length, colorScale);
};


//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    
    //position bars
    bars.attr("x", function(d, i){
        return i * (chartInnerWidth / n) + leftPadding;
    })
    //size/resize bars
    .attr("height", function(d, i){
        return 465 - yScale(parseFloat(d[expressed]));
    })
    .attr("y", function(d, i){
        return yScale(parseFloat(d[expressed])) + topBottomPadding;
    })
    //color/recolor bars
    .style("fill", function(d){
        return choropleth(d, colorScale);
    });
    

};
    
 //function to highlight enumeration units and bars
 function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.LABEL)
        .style("stroke", "orange")
        .style("stroke-width", "2");
    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.LABEL)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel").remove();
};


//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + " Cancer</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.LABEL + "_label")
        .html(labelAttribute);
    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html("County: " + props.LABEL);
};

//function to move info label with mouse
function moveLabel(){
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth -10,
        y2 = d3.event.clientY + 25;
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    var y = d3.event.clientY < 75 ? y2 : y1;
    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};



// chart 
// here
// down
// credit d3-graph-gallery.com/graph/treemap_basic


// set the dimensions and margins of the graph
var margin = {top: 10, right: 10, bottom: 10, left: 10},
  width = 1400 - margin.left - margin.right,
  height = 100 - margin.top - margin.bottom;

// append the svg object to the body of the page
var svg = d3.select("body")
    .append("svg")
    .attr("class", "my_dataviz")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
  .attr("transform",
        "translate(" + margin.right + "," + margin.bottom + ")");

// Read data
d3.csv("/data/cancer_cases_2020.csv", function(data) {

  // stratify the data: reformatting for d3.js
  var root = d3.stratify()
    .id(function(d) { return d.name; })   
    .parentId(function(d) { return d.parent; })   
    (data);
  root.sum(function(d) { return +d.value })   // Compute the numeric value for each entity

  
  // The coordinates are added to the root object above
  d3.treemap()
    .size([width, height])
    .padding(4)
    (root)

  // use this information to add rectangles:
  svg
    .selectAll("rect")
    .data(root.leaves())
    .enter()
    .append("rect")
      .attr('x', function (d) { return d.x0; })
      .attr('y', function (d) { return d.y0; })
      .attr('width', function (d) { return d.x1 - d.x0; })
      .attr('height', function (d) { return d.y1 - d.y0; })
      .style("stroke", "grey")
      .attr("fill-opacity","0.8")
      .style("fill", "#245C73")

  // and to add the text labels
  svg
    .selectAll("text")
    .data(root.leaves())
    .enter()
    .append("text")
      .attr("x", function(d){ return d.x0+10})   
      .attr("y", function(d){ return d.y0+20})   
      .text(function(d){ return d.data.name + " - " + d.data.value + " Million"})
      .attr("font-size", "12px")
      .attr("fill", function(d){
        if (d.id == 'Breast') {return d.data.color}
        if (d.id == 'Lung') {return d.data.color}
        if (d.id == 'Prostate') {return d.data.color}
        if (d.id == 'Skin') {return d.data.color}
        if (d.id == 'Stomach') {return d.data.color}
        if (d.id == 'Colorectal') {return d.data.color}
      ;})
})

})(); //last wrap