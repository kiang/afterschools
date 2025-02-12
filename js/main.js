var sidebar = new ol.control.Sidebar({ element: 'sidebar', position: 'right' });
var jsonFiles, filesLength, fileKey = 0;

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
for (var z = 0; z < 20; ++z) {
  // generate resolutions and matrixIds arrays for this WMTS
  resolutions[z] = size / Math.pow(2, z);
  matrixIds[z] = z;
}

var cityList = {};
var filterCity = '', filterTown = '';
var filterExtent = false;
function pointStyle(f) {
  var p = f.getProperties();
  if (selectedCounty !== p.county) {
    return null;
  }

  // Base style properties
  let color, stroke, radius, rotation = 0;
  
  if (f === currentFeature) {
    // Selected feature style
    color = '#FF9800';  // Warm orange
    stroke = new ol.style.Stroke({
      color: '#FFF',
      width: 3
    });
    radius = 22;
  } else {
    // Default feature style
    color = '#4CAF50';  // Pleasant green
    stroke = new ol.style.Stroke({
      color: '#FFF',
      width: 2
    });
    radius = 18;
  }

  // Create star shape for school markers
  let style = {
    image: new ol.style.RegularShape({
      points: 5,  // Five points makes a star
      radius: radius,
      radius2: radius * 0.5,  // Inner radius for star shape
      fill: new ol.style.Fill({
        color: color
      }),
      stroke: stroke,
      rotation: Math.PI / 2,  // Rotate to point up
      displacement: [0, 0]
    })
  };

  // Add text label only if zoom level is greater than 15
  const currentZoom = map.getView().getZoom();
  if (currentZoom >= 15) {
    style.text = new ol.style.Text({
      text: p.name,
      offsetY: radius + 15,
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      fill: new ol.style.Fill({
        color: '#333'
      }),
      stroke: new ol.style.Stroke({
        color: '#fff',
        width: 3
      }),
      textAlign: 'center'
    });
  }

  return new ol.style.Style(style);
}
var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('infoBox');
var slipBox = document.getElementById('slipBox');

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.721507, 23.700694]),
  zoom: 9
});

var pointFormat = new ol.format.GeoJSON({
  featureProjection: appView.getProjection()
});

var vectorPoints = new ol.layer.Vector({
  source: new ol.source.Vector({
    format: pointFormat
  }),
  style: pointStyle
});

var baseLayer = new ol.layer.Tile({
  source: new ol.source.WMTS({
    matrixSet: 'EPSG:3857',
    format: 'image/png',
    url: 'https://wmts.nlsc.gov.tw/wmts',
    layer: 'EMAP',
    tileGrid: new ol.tilegrid.WMTS({
      origin: ol.extent.getTopLeft(projectionExtent),
      resolutions: resolutions,
      matrixIds: matrixIds
    }),
    style: 'default',
    wrapX: true,
    attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
  }),
  opacity: 0.8
});

function countyStyle(f) {
  var p = f.getProperties();
  if (selectedCounty === p.COUNTYNAME) {
    return null;
  }
  var color = '#ffffff';
  var strokeWidth = 1;
  var strokeColor = 'rgba(0,0,0,0.3)';
  var cityKey = p.COUNTYNAME;
  var textColor = '#000000';
  var baseStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: strokeColor,
      width: strokeWidth
    }),
    fill: new ol.style.Fill({
      color: color
    }),
    text: new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      text: p.COUNTYNAME,
      fill: new ol.style.Fill({
        color: textColor
      })
    })
  });
  return baseStyle;
}

var county = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/taiwan_basecode/county/topo/20200820.json',
    format: new ol.format.TopoJSON({
      featureProjection: appView.getProjection()
    })
  }),
  style: countyStyle,
  zIndex: 50
});


var map = new ol.Map({
  layers: [baseLayer, county, vectorPoints],
  target: 'map',
  view: appView
});

map.addControl(sidebar);
var pointClicked = false;
var selectedCounty = '';
var pointsPool = {};
var rawMap = {
  '臺中市': '台中市',
  '臺北市': '台北市',
  '臺南市': '台南市',
  '臺東市': '台東市',
};

// Add function to handle feature display
function showFeatureDetails(feature) {
  if (!feature) return;
  
  currentFeature = feature;
  var p = feature.getProperties();
  var targetCounty = selectedCounty;
  if (rawMap[selectedCounty]) {
    targetCounty = rawMap[selectedCounty];
  }
  
  $.getJSON('https://kiang.github.io/bsb.kh.edu.tw/data/raw/' + targetCounty + '/' + p.code + '.json', function (c) {
    vectorPoints.getSource().refresh();
    var lonLat = ol.proj.toLonLat(p.geometry.getCoordinates());
    var message = '<table class="table table-dark">';
    message += '<tbody>';
    message += '<tr><th scope="row" style="width: 100px;">名稱</th><td>' + c.補習班名稱 + '</td></tr>';
    message += '<tr><th scope="row">電話</th><td>' + c.電話 + '</td></tr>';
    message += '<tr><th scope="row">住址</th><td>' + c.地址 + '</td></tr>';
    message += '<tr><td colspan="2">';
    message += '<hr /><div class="btn-group-vertical" role="group" style="width: 100%;">';
    message += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + lonLat[1] + ',' + lonLat[0] + '&travelmode=driving" target="_blank" class="btn btn-info btn-lg btn-block">Google 導航</a>';
    message += '<a href="https://wego.here.com/directions/drive/mylocation/' + lonLat[1] + ',' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Here WeGo 導航</a>';
    message += '<a href="https://bing.com/maps/default.aspx?rtp=~pos.' + lonLat[1] + '_' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Bing 導航</a>';
    message += '</div></td></tr>';
    message += '<tr><th scope="row">班主任</th><td>';
    for(k in c["班主任"]) {
      message += c["班主任"][k] + ',';
    }
    message += '</td></tr>';
    message += '<tr><th scope="row">職員工</th><td>';
    for(k in c["職員工"]) {
      message += c["職員工"][k] + ',';
    }
    message += '</td></tr>';
    message += '<tr><th scope="row">負責人</th><td>';
    for(k in c["負責人"]) {
      message += c["負責人"][k] + ',';
    }
    message += '</td></tr>';
    message += '<tr><th scope="row">設立人</th><td>';
    for(k in c["設立人"]) {
      message += c["設立人"][k] + ',';
    }
    message += '</td></tr>';
    message += '<tr><th scope="row">傳真號碼</th><td>' + c.傳真號碼 + '</td></tr>';
    message += '<tr><th scope="row">教室數</th><td>' + c.教室數 + '</td></tr>';
    message += '<tr><th scope="row">教室面積</th><td>' + c.教室面積 + '</td></tr>';
    message += '<tr><th scope="row">班舍總面積</th><td>' + c.班舍總面積 + '</td></tr>';
    message += '<tr><th scope="row">立案情形</th><td>' + c.立案情形 + '</td></tr>';
    message += '<tr><th scope="row">立案日期</th><td>' + c.立案日期 + '</td></tr>';
    message += '<tr><th scope="row">補習班英文名稱</th><td>' + c.補習班英文名稱 + '</td></tr>';
    message += '<tr><th scope="row">英文地址</th><td>' + c.英文地址 + '</td></tr>';
    message += '<tr><th scope="row">補習班類別/科目</th><td>' + c["補習班類別/科目"] + '</td></tr>';
    message += '</tbody></table>';
    sidebarTitle.innerHTML = p.name;
    content.innerHTML = message;
    sidebar.open('home');
    message = '';
    for(k in c.核准科目) {
      message += '<table class="table table-dark"><tbody>';
      for(l in c.核准科目[k]) {
        message += '<tr><th scope="row">' + l + '</th><td>' + c.核准科目[k][l] + '</td></tr>';
      }
      message += '</tbody></table>';
    }
    slipBox.innerHTML = message;
  });
}

// Add routing handlers
routie({
  '': function() {
    // Handle default route - clear selection
    currentFeature = false;
    vectorPoints.getSource().refresh();
    sidebar.close();
  },
  ':countyName/:code': function(countyName, code) {
    // Handle feature route
    selectedCounty = countyName;
    if (!pointsPool[selectedCounty]) {
      $.getJSON('https://kiang.github.io/bsb.kh.edu.tw/data/map/' + selectedCounty + '.json', function (c) {
        pointsPool[selectedCounty] = true;
        vectorPoints.getSource().addFeatures(pointFormat.readFeatures(c));
        vectorPoints.getSource().refresh();
        
        // Find and show feature with matching code
        var features = vectorPoints.getSource().getFeatures();
        var targetFeature = features.find(f => f.get('code') === code);
        if (targetFeature) {
          showFeatureDetails(targetFeature);
        }
      });
    } else {
      var features = vectorPoints.getSource().getFeatures();
      var targetFeature = features.find(f => f.get('code') === code);
      if (targetFeature) {
        showFeatureDetails(targetFeature);
      }
    }
    county.getSource().refresh();
  }
});

map.on('singleclick', function (evt) {
  content.innerHTML = '';
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      pointClicked = true;
      var p = feature.getProperties();
      if (p.COUNTYNAME) {
        selectedCounty = p.COUNTYNAME;
        if (!pointsPool[selectedCounty]) {
          $.getJSON('https://kiang.github.io/bsb.kh.edu.tw/data/map/' + selectedCounty + '.json', function (c) {
            pointsPool[selectedCounty] = true;
            vectorPoints.getSource().addFeatures(pointFormat.readFeatures(c));
            vectorPoints.getSource().refresh();
          });
        } else {
          vectorPoints.getSource().refresh();
        }
        county.getSource().refresh();
        // Update URL when selecting county
        routie('');
      } else {
        // Check if clicking the same feature
        if (currentFeature === feature) {
          // Deselect current feature
          currentFeature = false;
          vectorPoints.getSource().refresh();
          sidebar.close();
          routie('');
        } else {
          // Select new feature
          routie(selectedCounty + '/' + p.code);
        }
      }
    }
  });
  
  // Handle clicking empty space
  if (!pointClicked) {
    currentFeature = false;
    vectorPoints.getSource().refresh();
    sidebar.close();
    routie('');
  }
});

var previousFeature = false;
var currentFeature = false;

var geolocation = new ol.Geolocation({
  projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function (error) {
  console.log(error.message);
});

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
  image: new ol.style.Circle({
    radius: 6,
    fill: new ol.style.Fill({
      color: '#3399CC'
    }),
    stroke: new ol.style.Stroke({
      color: '#fff',
      width: 2
    })
  })
}));

var firstPosDone = false;
geolocation.on('change:position', function () {
  var coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
  if (false === firstPosDone) {
    map.dispatchEvent({
      type: 'singleclick',
      coordinate: coordinates,
      pixel: map.getPixelFromCoordinate(coordinates)
    });
    appView.setCenter(coordinates);
    firstPosDone = true;
  }
});

new ol.layer.Vector({
  map: map,
  source: new ol.source.Vector({
    features: [positionFeature]
  })
});

$('#btn-geolocation').click(function () {
  var coordinates = geolocation.getPosition();
  if (coordinates) {
    appView.setCenter(coordinates);
  } else {
    alert('目前使用的設備無法提供地理資訊');
  }
  return false;
});

// Add after map initialization
map.getView().on('change:resolution', function() {
  vectorPoints.getSource().refresh();
});