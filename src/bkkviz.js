var grey = '#666',
    red = '#c9252c', // แดงชาติ
    pink = '#da3e7b', // ดอกบานเย็น
    yellow = '#f2be1a', // ธงทอง
    orange = '#f15a22', // เสน
    green = '#00a05b', // มรกต
    blue = '#0071ae', // ฟ้า
    purple = '#6950a1'; // ดอกอัญชัญ

var stamenLite = new L.StamenTileLayer('toner-lite');
var stamenLabels = new L.StamenTileLayer('toner-labels');
var map = L.map('map', {
  center: [13.75, 100.75],
  zoom: 11,
  layers: [stamenLite],
  scrollWheelZoom: false
}).on('viewreset', reset);

map.keyboard.disable();

var overlayMaps = { 'Map': stamenLite, 'Labels': stamenLabels };
L.control.layers(overlayMaps).addTo(map);

var popup = d3.select('#popup').append('div')
  .attr('class', 'popupContent')
  .classed('hidden', true);

function showPopup(x, y, text) {
  if(text) {
    popup.html(text);
  }
  popup.style('left', x + 16 + 'px');
  popup.style('top', y - 16 + 'px');
  popup.classed('hidden', false);
}

function hidePopup() {
  popup.classed('hidden', true);
}

var svg = d3.select(map.getPanes().overlayPane).append('svg')
  .attr('width', 300)
  .attr('height', 300);
var layer = svg.append('g')
  .attr('class', 'leaflet-zoom-hide');

function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

function projectCoordinate(c) {
  var point = map.latLngToLayerPoint(new L.LatLng(c[1], c[0]));
  return [point.x, point.y];
}

var transform = d3.geo.transform({point: projectPoint});
var path = d3.geo.path().projection(transform);
var districts;
var districtPaths, marketPoints;
var districtData, districtDataLookup;
var colorScales;

function r() {
  return Math.max((map.getZoom() - 10), 0) * 1.5 + 1;
}

function reset() {
  var bounds = path.bounds(districts);
  var topLeft = bounds[0];
  var bottomRight = bounds[1];

  svg.attr('width', bottomRight[0] - topLeft[0])
    .attr('height', bottomRight[1] - topLeft[1])
    .style('left', topLeft[0] + 'px')
    .style('top', topLeft[1] + 'px');

  layer.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');
  update();
}

function update() {
  districtPaths.attr('d', path);
  d3.select('.district-base path')
    .attr('d', path);
  d3.selectAll('circle.point')
    .attr('r', r)
    .attr('cx', function(d){return projectCoordinate(d.geometry.coordinates)[0];})
    .attr('cy', function(d){return projectCoordinate(d.geometry.coordinates)[1];})
    .style('stroke-width', r() * 2);
}

d3.queue()
  .defer(d3.json, 'bkkviz.json')
  .defer(d3.csv, 'dataByDistrict.csv')
  .await(function(error, topo, csv) {
    if (error) throw error;

    districtData = csv.map(function(row){
      Object.keys(row)
        .filter(function(d){return d!=='district';})
        .map(function(key){
          // parse numbers
          row[key] = +row[key];
          return row;
        })
        .filter(function(d){
          return d!=='ประชากร'
            && d!=='จำนวนคลอง'
            && d!=='ปริมาณน้ำฝน (มม)';
        })
        .forEach(function(key){
          // normalize by population
          row[key] = row[key] / row['ประชากร'];
        })
      return row;
    });
    districtDataLookup = districtData.reduce(function(acc, curr) {
      acc[curr.district] = curr;
      return acc;
    }, {});

    colorScales = Object.keys(districtData[0])
      .filter(function(d){return d!=='district';})
      .reduce(function(acc, curr){
        acc[curr] = d3.scale.quantize()
          .domain(d3.extent(districtData, function(d){return d[curr];}))
          .range(['#edf8fb','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824']);
        return acc;
      }, {});

    districts = topojson.feature(topo, topo.objects.district);

    layer.append('g').classed('district-base', true)
      .append('path')
      .datum(topojson.merge(topo, topo.objects.district.geometries));

    districtPaths = layer.append('g')
        .classed('district-layer', true)
      .selectAll('.district')
        .data(districts.features)
      .enter().append('path')
        .attr('class', 'district')
        .on('wheel', function(d,i) {
          hidePopup();
        })
        .on('mouseover', (d,i) => {
          var ev = d3.event;
          showPopup(ev.pageX, ev.pageY, d.properties.dname);
        })
        .on('mouseout', function(d,i) {
          hidePopup();
        })
        .on('mousemove', function(d,i) {
          var ev = d3.event;
          showPopup(ev.pageX, ev.pageY);
        });

    // console.log('topo.objects', topo.objects);

    // draw bts stations
    drawPoints(
      layer.append('g').classed('bts-layer', true),
      topojson.feature(topo, topo.objects.bts_station).features
    );
    // draw mrt stations
    drawPoints(
      layer.append('g').classed('mrt-layer', true),
      topojson.feature(topo, topo.objects.mrt_station).features
    );
    // draw train stations
    drawPoints(
      layer.append('g').classed('train-layer', true),
      topojson.feature(topo, topo.objects.train_station).features
    );
    // draw chaopraya piers
    drawPoints(
      layer.append('g').classed('chaopraya-layer', true),
      topojson.feature(topo, topo.objects.chaopraya_pier).features
    );
    // draw sansab piers
    drawPoints(
      layer.append('g').classed('sansab-layer', true),
      topojson.feature(topo, topo.objects.sansab_pier).features
    );
    // draw airport link stations
    drawPoints(
      layer.append('g').classed('airportlink-layer', true),
      topojson.feature(topo, topo.objects.airportlink_station).features
    );
    // draw markets
    drawPoints(
      layer.append('g').classed('market-layer', true),
      topojson.feature(topo, topo.objects.market).features
    );
    // draw department stores
    drawPoints(
      layer.append('g').classed('department-store-layer', true),
      topojson.feature(topo, topo.objects.department_store).features
    );
    // draw golf courses
    drawPoints(
      layer.append('g').classed('golf-course-layer', true),
      topojson.feature(topo, topo.objects.golf_course).features
    );
    // draw parks
    drawPoints(
      layer.append('g').classed('park-layer', true),
      topojson.feature(topo, topo.objects.public_park).features
    );

    reset();
    initWaypoints();
  });

function drawPoints(container, features) {
  console.log(container.attr('class') + '  ' + features.length);
  container
    .selectAll('.point')
      .data(features)
    .enter().append('circle')
      .classed('point', true)
      .classed('hidden', true) // Hide all points initially
      .attr('r', 0)
      .attr('cx', function(d){return projectCoordinate(d.geometry.coordinates)[0];})
      .attr('cy', function(d){return projectCoordinate(d.geometry.coordinates)[1];})
      .on('wheel', function(d,i) {
        hidePopup();
      })
      .on('mouseover', (d,i) => {
        var ev = d3.event;
        showPopup(ev.pageX, ev.pageY,
          d.properties.name ||
          d.properties.mar_name ||
          d.properties.golf_name ||
          d.properties.park_name ||
          d.properties.NAME
        );
      })
      .on('mouseout', function(d,i) {
        hidePopup();
      })
}

function hideAllPoints() {
  d3.selectAll('circle.point')
    .classed('hidden', true)
    .attr('r', 0)
}

function showDistricts() {
  d3.select('.district-layer')
    // .classed('hidden', false)
    .transition()
      .duration(400)
      .style('fill-opacity', 1)
}

function hideDistricts() {
  d3.select('.district-layer')
    //.classed('hidden', true) // Need this to disable mouseover polygons
    .style('fill-opacity', 0)
    .style('fill', 'none');
}

function colorDistrict(colorOrFunc) {
  districtPaths
    .style('fill', d3.functor(colorOrFunc));
}

function colorDistrictByField(field) {
  colorDistrict(function(d) {
    var district = d.properties.dname.replace('เขต', '');
    var data = districtDataLookup[district];
    if(data) return colorScales[field](data[field]);
    return '#ccc';
  });
}

function drawTransit(system) {
  d3.selectAll('.bts-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'bts') ? red : grey)
      .style('stroke', (system == 'bts') ? red : grey);
  d3.selectAll('.mrt-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'mrt') ? red : grey)
      .style('stroke', (system == 'mrt') ? red : grey);
  d3.selectAll('.airportlink-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'airportlink') ? red : grey)
      .style('stroke', (system == 'airportlink') ? red : grey);
  d3.selectAll('.chaopraya-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'water') ? orange : grey)
      .style('stroke', (system == 'water') ? orange : grey);
  d3.selectAll('.sansab-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'water') ? purple : grey)
      .style('stroke', (system == 'water') ? purple : grey);
  d3.selectAll('.train-layer circle.point')
    .classed('hidden', false)
    .transition()
      .duration(500)
      .attr('r', r)
      .style('stroke-width', r() * 2)
      .style('fill', (system == 'train') ? red : grey)
      .style('stroke', (system == 'train') ? red : grey);
}

// Waypoints
function initWaypoints() {
  new Waypoint({
    element: document.getElementById('cover'),
    handler: function(direction) {
      showDistricts();
      colorDistrict(null);
      hideAllPoints();
      map.addLayer(stamenLite);
      map.removeLayer(stamenLabels);
    },
    offset: '-1%'
  });

  new Waypoint({
    element: document.getElementById('intro'),
    handler: function(direction) {
      showDistricts();
      colorDistrict(null);
      hideAllPoints();
      map.addLayer(stamenLabels);
      map.removeLayer(stamenLite);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-intro'),
    handler: function(direction) {
      hideDistricts(); // Perhaps we shouldn't hide districts?
      hideAllPoints();
      drawTransit('');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-0'),
    handler: function(direction) {
      hideDistricts(); // Perhaps we shouldn't hide districts?
      hideAllPoints();
      drawTransit('bts');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-1'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      drawTransit('mrt');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-2'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      drawTransit('airportlink');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-3'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      drawTransit('water');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('transport-4'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      drawTransit('train');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('market-vs-mall-0'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      d3.selectAll('.market-layer circle.point')
        .classed('hidden', false)
        .transition()
          .duration(500)
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', grey)
          .style('stroke', grey);
      d3.selectAll('.department-store-layer circle.point')
        .classed('hidden', false)
        .transition()
          .duration(500)
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', grey)
          .style('stroke', grey);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('market-vs-mall-1'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      d3.selectAll('.market-layer circle.point')
        .classed('hidden', false)
        .transition()
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', orange)
          .style('stroke', orange);
      d3.selectAll('.department-store-layer circle.point')
        .classed('hidden', false)
        .transition()
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', blue)
          .style('stroke', blue);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('golfcourse-vs-park-0'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      d3.selectAll('.golf-course-layer circle.point')
        .classed('hidden', false)
        .transition()
          .duration(500)
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', grey)
          .style('stroke', grey);
      d3.selectAll('.park-layer circle.point')
        .classed('hidden', false)
        .transition()
          .duration(500)
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', grey)
          .style('stroke', grey);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('golfcourse-vs-park-1'),
    handler: function(direction) {
      hideDistricts();
      hideAllPoints();
      d3.selectAll('.golf-course-layer circle.point')
        .classed('hidden', false)
        .transition()
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', blue)
          .style('stroke', blue);
      d3.selectAll('.park-layer circle.point')
        .classed('hidden', false)
        .transition()
          .attr('r', r)
          .style('stroke-width', r() * 2)
          .style('fill', orange)
          .style('stroke', orange);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('marriage'),
    handler: function(direction) {
      hideAllPoints();
      colorDistrictByField('สมรส');
      showDistricts();
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('divorce'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrictByField('หย่าร้าง');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('park'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrictByField('พื้นที่สวน (ตรม.)');
    },
    offset: '10%'
  });

  // Clear data from previous slide
  new Waypoint({
    element: document.getElementById('district-custom'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrict('rgba(0,0,0,0.1)');
      map.addLayer(stamenLabels);
      map.removeLayer(stamenLite);
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('temple'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrictByField('วัด');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('massage'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrictByField('อาบอบนวด');
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('temple-massage-0'),
    handler: function(direction) {
      hideAllPoints();
      showDistricts();
      colorDistrict(function(d) {
        var district = d.properties.dname.replace('เขต', '');
        var data = districtDataLookup[district];
        if(data) {
          var m = data['อาบอบนวด'];
          var t = data['วัด'];
					var colorScale = d3.scale.linear()
						.domain([0, 0.5, 1])
						.range(["#f2be1a", "white", "#da3e7b"]);
					return colorScale(m/(m+t));
        }
        return '#ccc';
      });
    },
    offset: '10%'
  });

  new Waypoint({
    element: document.getElementById('end'),
    handler: function(direction) {
      showDistricts();
      colorDistrict(null);
      hideAllPoints();
      map.addLayer(stamenLite);
      map.removeLayer(stamenLabels);
    },
    offset: '10%'
  });
}

var sections = d3.selectAll('.sections section');
var sectionPos = [];
var topSectionPos;

sections.each(function(d,i) {
  var top = this.getBoundingClientRect().top;
  if(i === 0) {
    topSectionPos = top;
  }
  sectionPos.push(top - topSectionPos);
});

function getSection(direction) {
  var pos = window.pageYOffset;
  var next = d3.bisect(sectionPos, pos);
  if (direction === 'prev') {
    return Math.max(0, next - 1);
  } else {
    return Math.min(sections.size() - 1, next);
  }
}

document.addEventListener('keyup', function(e) {
  if (e.keyCode == 32) {
    sections[0][getSection('next')].scrollIntoView(
      {block: 'start', behavior: 'smooth'}
    );
  }
});

d3.selectAll('#district-field-radios input[type=radio]')
  .on('click', function(d){
    colorDistrictByField(this.value);
  });
