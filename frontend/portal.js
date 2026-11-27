var LAYERS = {
  stress: {
    name: "Crop Stress",
    cat: ["#2e9e5b", "#e6c229", "#e8873a", "#c0392b"],
    labels: ["Low", "Moderate", "High", "Severe"]
  },
  ipi: {
    name: "Irrigation priority",
    key: "ipi",
    unit: "/100",
    ramp: ["#fbeee6", "#f1b896", "#d9784f", "#b5573a", "#7a2e17"]
  },
  wet: {
    name: "Soil wetness",
    key: "soil_wetness",
    unit: "",
    ramp: ["#f3ead7", "#d9c79a", "#9fb98c", "#4f9d9a", "#1f6a7a"]
  },
  ndvi: {
    name: "NDVI",
    key: "ndvi",
    unit: "",
    ramp: ["#ffff66", "#a6e07a", "#4fbf8a", "#14917f", "#1d4e5f"]
  },
  rainfall: {
    name: "Rainfall",
    key: "rainfall",
    unit: " mm/day",
    ramp: ["#eef6fb", "#bcdcee", "#7fb8de", "#3f86c4", "#1f4e8c"]
  }
};

var BASEMAP_CONFIG = {
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      maxZoom: 19
    }
  },
  clean: {
    name: "Clean",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
      maxZoom: 19
    }
  }
};

var currentBasemap = "clean";
var baseTileLayer = null;
var layer = "stress";
var DATA = {};
var statesGeo = null;
var distsGeo = null;
var stateLayer = null;
var distLayer = null;
var current = null;
var selected = null;
var selectedDistrictLayer = null;
var ranges = {};
var districtMap = {};
var stateBounds = {};
var stateList = [];
var stateCounts = {};
var lastGenieOrigin = null;
var highlightStateBorders = true;
var hoveredState = null;

var stateDistrictsList = {};
var latestPrediction = null;
var knobControllers = {};

var allPriorityList = [];
var currentRankCategory = "ALL";
var priorityPage = 1;
var priorityPageSize = 50;
var prioritySortKey = "rank";
var prioritySortAsc = true;
var currentFilteredPriority = [];

var allClustersList = [];
var clustersSummaryMeta = {};
var currentClusterZone = "ALL";
var clustersPage = 1;
var clustersPageSize = 50;
var clustersSortKey = "district";
var clustersSortAsc = true;
var currentFilteredClusters = [];

var clusterColorMap = {
  0: "#d9784f",
  1: "#0f766e",
  2: "#c0392b",
  3: "#2e9e5b"
};

var allFarmersList = [];
var allHistoryList = [];
var cachedEvaluationData = null;

var PORTAL_MODULES = [
  { hash: "#/map", label: "Geospatial Map", kicker: "Flagship Module" },
  { hash: "#/predictor", label: "Predictor", kicker: "ML Inference" },
  { hash: "#/ranking", label: "Irrigation Priority", kicker: "Decision Support" },
  { hash: "#/benchmarks", label: "ML Benchmarks", kicker: "Model Audit" },
  { hash: "#/clusters", label: "Agro-Climatic Clusters", kicker: "Zonation" },
  { hash: "#/farmers", label: "Farmer Records", kicker: "MySQL Database" }
];

var map = L.map("map", { zoomControl: false, zoomSnap: 0.25 }).setView([22.5, 80], 4.5);
L.control.zoom({ position: "bottomright" }).addTo(map);

if (!map.getPane("stateBoundariesPane")) {
  var statePane = map.createPane("stateBoundariesPane");
  statePane.style.zIndex = "650";
  statePane.style.pointerEvents = "none";
}

function normState(s) {
  var text = s || "";
  return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function formatStateName(s) {
  if (!s) return "";
  if (s.toUpperCase() === "JAMMU & KASHMIR" || s.toLowerCase() === "jammu and kashmir") {
    return "Jammu and Kashmir";
  }
  return s;
}

function getStressBadgeClass(stressLevel) {
  if (stressLevel === "Severe" || stressLevel === "High") {
    return "high";
  }
  if (stressLevel === "Moderate") {
    return "med";
  }
  return "low";
}

function getPriorityScoreColor(score) {
  if (score >= 50.0) {
    return "var(--red)";
  }
  if (score >= 35.0) {
    return "var(--amber)";
  }
  return "var(--green)";
}

function getPriorityBadgeClass(score) {
  if (score >= 50.0) {
    return "high";
  }
  if (score >= 35.0) {
    return "med";
  }
  return "low";
}

function getSelectedDistrictColor() {
  if (currentBasemap === "satellite") {
    return "#ffd700";
  }
  return "#b5573a";
}

function setBasemap(styleKey) {
  if (!BASEMAP_CONFIG[styleKey]) return;
  currentBasemap = styleKey;

  var mapEl = document.getElementById("map");
  if (styleKey === "satellite") {
    mapEl.style.backgroundColor = "#0b101b";
  } else {
    mapEl.style.backgroundColor = "#fafaf8";
  }

  if (baseTileLayer) {
    map.removeLayer(baseTileLayer);
  }
  var cfg = BASEMAP_CONFIG[styleKey];
  baseTileLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);

  if (distLayer) distLayer.bringToFront();
  if (stateLayer) stateLayer.bringToFront();

  var btns = document.querySelectorAll(".map-switcher .ms-btn[data-style]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle("active", btns[i].dataset.style === styleKey);
  }

  recolor();
}

setBasemap("clean");

function colorFor(d) {
  if (!d) {
    if (currentBasemap === "satellite") return "#000000";
    return "#e6e2dc";
  }
  var layerInfo = LAYERS[layer];
  if (layer === "stress") {
    var catIndex = layerInfo.labels.indexOf(d.stress);
    if (catIndex >= 0) {
      return layerInfo.cat[catIndex];
    }
    return "#e6c229";
  }
  var range = ranges[layer];
  var span = (range[1] - range[0]) || 1;
  var ratio = (d[layerInfo.key] - range[0]) / span;
  var colorIdx = Math.floor(ratio * layerInfo.ramp.length);
  colorIdx = Math.max(0, Math.min(layerInfo.ramp.length - 1, colorIdx));
  return layerInfo.ramp[colorIdx];
}

function dataFor(p) {
  if (!p) return null;
  var exactKey = p.state + "|" + p.district;
  if (DATA[exactKey]) return DATA[exactKey];

  var nSt = normState(p.state);
  var nDt = normState(p.district);
  for (var k in DATA) {
    var parts = k.split("|");
    var sSt = normState(parts[0]);
    var sDt = normState(parts[1]);
    var stateMatch = sSt === nSt || sSt.indexOf(nSt) !== -1 || nSt.indexOf(sSt) !== -1;
    var distMatch = sDt === nDt || sDt.indexOf(nDt) !== -1 || nDt.indexOf(sDt) !== -1;
    if (stateMatch && distMatch) {
      return DATA[k];
    }
  }
  return null;
}

function styleState(f) {
  if (!highlightStateBorders) {
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      weight: 0,
      opacity: 0
    };
  }
  var nSt = normState(f.properties.state);
  var isCurrent = current && nSt === normState(current);
  var isHovered = hoveredState && nSt === hoveredState;
  var activeWeight = 2.8;
  if (isCurrent) {
    activeWeight = 4.2;
  } else if (isHovered) {
    activeWeight = 3.6;
  }

  if (currentBasemap === "satellite") {
    var satColor = "#38bdf8";
    var satOpacity = 0.95;
    if (isCurrent || isHovered) {
      satColor = "#fbbf24";
      satOpacity = 1.0;
    }
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: satColor,
      weight: activeWeight,
      opacity: satOpacity,
      lineCap: "round",
      lineJoin: "round"
    };
  }

  var lightColor = "#0f172a";
  var lightOpacity = 0.95;
  if (isCurrent || isHovered) {
    lightColor = "#b45309";
    lightOpacity = 1.0;
  }
  return {
    fillColor: "transparent",
    fillOpacity: 0,
    color: lightColor,
    weight: activeWeight,
    opacity: lightOpacity,
    lineCap: "round",
    lineJoin: "round"
  };
}

function styleDist(f) {
  var d = dataFor(f.properties);
  var fill = colorFor(d);
  var hasData = Boolean(d);
  var isStateDimmed = current && normState(f.properties.state) !== normState(current);

  var borderWeight = 0.6;
  if (hasData) {
    borderWeight = 0.8;
  }

  if (currentBasemap === "satellite") {
    var satFillOpacity = 0.20;
    var satBorderColor = "rgba(255,255,255,0.5)";
    var satOpacity = 0.8;
    if (isStateDimmed) {
      satFillOpacity = 0.05;
      satBorderColor = "rgba(255,255,255,0.15)";
      satOpacity = 0.2;
    } else if (hasData) {
      satFillOpacity = 0.82;
      satBorderColor = "#ffffff";
      borderWeight = 0.9;
    }
    return {
      fillColor: fill,
      fillOpacity: satFillOpacity,
      color: satBorderColor,
      weight: borderWeight,
      opacity: satOpacity
    };
  }

  var cleanFillOpacity = 0.45;
  var cleanBorderColor = "#c2bcb2";
  var cleanOpacity = 1.0;
  if (isStateDimmed) {
    cleanFillOpacity = 0.10;
    cleanBorderColor = "#d5d1cb";
    cleanOpacity = 0.3;
  } else if (hasData) {
    cleanFillOpacity = 0.88;
    cleanBorderColor = "#ffffff";
  }

  return {
    fillColor: fill,
    fillOpacity: cleanFillOpacity,
    color: cleanBorderColor,
    weight: borderWeight,
    opacity: cleanOpacity
  };
}

function drawLegend() {
  var layerInfo = LAYERS[layer];
  var palette = layerInfo.ramp;
  if (layer === "stress") {
    palette = layerInfo.cat;
  }

  var swatchHtml = "";
  for (var i = 0; i < palette.length; i++) {
    swatchHtml += "<div style='background:" + palette[i] + "'></div>";
  }

  var hiLabel = "HIGH";
  if (layer === "stress") {
    hiLabel = "SEVERE";
  }

  var noDataColor = "#e6e2dc";
  var stateBdrColor = "#0f172a";
  if (currentBasemap === "satellite") {
    noDataColor = "#000000";
    stateBdrColor = "#38bdf8";
  }

  return "<div class='leg'><div style='background:" + noDataColor + ";flex:.5'></div>" + swatchHtml + "</div>"
    + "<div class='legl'><span>NO DATA</span><span>LOW</span><span>" + hiLabel + "</span></div>"
    + "<div style='display:flex;align-items:center;gap:7px;margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);font-size:11.5px;color:var(--ink);font-weight:600;'>"
    + "<span style='display:inline-block;width:20px;height:4px;background:" + stateBdrColor + ";border-radius:2px;box-shadow:0 0 2px rgba(0,0,0,0.3);'></span>"
    + "<span>State Boundaries (Highlighted)</span>"
    + "</div>";
}

function escapeSingleQuote(str) {
  return String(str || "").replace(/'/g, "\\'");
}

function buildStateSummaryHtml() {
  var stateDists = distsGeo.features.filter(function(f) {
    return normState(f.properties.state) === normState(current);
  });
  var dataCount = 0;
  for (var i = 0; i < stateDists.length; i++) {
    if (dataFor(stateDists[i].properties) !== null) {
      dataCount += 1;
    }
  }
  return "<h4>" + current + "</h4>"
    + "<div class='v mono' style='font-size:18px;color:var(--teal);margin:6px 0;'>" + stateDists.length + " Districts</div>"
    + "<p style='margin-bottom:8px;'><b>" + dataCount + "</b> district(s) with active ML predictions in verified dataset.</p>"
    + "<p style='font-size:12px;color:var(--mute);'>Click any individual district on the map or search above to inspect agricultural metrics.</p>";
}

function buildDistrictInfoHtml(d) {
  var layerInfo = LAYERS[layer];
  var valueLabel = d[layerInfo.key] + layerInfo.unit;
  if (layer === "stress") {
    valueLabel = d.stress;
  }

  var badgeCls = getStressBadgeClass(d.stress);
  var html = "<h4>" + d.district + ", " + formatStateName(d.state) + "</h4>"
    + "<div style='margin:6px 0;'><span class='badge " + badgeCls + "'>" + (d.stress || "Verified") + " Stress</span></div>"
    + "<div class='v mono'>" + valueLabel + "</div><p>" + layerInfo.name + " · 2024–25 Authentic Data</p>"
    + "<p>Irrigation priority " + d.ipi + " · NDVI " + d.ndvi + " · rain " + d.rainfall + " mm/mo</p>";

  if (d.crop) {
    html += "<p style='font-size:12px;margin:4px 0;'><b>Crop:</b> " + d.crop
      + " · <b>Soil:</b> " + (d.soil_type || "Alluvial")
      + " · <b>Irrig:</b> " + (d.irrigation_coverage || 45) + "%</p>";
  }

  html += "<p>Monthly irrigation priority</p><div class='chart'>";
  var monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (var m = 6; m <= 11; m++) {
    var heightPx = Math.max(4, (d.months[m] || 0) * 0.6);
    html += "<div data-m='" + monthNames[m] + "' style='height:" + heightPx + "px'></div>";
  }

  var safeState = escapeSingleQuote(d.state);
  var safeDistrict = escapeSingleQuote(d.district);
  html += "</div>"
    + "<button type='button' onclick=\"openDistrictInPredictor('" + safeState + "', '" + safeDistrict + "')\" class='btn fill' style='width:100%;font-size:12px;padding:8px 10px;margin-top:14px;cursor:pointer;'>Open in Predictor</button>";
  return html;
}

function showInfo(d, p) {
  var el = document.getElementById("info");
  var html = "";

  if (!p) {
    if (current) {
      html = buildStateSummaryHtml();
    } else {
      html = "<h4>All-India Coverage</h4>"
        + "<div class='v mono' style='font-size:18px;color:var(--teal);margin:6px 0;'>732 Districts Across 36 States/UTs</div>"
        + "<p style='margin-bottom:8px;'>Comprehensive nationwide district-level boundaries with verified agricultural intelligence.</p>"
        + "<p style='font-size:12px;color:var(--mute);'>Select a state from the dropdown or click any district to explore data.</p>";
    }
  } else if (!d) {
    html = "<h4>" + p.district + ", " + formatStateName(p.state) + "</h4>"
      + "<div style='margin:8px 0;'><span class='badge' style='background:#f3f4f6;color:#4b5563;border:1px solid #d1d5db;'>Agricultural prediction data unavailable.</span></div>"
      + "<p style='margin:8px 0;font-size:13px;line-height:1.5;'><b>Geographical Boundary Verified.</b> Authentic Survey of India district boundaries loaded for " + p.district + ".</p>"
      + "<p style='font-size:12px;color:var(--mute);line-height:1.5;'>Agricultural sensor and ML prediction data is unavailable for this district in the Jun–Nov 2023 verified benchmark dataset.</p>";
  } else {
    html = buildDistrictInfoHtml(d);
  }

  el.innerHTML = html + drawLegend();
}

window.openDistrictInPredictor = function(st, dt) {
  location.hash = "#/predictor";
  setTimeout(function() {
    var stateSelect = document.getElementById("pred-state");
    var distSelect = document.getElementById("pred-district");
    if (!stateSelect || !distSelect) return;
    var normSt = normState(st);
    for (var i = 0; i < stateSelect.options.length; i++) {
      if (normState(stateSelect.options[i].value) === normSt) {
        stateSelect.selectedIndex = i;
        stateSelect.onchange();
        break;
      }
    }
    setTimeout(function() {
      var normDt = normState(dt);
      for (var j = 0; j < distSelect.options.length; j++) {
        if (normState(distSelect.options[j].value) === normDt) {
          distSelect.selectedIndex = j;
          distSelect.onchange();
          break;
        }
      }
    }, 80);
  }, 120);
};

function selectDistrict(props, ly) {
  if (selectedDistrictLayer && distLayer) {
    distLayer.resetStyle(selectedDistrictLayer);
  }
  selectedDistrictLayer = ly;
  selected = props;
  var baseFillOpacity = ly.options.fillOpacity || 0.8;
  ly.setStyle({
    weight: 3.5,
    color: getSelectedDistrictColor(),
    fillOpacity: Math.min(1.0, baseFillOpacity + 0.12),
    opacity: 1
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    ly.bringToFront();
  }
  showInfo(dataFor(props), props);
}

function clearSelectedDistrict() {
  if (selectedDistrictLayer && distLayer) {
    distLayer.resetStyle(selectedDistrictLayer);
    selectedDistrictLayer = null;
    selected = null;
  }
}

function filterByState(stName) {
  clearSelectedDistrict();

  if (!stName || stName === "ALL") {
    current = null;
    document.getElementById("pill").textContent = "INDIA";
    document.getElementById("state-select").value = "ALL";
    if (distLayer) distLayer.setStyle(styleDist);
    if (stateLayer) stateLayer.setStyle(styleState);
    map.flyTo([22.5, 80], 4.5, { duration: 1.2 });
    showInfo(null);
    return;
  }

  current = stName;
  document.getElementById("pill").textContent = stName.toUpperCase();
  document.getElementById("state-select").value = stName;
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);

  var nSt = normState(stName);
  var bounds = stateBounds[nSt];
  if (bounds && bounds.isValid()) {
    map.flyToBounds(bounds, { duration: 1.2, padding: [35, 35] });
  }
  showInfo(null);
}

function recolor() {
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);
  if (selectedDistrictLayer) {
    selectedDistrictLayer.setStyle({ weight: 3.5, color: getSelectedDistrictColor() });
  }
  var selectedData = null;
  if (selected) {
    selectedData = dataFor(selected);
  }
  showInfo(selectedData, selected);
}

function buildLayerLinks() {
  var html = "";
  for (var k in LAYERS) {
    var activeClass = "";
    if (k === layer) {
      activeClass = "sel";
    }
    var linkColor = "var(--acc)";
    if (k === "stress") {
      linkColor = "#c0392b";
    }
    html += "<a data-k='" + k + "' class='" + activeClass + "' style='color:" + linkColor + "'>" + LAYERS[k].name + "</a>";
  }
  var box = document.getElementById("layers");
  box.innerHTML = html;
  box.onclick = function(e) {
    if (e.target.dataset.k) {
      layer = e.target.dataset.k;
      buildLayerLinks();
      recolor();
    }
  };
}

function computeRanges() {
  for (var k in LAYERS) {
    if (!LAYERS[k].key) continue;
    var lo = 1e9;
    var hi = -1e9;
    var fieldKey = LAYERS[k].key;
    for (var id in DATA) {
      var val = DATA[id][fieldKey];
      if (val < lo) lo = val;
      if (val > hi) hi = val;
    }
    ranges[k] = [lo, hi];
  }
}

function findDistrictLayerMatch(targetDt, targetSt) {
  if (targetSt) {
    var exactKey = targetSt + "|" + targetDt;
    if (districtMap[exactKey]) {
      return districtMap[exactKey];
    }
  }
  for (var k in districtMap) {
    var kDt = k.split("|")[1];
    if (kDt === targetDt) {
      return districtMap[k];
    }
  }
  if (targetDt.length >= 3) {
    for (var k2 in districtMap) {
      var kDt2 = k2.split("|")[1];
      if (kDt2.indexOf(targetDt) === 0 || kDt2.indexOf(targetDt) !== -1) {
        return districtMap[k2];
      }
    }
  }
  return null;
}

function handleSearch(val) {
  if (!val) return;
  val = val.trim();
  for (var i = 0; i < stateList.length; i++) {
    var st = stateList[i];
    if (val === st + " (All Districts)" || val.toLowerCase() === st.toLowerCase()) {
      filterByState(st);
      return;
    }
  }

  var cleanVal = val.replace(/\s*\(.*?\)/, "").trim().toLowerCase();
  var parts = cleanVal.split(",");
  var targetDt = normState(parts[0].trim());
  var targetSt = null;
  if (parts[1]) {
    targetSt = normState(parts[1].trim());
  }

  var ly = findDistrictLayerMatch(targetDt, targetSt);
  if (!ly) return;

  var feature = ly.feature;
  if (current && normState(feature.properties.state) !== normState(current)) {
    current = formatStateName(feature.properties.state);
    document.getElementById("pill").textContent = current.toUpperCase();
    document.getElementById("state-select").value = current;
    distLayer.setStyle(styleDist);
    stateLayer.setStyle(styleState);
  }
  selectDistrict(feature.properties, ly);
  map.flyToBounds(ly.getBounds(), { duration: 1.0, maxZoom: 8, padding: [50, 50] });
}

function loadDistrictProfile(state, district) {
  if (!district) return;
  var url = "/api/district-profile?state=" + encodeURIComponent(state) + "&district=" + encodeURIComponent(district);
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status === "success") {
        updateDistrictProfileUI(data);
        autoPopulatePredictorInputs(data);
      }
    })
    .catch(function(err) {
      console.warn("Could not load district profile:", err);
    });
}

function updateDistrictProfileUI(data) {
  var lgdBadge = document.getElementById("profile-lgd-badge");
  var cropEl = document.getElementById("profile-crop");
  var soilEl = document.getElementById("profile-soil");
  var irrigEl = document.getElementById("profile-irrig");
  var rainEl = document.getElementById("profile-rain");
  var tempEl = document.getElementById("profile-temp");
  var humEl = document.getElementById("profile-hum");

  if (lgdBadge) lgdBadge.textContent = "LGD Code: " + data.lgd_code;
  if (cropEl && data.agriculture) cropEl.textContent = data.agriculture.crop || "—";
  if (soilEl && data.soil) soilEl.textContent = data.soil.soil_type || "—";

  if (irrigEl) {
    var covVal = "45.0";
    if (data.irrigation && data.irrigation.irrigation_coverage_pct) {
      covVal = data.irrigation.irrigation_coverage_pct.toFixed(1);
    }
    irrigEl.textContent = covVal + "%";
  }

  if (rainEl && data.climate) {
    rainEl.textContent = Math.round(data.climate.rainfall_annual_mm || 0) + " mm";
  }
  if (tempEl) {
    var tempMean = "30.0";
    if (data.climate && data.climate.temperature_mean_c) {
      tempMean = data.climate.temperature_mean_c.toFixed(1);
    }
    tempEl.textContent = tempMean + " °C";
  }
  if (humEl && data.climate) {
    humEl.textContent = Math.round(data.climate.humidity_mean_pct || 50) + "%";
  }

  var apyRow = document.getElementById("profile-apy-row");
  var areaEl = document.getElementById("profile-area");
  var prodEl = document.getElementById("profile-prod");
  var yieldEl = document.getElementById("profile-yield");

  if (data.agriculture && data.agriculture.crop_area_ha) {
    if (apyRow) apyRow.style.display = "flex";
    if (areaEl) areaEl.textContent = data.agriculture.crop_area_ha.toLocaleString() + " Ha";
    if (prodEl) prodEl.textContent = data.agriculture.crop_production_t.toLocaleString() + " MT";
    if (yieldEl) yieldEl.textContent = data.agriculture.crop_yield_t_ha.toFixed(2) + " MT/Ha";
  } else {
    if (apyRow) apyRow.style.display = "none";
  }
}

function autoPopulatePredictorInputs(data) {
  var inputs = data.suggested_predictor_inputs || {};
  var fieldMap = {
    "pred-temp": inputs.temperature,
    "pred-hum": inputs.humidity,
    "pred-rain": inputs.rainfall,
    "pred-soil": inputs.effective_soil_wetness,
    "pred-ph": inputs.soil_ph,
    "pred-soc": inputs.soil_organic_carbon
  };

  for (var fieldId in fieldMap) {
    var val = fieldMap[fieldId];
    if (knobControllers[fieldId] && val !== undefined) {
      knobControllers[fieldId].setValue(val);
    }
  }

  if (inputs.crop_type) {
    var cropSel = document.getElementById("pred-crop");
    if (cropSel) {
      for (var i = 0; i < cropSel.options.length; i++) {
        if (cropSel.options[i].value.toLowerCase() === inputs.crop_type.toLowerCase()) {
          cropSel.selectedIndex = i;
          break;
        }
      }
    }
  }
}

function setupSingleKnob(el) {
  var id = el.getAttribute("data-id");
  var min = parseFloat(el.getAttribute("data-min"));
  var max = parseFloat(el.getAttribute("data-max"));
  var step = parseFloat(el.getAttribute("data-step")) || 1;
  var decimals = parseInt(el.getAttribute("data-decimals"), 10) || 0;

  var dialBox = el.querySelector(".knob-dial-box");
  var progressCircle = el.querySelector(".knob-progress");
  var rotor = el.querySelector(".knob-rotor");
  var displayVal = el.querySelector(".knob-display-val");
  var numInput = document.getElementById(id);

  if (!dialBox || !numInput) return;

  var fullTrack = 216.77;
  var fullCirc = 289.03;
  var isDragging = false;
  var startY = 0;
  var startVal = 0;

  function clamp(val) {
    if (isNaN(val)) val = min;
    return Math.min(Math.max(val, min), max);
  }

  function roundToStep(val) {
    var inv = 1.0 / step;
    return Math.round(val * inv) / inv;
  }

  function render(val, updateInput) {
    val = clamp(val);
    var fraction = (val - min) / (max - min);
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;

    var progressLen = (fraction * fullTrack).toFixed(2);
    if (progressCircle) {
      progressCircle.style.strokeDasharray = progressLen + " " + fullCirc;
    }

    var angle = -135 + (fraction * 270);
    if (rotor) {
      rotor.style.transform = "rotate(" + angle.toFixed(1) + "deg)";
    }

    var formatted = Math.round(val).toString();
    if (decimals > 0) {
      formatted = val.toFixed(decimals);
    }
    if (displayVal) {
      displayVal.textContent = formatted;
    }

    dialBox.setAttribute("aria-valuenow", formatted);

    if (updateInput && parseFloat(numInput.value) !== val) {
      numInput.value = formatted;
    }
  }

  var ctrl = {
    id: id,
    getValue: function() {
      return parseFloat(numInput.value) || min;
    },
    setValue: function(val) {
      var clean = roundToStep(clamp(val));
      render(clean, true);
    }
  };
  knobControllers[id] = ctrl;

  var initialVal = parseFloat(numInput.value);
  if (isNaN(initialVal)) initialVal = min;
  ctrl.setValue(initialVal);

  numInput.oninput = function() {
    var v = parseFloat(this.value);
    if (!isNaN(v)) {
      render(clamp(v), false);
    }
  };
  numInput.onchange = function() {
    var v = parseFloat(this.value);
    if (isNaN(v)) {
      ctrl.setValue(min);
    } else {
      ctrl.setValue(v);
    }
  };

  function getPointerY(e) {
    if (e.clientY !== undefined) return e.clientY;
    if (e.touches && e.touches[0]) return e.touches[0].clientY;
    return 0;
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    if (e.preventDefault && e.cancelable) e.preventDefault();
    var deltaY = startY - getPointerY(e);
    var change = (deltaY / 140) * (max - min);
    var nextVal = roundToStep(clamp(startVal + change));
    render(nextVal, true);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    dialBox.classList.remove("dragging");
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);
  }

  function onPointerDown(e) {
    isDragging = true;
    dialBox.focus();
    dialBox.classList.add("dragging");
    startY = getPointerY(e);
    startVal = ctrl.getValue();
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  }

  dialBox.addEventListener("mousedown", onPointerDown);
  dialBox.addEventListener("touchstart", onPointerDown, { passive: true });

  dialBox.addEventListener("wheel", function(e) {
    e.preventDefault();
    var dir = -1;
    if (e.deltaY < 0) {
      dir = 1;
    }
    var nextVal = roundToStep(clamp(ctrl.getValue() + dir * step));
    ctrl.setValue(nextVal);
  }, { passive: false });

  dialBox.addEventListener("keydown", function(e) {
    var currentVal = ctrl.getValue();
    var nextVal = currentVal;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      nextVal = currentVal + step;
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      nextVal = currentVal - step;
    } else if (e.key === "PageUp") {
      e.preventDefault();
      nextVal = currentVal + step * 5;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      nextVal = currentVal - step * 5;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextVal = min;
    } else if (e.key === "End") {
      e.preventDefault();
      nextVal = max;
    } else {
      return;
    }
    ctrl.setValue(nextVal);
  });
}

function initKnobs() {
  var knobEls = document.querySelectorAll(".knob-control");
  for (var i = 0; i < knobEls.length; i++) {
    setupSingleKnob(knobEls[i]);
  }
}

function applyPreset(soil, temp, rain, hum, crop, stage, ph, soc) {
  if (knobControllers["pred-soil"] && soil !== undefined) knobControllers["pred-soil"].setValue(soil);
  if (knobControllers["pred-temp"] && temp !== undefined) knobControllers["pred-temp"].setValue(temp);
  if (knobControllers["pred-rain"] && rain !== undefined) knobControllers["pred-rain"].setValue(rain);
  if (knobControllers["pred-hum"] && hum !== undefined) knobControllers["pred-hum"].setValue(hum);
  if (knobControllers["pred-ph"] && ph !== undefined) knobControllers["pred-ph"].setValue(ph);
  if (knobControllers["pred-soc"] && soc !== undefined) knobControllers["pred-soc"].setValue(soc);

  if (crop) {
    var cropEl = document.getElementById("pred-crop");
    if (cropEl) cropEl.value = crop;
  }
  if (stage) {
    var stageEl = document.getElementById("pred-stage");
    if (stageEl) stageEl.value = stage;
  }
}

function updateDistrictsForSelectedState() {
  var stateSelect = document.getElementById("pred-state");
  var distSelect = document.getElementById("pred-district");
  if (!stateSelect || !distSelect) return;

  var chosenState = stateSelect.value;
  var dists = (stateDistrictsList[chosenState] || []).slice().sort();
  distSelect.innerHTML = "";
  for (var i = 0; i < dists.length; i++) {
    var dt = dists[i];
    var opt = document.createElement("option");
    opt.value = dt;
    opt.textContent = dt;
    if (dt === "Khammam" || dt === "Bikaner") opt.selected = true;
    distSelect.appendChild(opt);
  }
  if (distSelect.value) {
    loadDistrictProfile(chosenState, distSelect.value);
  }
}

function bindPredictorSearchInputs(stateSelect, distSelect, sortedStates) {
  var stateSearch = document.getElementById("pred-state-search");
  var distSearch = document.getElementById("pred-district-search");

  if (stateSearch) {
    stateSearch.oninput = function() {
      var q = this.value.toLowerCase().trim();
      stateSelect.innerHTML = "";
      for (var i = 0; i < sortedStates.length; i++) {
        var st = sortedStates[i];
        if (!q || st.toLowerCase().indexOf(q) !== -1) {
          var opt = document.createElement("option");
          opt.value = st;
          opt.textContent = st + " (" + stateDistrictsList[st].length + " districts)";
          stateSelect.appendChild(opt);
        }
      }
      updateDistrictsForSelectedState();
    };
  }

  if (distSearch) {
    distSearch.oninput = function() {
      var q = this.value.toLowerCase().trim();
      var chosenState = stateSelect.value;
      var dists = (stateDistrictsList[chosenState] || []).slice().sort();
      distSelect.innerHTML = "";
      for (var i = 0; i < dists.length; i++) {
        var dt = dists[i];
        if (!q || dt.toLowerCase().indexOf(q) !== -1) {
          var opt = document.createElement("option");
          opt.value = dt;
          opt.textContent = dt;
          distSelect.appendChild(opt);
        }
      }
      if (distSelect.value) {
        loadDistrictProfile(chosenState, distSelect.value);
      }
    };
  }
}

function bindPresetButtons(stateSelect, distSelect) {
  var btnArid = document.getElementById("preset-arid");
  var btnDry = document.getElementById("preset-dry");
  var btnMonsoon = document.getElementById("preset-monsoon");
  var btnReset = document.getElementById("preset-reset");

  if (btnArid) {
    btnArid.onclick = function() {
      applyPreset(0.18, 39.0, 0.0, 22, "Cotton", "Reproductive", 8.2, 0.30);
    };
  }
  if (btnDry) {
    btnDry.onclick = function() {
      applyPreset(0.30, 33.5, 0.0, 38, "Cotton", "Reproductive", 7.5, 0.45);
    };
  }
  if (btnMonsoon) {
    btnMonsoon.onclick = function() {
      applyPreset(0.58, 28.0, 24.0, 78, "Rice", "Vegetative", 6.8, 0.65);
    };
  }
  if (btnReset) {
    btnReset.onclick = function() {
      loadDistrictProfile(stateSelect.value, distSelect.value);
    };
  }
}

function selectOptionCaseInsensitive(selectEl, targetText) {
  if (!selectEl || !targetText) return false;
  var lowered = targetText.toLowerCase();
  for (var i = 0; i < selectEl.options.length; i++) {
    if (selectEl.options[i].value.toLowerCase() === lowered) {
      selectEl.selectedIndex = i;
      return true;
    }
  }
  return false;
}

function bindPredictorFarmerSelect(stateSelect, distSelect) {
  var predFarmerSel = document.getElementById("pred-farmer-select");
  if (!predFarmerSel) return;

  predFarmerSel.onchange = function() {
    var fid = parseInt(this.value, 10);
    var fObj = null;
    for (var i = 0; i < allFarmersList.length; i++) {
      if (allFarmersList[i].farmer_id === fid) {
        fObj = allFarmersList[i];
        break;
      }
    }

    var nameIn = document.getElementById("pred-farmer-name");
    var phoneIn = document.getElementById("pred-farmer-phone");
    var villIn = document.getElementById("pred-farmer-village");

    if (!fObj) {
      if (nameIn) nameIn.value = "";
      if (phoneIn) phoneIn.value = "";
      if (villIn) villIn.value = "";
      return;
    }

    if (nameIn) nameIn.value = fObj.farmer_name || "";
    if (phoneIn) phoneIn.value = fObj.phone || "";
    if (villIn) villIn.value = fObj.village || "";

    if (selectOptionCaseInsensitive(stateSelect, fObj.state_name)) {
      updateDistrictsForSelectedState();
    }
    if (selectOptionCaseInsensitive(distSelect, fObj.district_name)) {
      loadDistrictProfile(stateSelect.value, distSelect.value);
    }
  };
}

function initPredictorForm() {
  var stateSelect = document.getElementById("pred-state");
  var distSelect = document.getElementById("pred-district");
  if (!stateSelect || !distSelect || !distsGeo) return;

  stateDistrictsList = {};
  for (var i = 0; i < distsGeo.features.length; i++) {
    var feature = distsGeo.features[i];
    var formattedSt = formatStateName(feature.properties.state);
    if (!stateDistrictsList[formattedSt]) {
      stateDistrictsList[formattedSt] = [];
    }
    stateDistrictsList[formattedSt].push(feature.properties.district);
  }

  stateSelect.innerHTML = "";
  var sortedStates = Object.keys(stateDistrictsList).sort();
  for (var j = 0; j < sortedStates.length; j++) {
    var st = sortedStates[j];
    var opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st + " (" + stateDistrictsList[st].length + " districts)";
    if (st === "Telangana") opt.selected = true;
    stateSelect.appendChild(opt);
  }

  bindPredictorSearchInputs(stateSelect, distSelect, sortedStates);

  stateSelect.onchange = updateDistrictsForSelectedState;
  distSelect.onchange = function() {
    loadDistrictProfile(stateSelect.value, distSelect.value);
  };

  updateDistrictsForSelectedState();
  initKnobs();
  bindPresetButtons(stateSelect, distSelect);
  bindPredictorFarmerSelect(stateSelect, distSelect);

  var btnRun = document.getElementById("btn-run-predict");
  if (btnRun) btnRun.onclick = runPredictionInference;

  var btnMap = document.getElementById("btn-view-on-map");
  if (btnMap) btnMap.onclick = navigatePredictionToMap;

  populateFarmerLocationDropdowns();
}

function validatePredictorInputs(temp, hum, rain, soil, ph, soc) {
  if (isNaN(temp) || temp < 15 || temp > 48) {
    alert("Please enter a valid temperature between 15 °C and 48 °C.");
    return false;
  }
  if (isNaN(hum) || hum < 10 || hum > 95) {
    alert("Please enter a valid humidity between 10% and 95%.");
    return false;
  }
  if (isNaN(rain) || rain < 0 || rain > 100) {
    alert("Please enter a valid daily rainfall between 0 and 100 mm.");
    return false;
  }
  if (isNaN(soil) || soil < 0.10 || soil > 0.85) {
    alert("Please enter a valid soil moisture index between 0.10 and 0.85.");
    return false;
  }
  if (isNaN(ph) || ph < 4.5 || ph > 9.5) {
    alert("Please enter a valid soil pH between 4.5 and 9.5.");
    return false;
  }
  if (isNaN(soc) || soc < 0.10 || soc > 1.50) {
    alert("Please enter a valid soil organic carbon between 0.10% and 1.50%.");
    return false;
  }
  return true;
}

function runPredictionInference() {
  var btnRun = document.getElementById("btn-run-predict");
  var st = document.getElementById("pred-state").value;
  var dt = document.getElementById("pred-district").value;
  var crop = document.getElementById("pred-crop").value;
  var stage = document.getElementById("pred-stage").value;

  var temp = parseFloat(document.getElementById("pred-temp").value);
  var hum = parseFloat(document.getElementById("pred-hum").value);
  var rain = parseFloat(document.getElementById("pred-rain").value);
  var soil = parseFloat(document.getElementById("pred-soil").value);
  var ph = parseFloat(document.getElementById("pred-ph").value);
  var soc = parseFloat(document.getElementById("pred-soc").value);

  if (!validatePredictorInputs(temp, hum, rain, soil, ph, soc)) {
    return;
  }

  var farmerSelEl = document.getElementById("pred-farmer-select");
  var farmerNameEl = document.getElementById("pred-farmer-name");
  var farmerPhoneEl = document.getElementById("pred-farmer-phone");
  var farmerVillEl = document.getElementById("pred-farmer-village");

  var farmerNameVal = "";
  if (farmerNameEl) farmerNameVal = farmerNameEl.value.trim();

  var farmerPhoneVal = "";
  if (farmerPhoneEl) farmerPhoneVal = farmerPhoneEl.value.trim();

  var farmerVillVal = "";
  if (farmerVillEl) farmerVillVal = farmerVillEl.value.trim();

  var payload = {
    state: st,
    district: dt,
    crop_type: crop,
    growth_stage: stage,
    effective_soil_wetness: soil,
    temperature: temp,
    rainfall: rain,
    humidity: hum,
    soil_ph: ph,
    soil_organic_carbon: soc,
    farmer_name: farmerNameVal,
    farmer_phone: farmerPhoneVal,
    farmer_village: farmerVillVal
  };

  if (farmerSelEl && farmerSelEl.value) {
    var parsedFarmerId = parseInt(farmerSelEl.value, 10);
    if (!isNaN(parsedFarmerId)) {
      payload.farmer_id = parsedFarmerId;
    }
  }

  btnRun.disabled = true;
  btnRun.textContent = "Processing Prediction...";

  fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(res) {
      btnRun.disabled = false;
      btnRun.textContent = "Predict";
      renderPredictionResults(res, payload);
    })
    .catch(function(err) {
      btnRun.disabled = false;
      btnRun.textContent = "Predict";
      alert("Prediction failed: " + err.message + ". Please verify input parameters.");
    });
}

function updateProbabilityBar(suffix, probability) {
  var val = probability || 0.0;
  document.getElementById("prob-fill-" + suffix).style.width = (val * 100).toFixed(0) + "%";
  document.getElementById("prob-num-" + suffix).textContent = (val * 100).toFixed(1) + "%";
}

function renderPredictionResults(res, payload) {
  latestPrediction = { res: res, payload: payload };

  var emptyEl = document.getElementById("results-empty");
  var contentEl = document.getElementById("results-content");
  if (emptyEl) emptyEl.style.display = "none";
  if (contentEl) {
    contentEl.style.display = "block";
    contentEl.classList.add("active");
  }

  var cStress = res.crop_stress_prediction || {};
  var iPriority = res.irrigation_priority_prediction || {};
  var agro = res.calculated_agronomic_indicators || {};

  document.getElementById("res-target-title").textContent = payload.district + ", " + payload.state + " · " + payload.crop_type;

  var stressLevel = cStress.stress_level || "Moderate";
  var stressBadge = document.getElementById("res-stress-badge");
  stressBadge.textContent = stressLevel + " Stress";
  stressBadge.className = "badge " + getStressBadgeClass(stressLevel);

  var stressColors = {
    Low: "var(--green)",
    Moderate: "var(--amber)",
    High: "var(--acc)",
    Severe: "var(--red)"
  };
  var stressVal = document.getElementById("res-stress-val");
  stressVal.textContent = stressLevel;
  stressVal.style.color = stressColors[stressLevel] || "var(--acc)";

  var ipiScore = iPriority.irrigation_priority_index || 0.0;
  var ipiVal = document.getElementById("res-ipi-val");
  ipiVal.textContent = ipiScore.toFixed(1);
  ipiVal.style.color = getPriorityScoreColor(ipiScore);

  document.getElementById("res-depth-val").textContent = iPriority.recommended_irrigation_depth || "35–45 mm";
  document.getElementById("res-deficit-val").textContent = (agro.daily_water_deficit_mm || 0.0).toFixed(1) + " mm/d";

  var probs = cStress.stress_probabilities || {};
  updateProbabilityBar("low", probs["Low"]);
  updateProbabilityBar("mod", probs["Moderate"]);
  updateProbabilityBar("high", probs["High"]);
  updateProbabilityBar("sev", probs["Severe"]);

  document.getElementById("res-advisory-title").textContent = iPriority.priority_category + " Advisory";
  document.getElementById("res-advisory-text").textContent =
    (iPriority.actionable_farmer_advisory || "") + " " + (cStress.condition_summary || "");

  document.getElementById("res-et0").textContent = (agro.reference_et0_mm || 0.0).toFixed(2) + " mm";
  document.getElementById("res-etc").textContent = (agro.crop_etc_mm || 0.0).toFixed(2) + " mm";
  document.getElementById("res-ndvi").textContent = (agro.vegetation_ndvi || 0.0).toFixed(3);

  var sumPhVal = "7.4";
  if (payload.soil_ph !== undefined) {
    sumPhVal = payload.soil_ph.toFixed(1);
  }
  var sumSocVal = "0.48";
  if (payload.soil_organic_carbon !== undefined) {
    sumSocVal = payload.soil_organic_carbon.toFixed(2);
  }

  var summaryValues = {
    "sum-loc": payload.district + ", " + payload.state,
    "sum-crop": payload.crop_type + " · " + payload.growth_stage,
    "sum-temp": payload.temperature.toFixed(1) + " °C",
    "sum-hum": Math.round(payload.humidity) + " %",
    "sum-rain": payload.rainfall.toFixed(1) + " mm",
    "sum-soil": payload.effective_soil_wetness.toFixed(2),
    "sum-ph": sumPhVal + " pH",
    "sum-soc": sumSocVal + " %"
  };
  for (var sumId in summaryValues) {
    var sumEl = document.getElementById(sumId);
    if (sumEl) sumEl.textContent = summaryValues[sumId];
  }

  var dbPill = document.getElementById("res-db-pill");
  var dbText = document.getElementById("res-db-text");
  if (dbPill && dbText && res.database) {
    dbPill.style.display = "flex";
    if (res.database.saved) {
      dbPill.className = "pred-db-pill saved";
      dbText.textContent = "Saved to MySQL crop_stress_db (Prediction #" + res.database.prediction_id + ")";
      loadFarmersData();
      loadPredictionHistory();
    } else {
      dbPill.className = "pred-db-pill unsaved";
      dbText.textContent = "Not saved to MySQL: " + (res.database.message || "Database unavailable");
    }
  }
}

function navigatePredictionToMap() {
  if (!latestPrediction) return;
  var payload = latestPrediction.payload;
  var res = latestPrediction.res;

  location.hash = "#/map";

  setTimeout(function() {
    var targetDt = normState(payload.district);
    var targetSt = normState(payload.state);
    var ly = districtMap[targetSt + "|" + targetDt];

    if (!ly) {
      for (var k in districtMap) {
        if (k.split("|")[1] === targetDt) {
          ly = districtMap[k];
          break;
        }
      }
    }

    if (!ly) return;

    if (current && normState(ly.feature.properties.state) !== normState(current)) {
      current = formatStateName(ly.feature.properties.state);
      document.getElementById("pill").textContent = current.toUpperCase();
      document.getElementById("state-select").value = current;
      distLayer.setStyle(styleDist);
      stateLayer.setStyle(styleState);
    }
    selectDistrict(ly.feature.properties, ly);
    map.flyToBounds(ly.getBounds(), { duration: 1.0, maxZoom: 8, padding: [50, 50] });

    var cStress = res.crop_stress_prediction || {};
    var iPriority = res.irrigation_priority_prediction || {};
    var agro = res.calculated_agronomic_indicators || {};
    var stressLevel = cStress.stress_level || "Moderate";
    var badgeCls = getStressBadgeClass(stressLevel);

    var html = "<h4>" + payload.district + ", " + formatStateName(payload.state) + "</h4>"
      + "<div style='margin:6px 0;'><span class='badge " + badgeCls + "'>Predicted: " + stressLevel + " Stress</span> "
      + "<span class='badge' style='background:rgba(15,118,110,0.15);color:var(--teal);'>ML INFERENCE</span></div>"
      + "<div class='v mono' style='color:var(--acc);font-size:22px;margin:4px 0;'>IPI " + (iPriority.irrigation_priority_index || 0.0).toFixed(1) + " / 100</div>"
      + "<p><b>Recommended Irrigation:</b> " + (iPriority.recommended_irrigation_depth || "35–45 mm") + "</p>"
      + "<p><b>Crop:</b> " + payload.crop_type + " (" + payload.growth_stage + " stage)</p>"
      + "<p style='font-size:12px;margin:8px 0;line-height:1.4;'><b>Advisory:</b> " + (iPriority.actionable_farmer_advisory || "") + "</p>"
      + "<p style='font-size:11.5px;color:var(--mute);margin-top:10px;'>Deficit: "
      + (agro.daily_water_deficit_mm || 0.0).toFixed(1) + " mm/d · ETc: "
      + (agro.crop_etc_mm || 0.0).toFixed(2) + " mm · NDVI: "
      + (agro.vegetation_ndvi || 0.0).toFixed(3) + "</p>";

    document.getElementById("info").innerHTML = html + drawLegend();
  }, 180);
}

function attachDistrictLayerEvents(feature, layerObj) {
  var k = normState(feature.properties.state) + "|" + normState(feature.properties.district);
  districtMap[k] = layerObj;

  var nSt = normState(feature.properties.state);
  if (!stateBounds[nSt]) {
    stateBounds[nSt] = L.latLngBounds(layerObj.getBounds());
  } else {
    stateBounds[nSt].extend(layerObj.getBounds());
  }

  layerObj.on("click", function() {
    selectDistrict(feature.properties, layerObj);
  });
  layerObj.on("mouseover", function() {
    if (layerObj !== selectedDistrictLayer) {
      var hoverColor = "#b5573a";
      if (currentBasemap === "satellite") {
        hoverColor = "#ffffff";
      }
      layerObj.setStyle({ weight: 2.5, color: hoverColor });
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layerObj.bringToFront();
      }
    }
    hoveredState = normState(feature.properties.state);
    if (stateLayer) stateLayer.setStyle(styleState);
  });
  layerObj.on("mouseout", function() {
    if (layerObj !== selectedDistrictLayer && distLayer) {
      distLayer.resetStyle(layerObj);
    }
    hoveredState = null;
    if (stateLayer) stateLayer.setStyle(styleState);
  });

  var distData = dataFor(feature.properties);
  var statusText = "Agricultural prediction data unavailable.";
  if (distData) {
    if (distData.stress) {
      statusText = distData.stress + " Stress · IPI " + distData.ipi;
    } else {
      statusText = "IPI " + distData.ipi;
    }
  }
  var tipText = "<b>" + feature.properties.district + "</b>, " + formatStateName(feature.properties.state)
    + "<br><span style='font-size:11px;opacity:0.85;'>" + statusText + "</span>";
  layerObj.bindTooltip(tipText, { sticky: true });
}

function populateMapControls() {
  stateList = [];
  var seenStates = {};
  stateBounds = {};
  stateCounts = {};
  districtMap = {};

  for (var i = 0; i < distsGeo.features.length; i++) {
    var feature = distsGeo.features[i];
    var formattedSt = formatStateName(feature.properties.state);
    var normSt = normState(formattedSt);
    stateCounts[normSt] = (stateCounts[normSt] || 0) + 1;
    if (!seenStates[normSt]) {
      seenStates[normSt] = formattedSt;
      stateList.push(formattedSt);
    }
  }
  stateList.sort();

  var coverageBadge = document.getElementById("coverage-badge");
  if (coverageBadge) {
    coverageBadge.textContent = distsGeo.features.length + " Districts | All India Coverage";
  }

  var sel = document.getElementById("state-select");
  sel.innerHTML = "<option value='ALL'>All States / UTs (" + distsGeo.features.length + " Districts)</option>";
  for (var j = 0; j < stateList.length; j++) {
    var st = stateList[j];
    var opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st + " (" + (stateCounts[normState(st)] || 0) + " districts)";
    sel.appendChild(opt);
  }
  sel.onchange = function() {
    filterByState(this.value);
  };

  var dlHtml = "";
  for (var sIdx = 0; sIdx < stateList.length; sIdx++) {
    dlHtml += "<option value='" + stateList[sIdx] + " (All Districts)'>";
  }
  for (var fIdx = 0; fIdx < distsGeo.features.length; fIdx++) {
    var props = distsGeo.features[fIdx].properties;
    dlHtml += "<option value='" + props.district + ", " + formatStateName(props.state) + "'>";
  }
  document.getElementById("dl").innerHTML = dlHtml;
}

Promise.all([
  fetch("data/india_states_simplified.geojson").then(function(r) { return r.json(); }),
  fetch("data/india_districts_simplified.geojson").then(function(r) { return r.json(); }),
  fetch("data/portal_data.json").then(function(r) { return r.json(); })
])
  .then(function(res) {
    statesGeo = res[0];
    distsGeo = res[1];
    DATA = res[2];
    computeRanges();
    buildLayerLinks();
    populateMapControls();

    distLayer = L.geoJSON(distsGeo, {
      style: styleDist,
      onEachFeature: attachDistrictLayerEvents
    }).addTo(map);

    stateLayer = L.geoJSON(statesGeo, {
      pane: "stateBoundariesPane",
      style: styleState,
      interactive: false
    }).addTo(map);

    var btnStateBorders = document.getElementById("btn-state-borders");
    if (btnStateBorders) {
      btnStateBorders.onclick = function() {
        highlightStateBorders = !highlightStateBorders;
        this.classList.toggle("active", highlightStateBorders);
        if (stateLayer) stateLayer.setStyle(styleState);
      };
    }

    distLayer.bringToFront();
    stateLayer.bringToFront();
    showInfo(null);
    initPredictorForm();
  })
  .catch(function(err) {
    console.error("Map initialization failed:", err);
    document.getElementById("info").innerHTML = "<h4>Could not load data</h4><p>Open this page through the FastAPI server at /app/.</p>";
  });

document.getElementById("lb").onclick = function() {
  document.getElementById("panel").classList.add("on");
  this.style.display = "none";
};
document.getElementById("lyr").onclick = function() {
  document.getElementById("panel").classList.toggle("on");
};
document.getElementById("pill").onclick = function() {
  filterByState("ALL");
};
document.getElementById("theme").onclick = function() {
  if (document.documentElement.dataset.theme === "dark") {
    document.documentElement.dataset.theme = "";
  } else {
    document.documentElement.dataset.theme = "dark";
  }
};

var msBtns = document.querySelectorAll(".map-switcher .ms-btn");
for (var msIdx = 0; msIdx < msBtns.length; msIdx++) {
  msBtns[msIdx].onclick = function() {
    setBasemap(this.dataset.style);
  };
}

var searchTimeout = null;
var mapSearchEl = document.getElementById("search");
mapSearchEl.oninput = function() {
  clearTimeout(searchTimeout);
  var val = this.value;
  searchTimeout = setTimeout(function() {
    if (val.length >= 3) handleSearch(val);
  }, 280);
};
mapSearchEl.onchange = function() {
  handleSearch(this.value);
};
mapSearchEl.onkeydown = function(e) {
  if (e.key === "Enter") handleSearch(this.value);
};

function animateNumber(el, start, end, duration, decimals, suffix) {
  if (!el) return;
  decimals = decimals || 0;
  suffix = suffix || "";
  var startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var easeProgress = 1 - Math.pow(1 - progress, 3);
    var currentVal = start + (end - start) * easeProgress;
    el.textContent = currentVal.toFixed(decimals) + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = end.toFixed(decimals) + suffix;
    }
  }
  requestAnimationFrame(step);
}

function loadPriorityData() {
  fetch("/api/irrigation/priority")
    .then(function(r) { return r.json(); })
    .then(function(res) {
      allPriorityList = res.ranked_districts || [];
      renderPriorityKPIs(allPriorityList);
      populateStateDropdown(allPriorityList);
      renderTop10Chart(allPriorityList.slice(0, 10));
      filterRankings();
    })
    .catch(function(err) {
      console.error("Could not load priority rankings:", err);
    });
}

function renderPriorityKPIs(list) {
  var high = 0;
  var med = 0;
  var low = 0;
  var totalScore = 0;

  for (var i = 0; i < list.length; i++) {
    var sc = list[i].irrigation_priority_index;
    totalScore += sc;
    if (sc >= 50.0) high += 1;
    else if (sc >= 35.0) med += 1;
    else low += 1;
  }

  animateNumber(document.getElementById("rank-total-districts"), 0, list.length, 700, 0, "");
  animateNumber(document.getElementById("rank-high-count"), 0, high, 700, 0, "");
  animateNumber(document.getElementById("rank-med-count"), 0, med, 700, 0, "");
  animateNumber(document.getElementById("rank-low-count"), 0, low, 700, 0, "");
  animateNumber(document.getElementById("rank-avg-ipi"), 0, totalScore / (list.length || 1), 700, 1, "");
}

function populateStateDropdown(list) {
  var states = {};
  for (var i = 0; i < list.length; i++) {
    states[list[i].state] = true;
  }
  var sortedStates = Object.keys(states).sort();
  var sel = document.getElementById("ranking-state-filter");
  if (!sel || sel.options.length > 1) return;

  for (var j = 0; j < sortedStates.length; j++) {
    var opt = document.createElement("option");
    opt.value = sortedStates[j];
    opt.textContent = sortedStates[j];
    sel.appendChild(opt);
  }
}

function renderTop10Chart(top10) {
  var container = document.getElementById("top-10-bars");
  if (!container) return;
  var html = "";
  for (var i = 0; i < top10.length; i++) {
    var d = top10[i];
    var pct = Math.min(100, (d.irrigation_priority_index / 70) * 100).toFixed(0);
    var color = getPriorityScoreColor(d.irrigation_priority_index);
    html += "<div class='bar-chart-row'>"
      + "<div class='bar-chart-label' title='" + d.district + ", " + d.state + "'><b>#" + d.rank + "</b> " + d.district + " (" + d.state + ")</div>"
      + "<div class='bar-chart-track'><div class='bar-chart-fill' style='width:" + pct + "%;background:" + color + ";'>" + d.recommended_irrigation_depth + "</div></div>"
      + "<div class='bar-chart-val' style='color:" + color + ";'>" + d.irrigation_priority_index + "</div>"
      + "</div>";
  }
  container.innerHTML = html;
}

function renderPriorityTable() {
  var tbody = document.getElementById("priority-tbody");
  if (!tbody) return;
  var list = currentFilteredPriority;
  if (!list || list.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9' style='text-align:center;padding:24px;color:var(--mute);'>No districts matching filter criteria.</td></tr>";
    updatePriorityPagination(0, 0, 0);
    return;
  }

  var total = list.length;
  var startIdx = (priorityPage - 1) * priorityPageSize;
  var endIdx = Math.min(startIdx + priorityPageSize, total);
  var pageItems = list.slice(startIdx, endIdx);

  var html = "";
  for (var i = 0; i < pageItems.length; i++) {
    var d = pageItems[i];
    var badgeCls = getPriorityBadgeClass(d.irrigation_priority_index);
    html += "<tr>"
      + "<td class='mono'><b>#" + d.rank + "</b></td>"
      + "<td><b>" + d.district + "</b></td>"
      + "<td>" + d.state + "</td>"
      + "<td>" + (d.crop_type || "Mixed") + "</td>"
      + "<td class='mono'><b>" + d.irrigation_priority_index + "</b></td>"
      + "<td><span class='badge " + badgeCls + "'>" + d.priority_category + "</span></td>"
      + "<td>" + d.recommended_irrigation_depth + "</td>"
      + "<td class='mono'>" + d.soil_moisture_level + "</td>"
      + "<td class='mono'>" + d.daily_rainfall_mm + " mm</td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
  updatePriorityPagination(total, startIdx + 1, endIdx);
}

function updatePriorityPagination(total, start, end) {
  var infoEl = document.getElementById("priority-pagination-info");
  var pageNumEl = document.getElementById("priority-page-num");
  var prevBtn = document.getElementById("priority-prev-btn");
  var nextBtn = document.getElementById("priority-next-btn");
  if (!infoEl || !pageNumEl) return;

  if (total === 0) {
    infoEl.textContent = "Showing 0 of 0 districts";
    pageNumEl.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  var totalPages = Math.ceil(total / priorityPageSize);
  infoEl.textContent = "Showing " + start + "–" + end + " of " + total + " districts";
  pageNumEl.textContent = "Page " + priorityPage + " of " + totalPages;
  if (prevBtn) prevBtn.disabled = priorityPage <= 1;
  if (nextBtn) nextBtn.disabled = priorityPage >= totalPages;
}

function sortPriorityList(key) {
  if (prioritySortKey === key) {
    prioritySortAsc = !prioritySortAsc;
  } else {
    prioritySortKey = key;
    prioritySortAsc = true;
  }
  updatePrioritySortHeaders();
  applyPrioritySorting();
  priorityPage = 1;
  renderPriorityTable();
}

function updatePrioritySortHeaders() {
  var headers = document.querySelectorAll("#priority-table th.sortable");
  for (var i = 0; i < headers.length; i++) {
    var th = headers[i];
    th.classList.remove("asc", "desc");
    var icon = th.querySelector(".sort-icon");
    if (icon) icon.innerHTML = "&#8597;";
    if (th.getAttribute("data-sort") === prioritySortKey) {
      if (prioritySortAsc) {
        th.classList.add("asc");
        if (icon) icon.innerHTML = "&#9650;";
      } else {
        th.classList.add("desc");
        if (icon) icon.innerHTML = "&#9660;";
      }
    }
  }
}

function compareRecordsByKey(a, b, key, asc) {
  var valA = a[key];
  var valB = b[key];
  if (typeof valA === "string") valA = valA.toLowerCase();
  if (typeof valB === "string") valB = valB.toLowerCase();
  if (valA < valB) {
    if (asc) return -1;
    return 1;
  }
  if (valA > valB) {
    if (asc) return 1;
    return -1;
  }
  return 0;
}

function applyPrioritySorting() {
  currentFilteredPriority.sort(function(a, b) {
    return compareRecordsByKey(a, b, prioritySortKey, prioritySortAsc);
  });
}

function filterRankings() {
  var search = (document.getElementById("ranking-search").value || "").toLowerCase().trim();
  var state = document.getElementById("ranking-state-filter").value;

  currentFilteredPriority = [];
  for (var i = 0; i < allPriorityList.length; i++) {
    var d = allPriorityList[i];
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesState = state === "ALL" || d.state === state;
    var matchesCat = currentRankCategory === "ALL" || d.priority_category === currentRankCategory;
    if (matchesSearch && matchesState && matchesCat) {
      currentFilteredPriority.push(d);
    }
  }

  applyPrioritySorting();
  priorityPage = 1;
  renderPriorityTable();
}

function attachPrioritySortClick(headerEl) {
  headerEl.onclick = function() {
    var sortKey = headerEl.getAttribute("data-sort");
    if (sortKey) sortPriorityList(sortKey);
  };
}

function initPriorityControls() {
  var rankSearchEl = document.getElementById("ranking-search");
  if (rankSearchEl) rankSearchEl.oninput = filterRankings;

  var rankStateEl = document.getElementById("ranking-state-filter");
  if (rankStateEl) rankStateEl.onchange = filterRankings;

  var rankFilterBtns = document.querySelectorAll(".filter-tabs .filter-btn");
  for (var i = 0; i < rankFilterBtns.length; i++) {
    rankFilterBtns[i].onclick = function() {
      for (var j = 0; j < rankFilterBtns.length; j++) {
        rankFilterBtns[j].classList.remove("active");
      }
      this.classList.add("active");
      currentRankCategory = this.dataset.cat;
      filterRankings();
    };
  }

  var prevRankBtn = document.getElementById("priority-prev-btn");
  if (prevRankBtn) {
    prevRankBtn.onclick = function() {
      if (priorityPage > 1) {
        priorityPage -= 1;
        renderPriorityTable();
      }
    };
  }

  var nextRankBtn = document.getElementById("priority-next-btn");
  if (nextRankBtn) {
    nextRankBtn.onclick = function() {
      var totalPages = Math.ceil(currentFilteredPriority.length / priorityPageSize);
      if (priorityPage < totalPages) {
        priorityPage += 1;
        renderPriorityTable();
      }
    };
  }

  var pageSizeSelect = document.getElementById("priority-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.onchange = function() {
      priorityPageSize = parseInt(this.value, 10) || 50;
      priorityPage = 1;
      renderPriorityTable();
    };
  }

  var prioritySortHeaders = document.querySelectorAll("#priority-table th.sortable");
  for (var sIdx = 0; sIdx < prioritySortHeaders.length; sIdx++) {
    attachPrioritySortClick(prioritySortHeaders[sIdx]);
  }
}

function loadClustersData() {
  fetch("/api/clusters/regions")
    .then(function(r) { return r.json(); })
    .then(function(res) {
      allClustersList = res.districts_clustered || [];
      clustersSummaryMeta = res.clusters_summary || {};
      if (res.pca_variance) {
        var pc1El = document.getElementById("pca-var-pc1");
        var pc2El = document.getElementById("pca-var-pc2");
        var totEl = document.getElementById("pca-var-tot");
        if (pc1El) pc1El.textContent = "PC1: " + (res.pca_variance.pc1 * 100).toFixed(2) + "% Var";
        if (pc2El) pc2El.textContent = "PC2: " + (res.pca_variance.pc2 * 100).toFixed(2) + "% Var";
        if (totEl) totEl.textContent = "Total 2D: " + (res.pca_variance.total * 100).toFixed(2) + "%";
      }
      renderClusterCardsStats(clustersSummaryMeta);
      renderPcaScatterPlot(allClustersList);
      filterClusters();
    })
    .catch(function(err) {
      console.error("Could not load regional clusters:", err);
    });
}

function renderClusterCardsStats(summary) {
  for (var cid = 0; cid < 4; cid++) {
    var info = summary[cid] || summary[String(cid)];
    if (!info) continue;
    var tEl = document.getElementById("c" + cid + "-temp");
    var rEl = document.getElementById("c" + cid + "-rain");
    var sEl = document.getElementById("c" + cid + "-soil");
    var iEl = document.getElementById("c" + cid + "-ipi");
    if (tEl) tEl.textContent = info.mean_temperature + " °C";
    if (rEl) rEl.textContent = info.mean_rainfall + " mm";
    if (sEl) sEl.textContent = info.mean_soil_moisture;
    if (iEl) iEl.textContent = info.mean_priority_index;
  }
}

function renderPcaScatterPlot(list) {
  var svg = document.getElementById("pca-svg");
  if (!svg || !list || list.length === 0) return;

  var width = 840;
  var height = 440;
  var padLeft = 65;
  var padRight = 30;
  var padTop = 30;
  var padBottom = 50;

  var minX = Infinity;
  var maxX = -Infinity;
  var minY = Infinity;
  var maxY = -Infinity;

  for (var i = 0; i < list.length; i++) {
    var x = list[i].pca_x;
    var y = list[i].pca_y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  minX -= 0.6;
  maxX += 0.6;
  minY -= 0.6;
  maxY += 0.6;

  function scaleX(val) {
    return padLeft + ((val - minX) / (maxX - minX)) * (width - padLeft - padRight);
  }
  function scaleY(val) {
    return height - padBottom - ((val - minY) / (maxY - minY)) * (height - padTop - padBottom);
  }

  var zeroX = scaleX(0);
  var zeroY = scaleY(0);
  var plotW = width - padLeft - padRight;
  var plotH = height - padTop - padBottom;
  var centerX = padLeft + plotW / 2;
  var centerY = padTop + plotH / 2;

  var svgHtml = "<line x1='" + padLeft + "' y1='" + zeroY + "' x2='" + (width - padRight) + "' y2='" + zeroY + "' stroke='var(--line)' stroke-dasharray='4 4' stroke-width='1.5'/>";
  svgHtml += "<line x1='" + zeroX + "' y1='" + padTop + "' x2='" + zeroX + "' y2='" + (height - padBottom) + "' stroke='var(--line)' stroke-dasharray='4 4' stroke-width='1.5'/>";
  svgHtml += "<rect x='" + padLeft + "' y='" + padTop + "' width='" + plotW + "' height='" + plotH + "' fill='none' stroke='var(--line)' stroke-width='1'/>";
  svgHtml += "<text x='" + centerX + "' y='" + (height - 14) + "' text-anchor='middle' font-size='12' font-weight='600' fill='var(--mute)'>Principal Component 1 (PC1: 49.59% Variance) &rarr; Moisture Deficit &amp; Evaporative Demand</text>";
  svgHtml += "<text x='18' y='" + centerY + "' text-anchor='middle' transform='rotate(-90 18 " + centerY + ")' font-size='12' font-weight='600' fill='var(--mute)'>Principal Component 2 (PC2: 37.27%) &rarr; Thermal Profile</text>";

  for (var j = 0; j < list.length; j++) {
    var d = list[j];
    var cx = scaleX(d.pca_x).toFixed(1);
    var cy = scaleY(d.pca_y).toFixed(1);
    var col = clusterColorMap[d.cluster_id] || "var(--acc)";
    svgHtml += "<circle class='pca-point' id='pca-pt-" + j + "' data-index='" + j + "' data-zone='" + d.cluster_id + "' cx='" + cx + "' cy='" + cy + "' r='4.5' fill='" + col + "' stroke='#ffffff' stroke-width='1' opacity='0.85'/>";
  }

  svg.innerHTML = svgHtml;
  initPcaTooltipEvents(list);
}

function bindClusterPointEvents(pt, tooltip, list) {
  pt.onmouseenter = function(e) {
    pt.setAttribute("r", "8");
    pt.setAttribute("stroke-width", "2.5");
    var idx = parseInt(pt.getAttribute("data-index"), 10);
    var d = list[idx];
    if (!d) return;

    var col = clusterColorMap[d.cluster_id] || "var(--acc)";
    var scoreColor = getPriorityScoreColor(d.mean_priority_index);

    var content = "<div class='pca-tooltip-title'>" + d.district + ", " + d.state + "</div>"
      + "<div class='pca-tooltip-zone' style='background:" + col + "25;color:" + col + ";border:1px solid " + col + "60;'>Zone " + d.cluster_id + ": " + d.cluster_name + "</div>"
      + "<div class='pca-tooltip-grid'>"
      + "<div><span class='lbl'>Primary Crop:</span> <b>" + (d.crop || "Mixed") + "</b></div>"
      + "<div><span class='lbl'>Priority Score:</span> <b style='color:" + scoreColor + ";'>" + d.mean_priority_index + "</b></div>"
      + "<div><span class='lbl'>Mean Temp:</span> <b>" + d.mean_temperature + " °C</b></div>"
      + "<div><span class='lbl'>Mean Rain:</span> <b>" + d.mean_rainfall + " mm</b></div>"
      + "<div><span class='lbl'>Soil Wetness:</span> <b>" + d.mean_soil_moisture + "</b></div>"
      + "<div><span class='lbl'>PCA Coords:</span> <b>(" + d.pca_x + ", " + d.pca_y + ")</b></div>"
      + "</div>";

    tooltip.innerHTML = content;
    tooltip.style.display = "block";
    positionPcaTooltip(e);
  };

  pt.onmousemove = function(e) {
    positionPcaTooltip(e);
  };

  pt.onmouseleave = function() {
    pt.setAttribute("r", "4.5");
    pt.setAttribute("stroke-width", "1");
    tooltip.style.display = "none";
  };

  pt.onclick = function() {
    var idx = parseInt(pt.getAttribute("data-index"), 10);
    var d = list[idx];
    if (!d) return;
    var searchInput = document.getElementById("cluster-search");
    if (searchInput) {
      searchInput.value = d.district;
      filterClusters();
      var tableBox = document.getElementById("clusters-table");
      if (tableBox) tableBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
}

function initPcaTooltipEvents(list) {
  var svg = document.getElementById("pca-svg");
  var tooltip = document.getElementById("pca-tooltip");
  var container = document.getElementById("pca-scatter-container");
  if (!svg || !tooltip || !container) return;

  var points = svg.querySelectorAll(".pca-point");
  for (var i = 0; i < points.length; i++) {
    bindClusterPointEvents(points[i], tooltip, list);
  }
}

function positionPcaTooltip(e) {
  var tooltip = document.getElementById("pca-tooltip");
  var container = document.getElementById("pca-scatter-container");
  if (!tooltip || !container) return;

  var cRect = container.getBoundingClientRect();
  var mouseX = e.clientX - cRect.left;
  var mouseY = e.clientY - cRect.top;
  var posX = mouseX + 16;
  var posY = mouseY - 20;

  if (posX + 240 > cRect.width) posX = mouseX - 240 - 16;
  if (posY + 150 > cRect.height) posY = cRect.height - 150 - 10;
  if (posY < 10) posY = 10;

  tooltip.style.left = posX + "px";
  tooltip.style.top = posY + "px";
}

function updateClusterPcaPointsDimming() {
  var svg = document.getElementById("pca-svg");
  if (!svg) return;
  var points = svg.querySelectorAll(".pca-point");
  for (var i = 0; i < points.length; i++) {
    var pZone = points[i].getAttribute("data-zone");
    if (currentClusterZone === "ALL" || pZone === String(currentClusterZone)) {
      points[i].classList.remove("dimmed");
      points[i].style.display = "";
    } else {
      points[i].classList.add("dimmed");
    }
  }
}

function renderClustersTable() {
  var tbody = document.getElementById("clusters-tbody");
  if (!tbody) return;
  var list = currentFilteredClusters;
  if (!list || list.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9' style='text-align:center;padding:24px;color:var(--mute);'>No clustered districts matching criteria.</td></tr>";
    updateClustersPagination(0, 0, 0);
    return;
  }

  var total = list.length;
  var startIdx = (clustersPage - 1) * clustersPageSize;
  var endIdx = Math.min(startIdx + clustersPageSize, total);
  var pageItems = list.slice(startIdx, endIdx);

  var html = "";
  for (var i = 0; i < pageItems.length; i++) {
    var c = pageItems[i];
    var col = clusterColorMap[c.cluster_id] || "var(--acc)";
    html += "<tr>"
      + "<td><b>" + c.district + "</b></td>"
      + "<td>" + c.state + "</td>"
      + "<td><span class='badge' style='background:" + col + "20;color:" + col + ";border:1px solid " + col + "60;'>Zone " + c.cluster_id + ": " + c.cluster_name + "</span></td>"
      + "<td>" + (c.crop || "Mixed") + "</td>"
      + "<td class='mono'>" + c.mean_temperature + " °C</td>"
      + "<td class='mono'>" + c.mean_rainfall + " mm</td>"
      + "<td class='mono'>" + c.mean_soil_moisture + "</td>"
      + "<td class='mono'><b>" + c.mean_priority_index + "</b></td>"
      + "<td class='mono'>(" + c.pca_x + ", " + c.pca_y + ")</td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
  updateClustersPagination(total, startIdx + 1, endIdx);
}

function updateClustersPagination(total, start, end) {
  var infoEl = document.getElementById("clusters-pagination-info");
  var pageNumEl = document.getElementById("clusters-page-num");
  var prevBtn = document.getElementById("clusters-prev-btn");
  var nextBtn = document.getElementById("clusters-next-btn");
  if (!infoEl || !pageNumEl) return;

  if (total === 0) {
    infoEl.textContent = "Showing 0 of 0 districts";
    pageNumEl.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  var totalPages = Math.ceil(total / clustersPageSize);
  infoEl.textContent = "Showing " + start + "–" + end + " of " + total + " districts";
  pageNumEl.textContent = "Page " + clustersPage + " of " + totalPages;
  if (prevBtn) prevBtn.disabled = clustersPage <= 1;
  if (nextBtn) nextBtn.disabled = clustersPage >= totalPages;
}

function sortClustersList(key) {
  if (clustersSortKey === key) {
    clustersSortAsc = !clustersSortAsc;
  } else {
    clustersSortKey = key;
    clustersSortAsc = true;
  }
  updateClustersSortHeaders();
  applyClustersSorting();
  clustersPage = 1;
  renderClustersTable();
}

function updateClustersSortHeaders() {
  var headers = document.querySelectorAll("#clusters-table th.sortable");
  for (var i = 0; i < headers.length; i++) {
    var th = headers[i];
    th.classList.remove("asc", "desc");
    var icon = th.querySelector(".sort-icon");
    if (icon) icon.innerHTML = "&#8597;";
    if (th.getAttribute("data-sort") === clustersSortKey) {
      if (clustersSortAsc) {
        th.classList.add("asc");
        if (icon) icon.innerHTML = "&#9650;";
      } else {
        th.classList.add("desc");
        if (icon) icon.innerHTML = "&#9660;";
      }
    }
  }
}

function applyClustersSorting() {
  currentFilteredClusters.sort(function(a, b) {
    return compareRecordsByKey(a, b, clustersSortKey, clustersSortAsc);
  });
}

function filterClusters() {
  var search = (document.getElementById("cluster-search").value || "").toLowerCase().trim();
  var zone = currentClusterZone;

  currentFilteredClusters = [];
  for (var i = 0; i < allClustersList.length; i++) {
    var d = allClustersList[i];
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesZone = zone === "ALL" || String(d.cluster_id) === String(zone);
    if (matchesSearch && matchesZone) {
      currentFilteredClusters.push(d);
    }
  }

  applyClustersSorting();
  clustersPage = 1;
  renderClustersTable();
  updateClusterPcaPointsDimming();
}

function updatePillButtonsState(zone, pillBtns) {
  for (var i = 0; i < pillBtns.length; i++) {
    var b = pillBtns[i];
    if (b.getAttribute("data-zone") === String(zone)) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  }
}

function attachClusterPillClick(btn, allPills, clusterZoneEl) {
  btn.onclick = function() {
    currentClusterZone = btn.getAttribute("data-zone") || "ALL";
    updatePillButtonsState(currentClusterZone, allPills);
    if (clusterZoneEl) clusterZoneEl.value = currentClusterZone;
    filterClusters();
  };
}

function attachClusterSortClick(headerEl) {
  headerEl.onclick = function() {
    var sortKey = headerEl.getAttribute("data-sort");
    if (sortKey) sortClustersList(sortKey);
  };
}

function initClusterControls() {
  var clusterSearchEl = document.getElementById("cluster-search");
  if (clusterSearchEl) clusterSearchEl.oninput = filterClusters;

  var clusterZoneEl = document.getElementById("cluster-zone-filter");
  var clusterPillBtns = document.querySelectorAll(".cluster-pill-btn");

  if (clusterZoneEl) {
    clusterZoneEl.onchange = function() {
      currentClusterZone = this.value;
      updatePillButtonsState(currentClusterZone, clusterPillBtns);
      filterClusters();
    };
  }

  for (var i = 0; i < clusterPillBtns.length; i++) {
    attachClusterPillClick(clusterPillBtns[i], clusterPillBtns, clusterZoneEl);
  }

  var prevClustersBtn = document.getElementById("clusters-prev-btn");
  if (prevClustersBtn) {
    prevClustersBtn.onclick = function() {
      if (clustersPage > 1) {
        clustersPage -= 1;
        renderClustersTable();
      }
    };
  }

  var nextClustersBtn = document.getElementById("clusters-next-btn");
  if (nextClustersBtn) {
    nextClustersBtn.onclick = function() {
      var totalPages = Math.ceil(currentFilteredClusters.length / clustersPageSize);
      if (clustersPage < totalPages) {
        clustersPage += 1;
        renderClustersTable();
      }
    };
  }

  var clustersPageSizeSelect = document.getElementById("clusters-page-size");
  if (clustersPageSizeSelect) {
    clustersPageSizeSelect.onchange = function() {
      clustersPageSize = parseInt(this.value, 10) || 50;
      clustersPage = 1;
      renderClustersTable();
    };
  }

  var clustersSortHeaders = document.querySelectorAll("#clusters-table th.sortable");
  for (var csIdx = 0; csIdx < clustersSortHeaders.length; csIdx++) {
    attachClusterSortClick(clustersSortHeaders[csIdx]);
  }
}

function attachCardTiltEvents(card) {
  card.addEventListener("mousemove", function(e) {
    var rect = card.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var cx = rect.width / 2;
    var cy = rect.height / 2;
    var rotX = (-((y - cy) / cy) * 5).toFixed(2);
    var rotY = (((x - cx) / cx) * 5).toFixed(2);
    card.style.transform = "perspective(1200px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) translateY(-3px)";
  });
  card.addEventListener("mouseleave", function() {
    card.style.transform = "";
  });
}

function initCardTilt() {
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) return;
  var cards = document.querySelectorAll(".nav-card, .cluster-card, .pred-card");
  for (var i = 0; i < cards.length; i++) {
    attachCardTiltEvents(cards[i]);
  }
}

function initModuleDocks() {
  var viewIds = ["view-predictor", "view-ranking", "view-benchmarks", "view-clusters", "view-farmers"];
  for (var i = 0; i < viewIds.length; i++) {
    var sec = document.querySelector("#" + viewIds[i] + " > .sec");
    if (!sec || sec.querySelector(".module-dock")) continue;

    var dock = document.createElement("nav");
    dock.className = "module-dock";
    dock.setAttribute("aria-label", "All 6 Portal Modules");

    var html = '<div class="module-dock-head"><span class="tag">All 6 Modules</span>'
      + '<a href="#/" style="font-size:12.5px;font-weight:700;color:var(--acc);">Back to Dashboard &rarr;</a></div>'
      + '<div class="module-dock-grid">';

    for (var j = 0; j < PORTAL_MODULES.length; j++) {
      var mod = PORTAL_MODULES[j];
      html += '<a class="module-dock-btn" data-hash="' + mod.hash + '" href="' + mod.hash + '">'
        + '<span class="module-dock-kicker">' + mod.kicker + "</span>"
        + '<span class="module-dock-title">' + mod.label + "</span>"
        + "</a>";
    }
    html += "</div>";
    dock.innerHTML = html;
    sec.appendChild(dock);
  }
}

function syncModuleDockState(hash) {
  var btns = document.querySelectorAll(".module-dock-btn");
  for (var i = 0; i < btns.length; i++) {
    var h = btns[i].getAttribute("data-hash") || "";
    if (h && hash.indexOf(h) === 0) {
      btns[i].classList.add("active");
      btns[i].setAttribute("aria-current", "page");
    } else {
      btns[i].classList.remove("active");
      btns[i].removeAttribute("aria-current");
    }
  }
}

function updateNavIndicator() {
  var topNav = document.querySelector("nav.top");
  if (topNav) {
    document.documentElement.style.setProperty("--nav-h", topNav.offsetHeight + "px");
  }
  var indicator = document.getElementById("nav-indicator");
  var activeLink = document.querySelector("nav.top a.nav-link.active");
  if (!indicator || !activeLink) return;
  var wrap = activeLink.parentElement;
  if (!wrap) return;

  var wrapRect = wrap.getBoundingClientRect();
  var linkRect = activeLink.getBoundingClientRect();
  indicator.style.left = (linkRect.left - wrapRect.left) + "px";
  indicator.style.top = (linkRect.bottom - wrapRect.top - 2) + "px";
  indicator.style.bottom = "auto";
  indicator.style.width = linkRect.width + "px";
  indicator.style.opacity = "1";
}
window.addEventListener("resize", updateNavIndicator);

function getTargetElementForHash(hash) {
  if (hash.indexOf("#/map") === 0) return document.getElementById("app");
  if (hash.indexOf("#/predictor") === 0) return document.getElementById("view-predictor");
  if (hash.indexOf("#/ranking") === 0) return document.getElementById("view-ranking");
  if (hash.indexOf("#/benchmarks") === 0) return document.getElementById("view-benchmarks");
  if (hash.indexOf("#/clusters") === 0) return document.getElementById("view-clusters");
  if (hash.indexOf("#/farmers") === 0) return document.getElementById("view-farmers");
  return document.getElementById("view-home");
}

function triggerGenieExpand(card, targetHash) {
  var targetEl = getTargetElementForHash(targetHash);
  if (!targetEl) {
    location.hash = targetHash;
    return;
  }

  var rect = card.getBoundingClientRect();
  var scaleX = Math.max(0.12, rect.width / window.innerWidth);
  var scaleY = Math.max(0.12, rect.height / window.innerHeight);

  targetEl.style.setProperty("--genie-x", rect.left + "px");
  targetEl.style.setProperty("--genie-y", rect.top + "px");
  targetEl.style.setProperty("--genie-scale-x", scaleX.toFixed(3));
  targetEl.style.setProperty("--genie-scale-y", scaleY.toFixed(3));

  lastGenieOrigin = card;
  targetEl.classList.remove("genie-collapsing");
  targetEl.classList.add("genie-expanding");

  location.hash = targetHash;
  setTimeout(function() {
    targetEl.classList.remove("genie-expanding");
  }, 560);
}

function triggerGenieCollapse(targetHash, e) {
  if (e) e.preventDefault();
  var activeSection = document.querySelector("#app.on, .subview.on:not(#view-home)");
  if (activeSection && lastGenieOrigin) {
    var rect = lastGenieOrigin.getBoundingClientRect();
    var scaleX = Math.max(0.12, rect.width / window.innerWidth);
    var scaleY = Math.max(0.12, rect.height / window.innerHeight);

    activeSection.style.setProperty("--genie-x", rect.left + "px");
    activeSection.style.setProperty("--genie-y", rect.top + "px");
    activeSection.style.setProperty("--genie-scale-x", scaleX.toFixed(3));
    activeSection.style.setProperty("--genie-scale-y", scaleY.toFixed(3));
    activeSection.classList.remove("genie-expanding");
    activeSection.classList.add("genie-collapsing");

    setTimeout(function() {
      activeSection.classList.remove("genie-collapsing");
      location.hash = targetHash || "#/";
      lastGenieOrigin = null;
    }, 400);
  } else {
    location.hash = targetHash || "#/";
  }
}

function attachGenieCardClick(card) {
  card.addEventListener("click", function(e) {
    e.preventDefault();
    var targetHash = card.getAttribute("data-target");
    triggerGenieExpand(card, targetHash);
  });
}

function initGenieTransitions() {
  var navCards = document.querySelectorAll(".nav-card[data-target]");
  for (var i = 0; i < navCards.length; i++) {
    attachGenieCardClick(navCards[i]);
  }

  var homeLinks = document.querySelectorAll("nav.top a[href='#/'], .bar .ibtn, nav.top b");
  for (var j = 0; j < homeLinks.length; j++) {
    homeLinks[j].addEventListener("click", function(e) {
      if (location.hash && location.hash !== "#/") {
        triggerGenieCollapse("#/", e);
      }
    });
  }
}

function activateNavLink(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.add("active");
    el.setAttribute("aria-current", "page");
  }
}

function route() {
  var hash = location.hash || "#/";
  var sectionIds = [
    "app",
    "view-home",
    "view-predictor",
    "view-ranking",
    "view-benchmarks",
    "view-clusters",
    "view-farmers"
  ];

  for (var sIdx = 0; sIdx < sectionIds.length; sIdx++) {
    var secEl = document.getElementById(sectionIds[sIdx]);
    if (secEl) secEl.classList.remove("on");
  }

  var navLinks = document.querySelectorAll("nav.top a.nav-link");
  for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].classList.remove("active");
    navLinks[i].removeAttribute("aria-current");
  }

  if (hash.indexOf("#/map") === 0) {
    document.getElementById("app").classList.add("on");
    activateNavLink("nav-map");
    updateNavIndicator();
    setTimeout(function() { map.invalidateSize(); }, 60);
  } else if (hash.indexOf("#/predictor") === 0) {
    var predictorEl = document.getElementById("view-predictor");
    if (predictorEl) predictorEl.classList.add("on");
    activateNavLink("nav-predictor");
    loadFarmersData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (hash.indexOf("#/ranking") === 0) {
    document.getElementById("view-ranking").classList.add("on");
    activateNavLink("nav-ranking");
    if (allPriorityList.length === 0) {
      loadPriorityData();
    } else {
      renderPriorityKPIs(allPriorityList);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (hash.indexOf("#/benchmarks") === 0) {
    document.getElementById("view-benchmarks").classList.add("on");
    activateNavLink("nav-benchmarks");
    loadModelBenchmarks(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (hash.indexOf("#/clusters") === 0) {
    document.getElementById("view-clusters").classList.add("on");
    activateNavLink("nav-clusters");
    if (allClustersList.length === 0) loadClustersData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (hash.indexOf("#/farmers") === 0) {
    var farmersEl = document.getElementById("view-farmers");
    if (farmersEl) farmersEl.classList.add("on");
    activateNavLink("nav-farmers");
    populateFarmerLocationDropdowns();
    loadDatabasePortalData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    document.getElementById("view-home").classList.add("on");
    activateNavLink("nav-home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  syncModuleDockState(hash);
  setTimeout(updateNavIndicator, 20);
}

function escHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function populateFarmerLocationDropdowns() {
  var stSel = document.getElementById("farmer-state");
  var dtSel = document.getElementById("farmer-district");
  if (!stSel || !dtSel) return;

  var states = Object.keys(stateDistrictsList || {}).sort();
  if (states.length > 0) {
    fillFarmerStateSelect();
    return;
  }

  fetch("/api/districts/all")
    .then(function(r) { return r.json(); })
    .then(function(res) {
      var rows = res.districts || [];
      for (var i = 0; i < rows.length; i++) {
        var s = rows[i].state || "";
        var d = rows[i].district || "";
        if (!s || !d) continue;
        if (!stateDistrictsList[s]) stateDistrictsList[s] = [];
        if (stateDistrictsList[s].indexOf(d) === -1) stateDistrictsList[s].push(d);
      }
      fillFarmerStateSelect();
    })
    .catch(function() {});
}

function fillFarmerStateSelect() {
  var stSel = document.getElementById("farmer-state");
  var dtSel = document.getElementById("farmer-district");
  if (!stSel || !dtSel) return;

  var prevState = stSel.value;
  var states = Object.keys(stateDistrictsList || {}).sort();
  if (states.length === 0) return;

  stSel.innerHTML = "";
  for (var i = 0; i < states.length; i++) {
    var st = states[i];
    var opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    if (prevState && st === prevState) opt.selected = true;
    else if (!prevState && st === "Telangana") opt.selected = true;
    stSel.appendChild(opt);
  }
  stSel.onchange = function() {
    fillFarmerDistrictSelect(this.value, "");
  };
  fillFarmerDistrictSelect(stSel.value, "");
}

function fillFarmerDistrictSelect(stateName, selectedDist) {
  var dtSel = document.getElementById("farmer-district");
  if (!dtSel) return;
  var dists = (stateDistrictsList[stateName] || []).slice().sort();
  dtSel.innerHTML = "";

  for (var i = 0; i < dists.length; i++) {
    var dt = dists[i];
    var opt = document.createElement("option");
    opt.value = dt;
    opt.textContent = dt;
    if (selectedDist && dt.toLowerCase() === selectedDist.toLowerCase()) opt.selected = true;
    else if (!selectedDist && dt === "Khammam") opt.selected = true;
    dtSel.appendChild(opt);
  }
}

function checkDbHealth() {
  var banner = document.getElementById("db-status-banner");
  var dot = document.getElementById("db-status-dot");
  var title = document.getElementById("db-status-title");
  var detail = document.getElementById("db-status-detail");

  fetch("/api/db/health")
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!banner || !dot || !title || !detail) return;
      if (res.connected) {
        banner.className = "db-status-banner ok";
        dot.className = "db-status-dot ok";
        title.textContent = "MySQL Connected (" + (res.database || "crop_stress_db") + ")";
        detail.textContent = (res.farmers_count || 0) + " farmers · " + (res.predictions_count || 0) + " saved predictions";
      } else {
        banner.className = "db-status-banner err";
        dot.className = "db-status-dot err";
        title.textContent = "MySQL Offline (" + (res.database || "crop_stress_db") + ")";
        detail.textContent = res.error || "Check .env credentials and run database/crop_stress_db.sql";
      }
    })
    .catch(function() {
      if (banner && dot && title) {
        banner.className = "db-status-banner err";
        dot.className = "db-status-dot err";
        title.textContent = "Could not reach backend database health endpoint.";
      }
    });
}

function syncFarmerSelectDropdowns() {
  var predSel = document.getElementById("pred-farmer-select");
  if (predSel) {
    var prevVal = predSel.value;
    predSel.innerHTML = '<option value="">-- New or Guest Farmer --</option>';
    for (var i = 0; i < allFarmersList.length; i++) {
      var f = allFarmersList[i];
      var opt = document.createElement("option");
      opt.value = String(f.farmer_id);
      opt.textContent = f.farmer_name + " (" + f.district_name + ", " + f.primary_crop + ")";
      if (prevVal && prevVal === String(f.farmer_id)) opt.selected = true;
      predSel.appendChild(opt);
    }
  }

  var histSel = document.getElementById("history-farmer-filter");
  if (histSel) {
    var prevHist = histSel.value;
    histSel.innerHTML = '<option value="">All Farmers &amp; Checks</option>';
    for (var j = 0; j < allFarmersList.length; j++) {
      var hf = allFarmersList[j];
      var hOpt = document.createElement("option");
      hOpt.value = String(hf.farmer_id);
      hOpt.textContent = hf.farmer_name + " (" + hf.district_name + ")";
      if (prevHist && prevHist === String(hf.farmer_id)) hOpt.selected = true;
      histSel.appendChild(hOpt);
    }
  }
}

function renderFarmersTable(farmers) {
  var tbody = document.getElementById("farmers-tbody");
  if (!tbody) return;
  if (farmers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--mute);">No farmer records found yet. Add a farmer using the form above.</td></tr>';
    return;
  }

  var html = "";
  for (var i = 0; i < farmers.length; i++) {
    var f = farmers[i];
    html += "<tr>";
    html += '<td class="mono">#' + escHtml(f.farmer_id) + "</td>";
    html += "<td><b>" + escHtml(f.farmer_name) + "</b></td>";
    html += "<td>" + escHtml(f.phone || "—") + "<br><small style='color:var(--mute);'>" + escHtml(f.village || "—") + "</small></td>";
    html += "<td><b>" + escHtml(f.district_name) + "</b><br><small style='color:var(--mute);'>" + escHtml(f.state_name) + "</small></td>";
    html += "<td>" + escHtml(f.primary_crop) + "<br><small style='color:var(--mute);'>" + escHtml(f.soil_type) + "</small></td>";
    html += '<td class="mono">' + Number(f.land_area_acres || 0).toFixed(1) + " ac</td>";
    html += '<td class="mono"><span class="badge">' + escHtml(f.total_predictions || 0) + "</span></td>";
    html += '<td><div class="tbl-actions">';
    html += '<button type="button" class="tbl-btn use" onclick="useFarmerInPredictor(' + Number(f.farmer_id) + ')">Predict</button>';
    html += '<button type="button" class="tbl-btn edit" onclick="editFarmerRecord(' + Number(f.farmer_id) + ')">Edit</button>';
    html += '<button type="button" class="tbl-btn del" onclick="deleteFarmerRecord(' + Number(f.farmer_id) + ')">Delete</button>';
    html += "</div></td>";
    html += "</tr>";
  }
  tbody.innerHTML = html;
}

function loadFarmersData() {
  var searchEl = document.getElementById("farmers-search");
  var q = "";
  if (searchEl) q = searchEl.value.trim();

  fetch("/api/farmers?search=" + encodeURIComponent(q))
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e) {
          throw new Error(e.detail || ("HTTP " + r.status));
        });
      }
      return r.json();
    })
    .then(function(res) {
      allFarmersList = res.farmers || [];
      var kpiTotal = document.getElementById("kpi-farmers-total");
      if (kpiTotal) kpiTotal.textContent = String(allFarmersList.length);
      syncFarmerSelectDropdowns();
      renderFarmersTable(allFarmersList);
    })
    .catch(function(err) {
      var tbody = document.getElementById("farmers-tbody");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red);">MySQL unavailable: ' + escHtml(err.message) + "</td></tr>";
      }
    });
}

function renderPredictionHistoryTable(historyList) {
  var alerts = 0;
  var ipiSum = 0;
  for (var i = 0; i < historyList.length; i++) {
    var item = historyList[i];
    if (item.stress_level === "High" || item.stress_level === "Severe") {
      alerts += 1;
    }
    ipiSum += Number(item.priority_index || 0);
  }

  var kPred = document.getElementById("kpi-preds-total");
  var kAlert = document.getElementById("kpi-preds-alerts");
  var kAvg = document.getElementById("kpi-preds-avg");
  if (kPred) kPred.textContent = String(historyList.length);
  if (kAlert) kAlert.textContent = String(alerts);
  if (kAvg) {
    if (historyList.length > 0) {
      kAvg.textContent = (ipiSum / historyList.length).toFixed(1);
    } else {
      kAvg.textContent = "0.0";
    }
  }

  var tbody = document.getElementById("history-tbody");
  if (!tbody) return;

  if (historyList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--mute);">No predictions saved yet. Run a prediction from the Predictor tab to store it in MySQL.</td></tr>';
    return;
  }

  var html = "";
  for (var j = 0; j < historyList.length; j++) {
    var row = historyList[j];
    var badgeCls = getStressBadgeClass(row.stress_level);
    var villageHtml = "";
    if (row.village) {
      villageHtml = "<br><small style='color:var(--mute);'>" + escHtml(row.village) + "</small>";
    }

    html += "<tr>";
    html += '<td class="mono">#' + escHtml(row.prediction_id) + "</td>";
    html += '<td class="mono" style="font-size:12px;">' + escHtml(row.predicted_at || "") + "</td>";
    html += "<td><b>" + escHtml(row.farmer_name) + "</b>" + villageHtml + "</td>";
    html += "<td><b>" + escHtml(row.district_name) + "</b><br><small style='color:var(--mute);'>" + escHtml(row.state_name) + "</small></td>";
    html += "<td>" + escHtml(row.crop_name) + "<br><small style='color:var(--mute);'>" + escHtml(row.growth_stage) + " · " + escHtml(row.soil_type) + "</small></td>";
    html += '<td class="mono" style="font-size:12px;">' + Number(row.temperature).toFixed(1) + "°C / " + Number(row.rainfall).toFixed(1) + "mm / " + Number(row.soil_moisture).toFixed(2) + "</td>";
    html += '<td><span class="badge ' + badgeCls + '">' + escHtml(row.stress_level) + "</span></td>";
    html += '<td class="mono"><b>' + Number(row.priority_index).toFixed(1) + "</b></td>";
    html += '<td class="mono">' + escHtml(row.recommended_depth) + "</td>";
    html += '<td><button type="button" class="tbl-btn del" onclick="deletePredictionRecord(' + Number(row.prediction_id) + ')">Delete</button></td>';
    html += "</tr>";
  }
  tbody.innerHTML = html;
}

function loadPredictionHistory() {
  var searchEl = document.getElementById("history-search");
  var filterEl = document.getElementById("history-farmer-filter");
  var q = "";
  if (searchEl) q = searchEl.value.trim();

  var fid = "";
  if (filterEl) fid = filterEl.value;

  var url = "/api/predictions/history?search=" + encodeURIComponent(q);
  if (fid) url += "&farmer_id=" + encodeURIComponent(fid);

  fetch(url)
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e) {
          throw new Error(e.detail || ("HTTP " + r.status));
        });
      }
      return r.json();
    })
    .then(function(res) {
      allHistoryList = res.history || [];
      renderPredictionHistoryTable(allHistoryList);
    })
    .catch(function(err) {
      var tbody = document.getElementById("history-tbody");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--red);">MySQL unavailable: ' + escHtml(err.message) + "</td></tr>";
      }
    });
}

function loadDatabasePortalData() {
  checkDbHealth();
  loadFarmersData();
  loadPredictionHistory();
}

function resetFarmerForm() {
  document.getElementById("farmer-edit-id").value = "";
  document.getElementById("farmer-name").value = "";
  document.getElementById("farmer-phone").value = "";
  document.getElementById("farmer-village").value = "";
  document.getElementById("farmer-area").value = "2.5";
  document.getElementById("farmer-form-title").textContent = "Add New Farmer";
  document.getElementById("farmer-form-mode").textContent = "Create Record";
  document.getElementById("btn-save-farmer").textContent = "Save Farmer";
  document.getElementById("btn-cancel-farmer-edit").style.display = "none";
}

function findFarmerById(farmerId) {
  for (var i = 0; i < allFarmersList.length; i++) {
    if (allFarmersList[i].farmer_id === farmerId) {
      return allFarmersList[i];
    }
  }
  return null;
}

function editFarmerRecord(farmerId) {
  var fObj = findFarmerById(farmerId);
  if (!fObj) return;

  populateFarmerLocationDropdowns();
  document.getElementById("farmer-edit-id").value = String(fObj.farmer_id);
  document.getElementById("farmer-name").value = fObj.farmer_name || "";
  document.getElementById("farmer-phone").value = fObj.phone || "";
  document.getElementById("farmer-village").value = fObj.village || "";
  document.getElementById("farmer-area").value = String(fObj.land_area_acres || 2.5);

  var stSel = document.getElementById("farmer-state");
  if (stSel && fObj.state_name) {
    selectOptionCaseInsensitive(stSel, fObj.state_name);
    fillFarmerDistrictSelect(stSel.value, fObj.district_name);
  }
  var cropSel = document.getElementById("farmer-crop");
  if (cropSel && fObj.primary_crop) cropSel.value = fObj.primary_crop;

  var soilSel = document.getElementById("farmer-soil");
  if (soilSel && fObj.soil_type) soilSel.value = fObj.soil_type;

  document.getElementById("farmer-form-title").textContent = "Edit Farmer #" + fObj.farmer_id;
  document.getElementById("farmer-form-mode").textContent = "Update Record";
  document.getElementById("btn-save-farmer").textContent = "Update Farmer";
  document.getElementById("btn-cancel-farmer-edit").style.display = "inline-flex";
  document.getElementById("farmer-form-msg").textContent = "";
  document.getElementById("farmer-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteFarmerRecord(farmerId) {
  if (!confirm("Delete farmer #" + farmerId + " and all their saved prediction history?")) return;
  fetch("/api/farmers/" + encodeURIComponent(farmerId), { method: "DELETE" })
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e) {
          throw new Error(e.detail || "Delete failed");
        });
      }
      return r.json();
    })
    .then(function() {
      var msgEl = document.getElementById("farmer-form-msg");
      if (msgEl) msgEl.textContent = "";
      loadDatabasePortalData();
    })
    .catch(function(err) {
      alert("Could not delete farmer: " + err.message);
    });
}

function deletePredictionRecord(predictionId) {
  if (!confirm("Delete prediction record #" + predictionId + "?")) return;
  fetch("/api/predictions/" + encodeURIComponent(predictionId), { method: "DELETE" })
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e) {
          throw new Error(e.detail || "Delete failed");
        });
      }
      return r.json();
    })
    .then(function() {
      loadDatabasePortalData();
    })
    .catch(function(err) {
      alert("Could not delete prediction: " + err.message);
    });
}

function useFarmerInPredictor(farmerId) {
  var fObj = findFarmerById(farmerId);
  if (!fObj) return;
  location.hash = "#/predictor";
  setTimeout(function() {
    var sel = document.getElementById("pred-farmer-select");
    if (sel) {
      sel.value = String(fObj.farmer_id);
      if (typeof sel.onchange === "function") sel.onchange();
    }
    var cropEl = document.getElementById("pred-crop");
    if (cropEl && fObj.primary_crop) cropEl.value = fObj.primary_crop;
  }, 150);
}

function submitFarmerForm(e) {
  e.preventDefault();
  var msg = document.getElementById("farmer-form-msg");
  var editId = document.getElementById("farmer-edit-id").value.trim();

  var payload = {
    farmer_name: document.getElementById("farmer-name").value.trim(),
    phone: document.getElementById("farmer-phone").value.trim(),
    village: document.getElementById("farmer-village").value.trim(),
    state_name: document.getElementById("farmer-state").value,
    district_name: document.getElementById("farmer-district").value,
    primary_crop: document.getElementById("farmer-crop").value,
    soil_type: document.getElementById("farmer-soil").value,
    land_area_acres: parseFloat(document.getElementById("farmer-area").value) || 2.5
  };

  if (!payload.farmer_name) {
    if (msg) {
      msg.style.color = "var(--red)";
      msg.textContent = "Please enter farmer name.";
    }
    return;
  }

  var url = "/api/farmers";
  var method = "POST";
  if (editId) {
    url = "/api/farmers/" + encodeURIComponent(editId);
    method = "PUT";
  }

  fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e2) {
          throw new Error(e2.detail || "Save failed");
        });
      }
      return r.json();
    })
    .then(function(res) {
      if (msg) {
        msg.style.color = "var(--green)";
        msg.textContent = res.message || "Saved!";
      }
      resetFarmerForm();
      loadDatabasePortalData();
    })
    .catch(function(err) {
      if (msg) {
        msg.style.color = "var(--red)";
        msg.textContent = err.message;
      }
    });
}

function initFarmersView() {
  var form = document.getElementById("farmer-form");
  if (form) form.onsubmit = submitFarmerForm;

  var cancelBtn = document.getElementById("btn-cancel-farmer-edit");
  if (cancelBtn) cancelBtn.onclick = resetFarmerForm;

  var refreshBtn = document.getElementById("btn-refresh-db");
  if (refreshBtn) refreshBtn.onclick = loadDatabasePortalData;

  var fSearch = document.getElementById("farmers-search");
  if (fSearch) fSearch.oninput = loadFarmersData;

  var hSearch = document.getElementById("history-search");
  if (hSearch) hSearch.oninput = loadPredictionHistory;

  var hFilter = document.getElementById("history-farmer-filter");
  if (hFilter) hFilter.onchange = loadPredictionHistory;
}

function renderClassificationTable(clfMap, clfKeys, bestClfName) {
  var tbody = document.getElementById("eval-class-tbody");
  if (!tbody) return;
  var html = "";
  for (var i = 0; i < clfKeys.length; i++) {
    var name = clfKeys[i];
    var m = clfMap[name];
    var isBest = name === bestClfName;
    var nameCell = escHtml(name);
    if (isBest) {
      nameCell = "<b>" + nameCell + "</b>";
    }
    var badgeClass = "badge";
    var fallbackStatus = "Evaluated";
    if (isBest) {
      badgeClass = "badge best";
      fallbackStatus = "Best Overall";
    }
    html += "<tr>"
      + "<td>" + nameCell + "</td>"
      + '<td class="mono">' + (m.accuracy * 100).toFixed(2) + "%</td>"
      + '<td class="mono">' + (m.precision * 100).toFixed(2) + "%</td>"
      + '<td class="mono">' + (m.recall * 100).toFixed(2) + "%</td>"
      + '<td class="mono">' + (m.f1_score * 100).toFixed(2) + "%</td>"
      + '<td><span class="' + badgeClass + '">' + escHtml(m.status || fallbackStatus) + "</span></td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
}

function renderConfusionMatrix(bestClfName, bestClf, testRec) {
  var cmTitle = document.getElementById("bm-cm-title");
  if (cmTitle) cmTitle.textContent = bestClfName + " Confusion Matrix (N = " + testRec.toLocaleString() + " Test Samples)";

  var cmGrid = document.getElementById("eval-cm-grid");
  var cmMatrix = bestClf.confusion_matrix;
  if (!cmGrid || !Array.isArray(cmMatrix)) return;

  var shortLabels = ["Low", "Mod", "Hi", "Sev"];
  var cmHtml = "";
  for (var r = 0; r < cmMatrix.length; r++) {
    for (var c = 0; c < cmMatrix[r].length; c++) {
      var cls = "cm-cell cm-off";
      var fontRule = "";
      if (r === c) {
        cls = "cm-cell cm-diag";
        fontRule = ";font-weight:400";
      }
      cmHtml += '<div class="' + cls + '">' + escHtml(cmMatrix[r][c])
        + '<span style="font-size:9px' + fontRule + '">' + escHtml(shortLabels[c] || "") + "</span></div>";
    }
  }
  cmGrid.innerHTML = cmHtml;
}

function renderRegressionTable(regMap, regKeys, bestRegName) {
  var tbody = document.getElementById("eval-reg-tbody");
  if (!tbody) return;
  var html = "";
  for (var i = 0; i < regKeys.length; i++) {
    var name = regKeys[i];
    var m = regMap[name];
    var isBest = name === bestRegName;
    var nameCell = escHtml(name);
    var r2Cell = Number(m.r2_score).toFixed(4);
    var badgeClass = "badge";
    var fallbackStatus = "Evaluated";
    if (isBest) {
      nameCell = "<b>" + nameCell + "</b>";
      r2Cell = "<b>" + r2Cell + "</b>";
      badgeClass = "badge best";
      fallbackStatus = "Best Regressor";
    }
    html += "<tr>"
      + "<td>" + nameCell + "</td>"
      + '<td class="mono">' + r2Cell + "</td>"
      + '<td class="mono">' + Number(m.mae).toFixed(4) + "</td>"
      + '<td class="mono">' + Number(m.mse).toFixed(4) + "</td>"
      + '<td class="mono">' + Number(m.rmse).toFixed(4) + "</td>"
      + '<td><span class="' + badgeClass + '">' + escHtml(m.status || fallbackStatus) + "</span></td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
}

function renderModelBenchmarks(data, animate) {
  if (!data) return;
  var clfMap = data.classification || {};
  var regMap = data.regression || {};
  var clfKeys = Object.keys(clfMap);
  var regKeys = Object.keys(regMap);

  var bestClfName = data.best_classifier || clfKeys[0] || "Random Forest Classifier";
  var bestRegName = data.best_regressor || regKeys[0] || "Random Forest Regressor";
  var bestClf = clfMap[bestClfName] || {};
  var bestReg = regMap[bestRegName] || {};

  var secondaryClfName = bestClfName;
  if (clfKeys.length > 1) {
    secondaryClfName = clfKeys[1];
  }
  var secondaryClf = clfMap[secondaryClfName] || bestClf;

  var totalRec = Number(data.total_records || 0);
  var trainRec = Number(data.train_records || 0);
  var testRec = Number(data.test_records || 0);
  var nFeat = Number(data.n_features || 14);

  var homeAcc = document.getElementById("home-bm-acc");
  var homeR2 = document.getElementById("home-bm-r2");
  var homeMae = document.getElementById("home-bm-mae");
  var homeFeat = document.getElementById("home-bm-feat");
  var homeDesc = document.getElementById("card-bench-desc");

  if (homeAcc && bestClf.accuracy !== undefined) homeAcc.textContent = (bestClf.accuracy * 100).toFixed(2) + "%";
  if (homeR2 && bestReg.r2_score !== undefined) homeR2.textContent = Number(bestReg.r2_score).toFixed(4);
  if (homeMae && bestReg.mae !== undefined) homeMae.textContent = Number(bestReg.mae).toFixed(4);
  if (homeFeat) homeFeat.textContent = String(nFeat);
  if (homeDesc) homeDesc.textContent = "Verified Kaggle evaluation metrics across " + clfKeys.length + " classification and " + regKeys.length + " regression models.";

  var subEl = document.getElementById("bm-subtitle");
  if (subEl) {
    subEl.textContent = "Executed Kaggle notebook evaluation on " + totalRec.toLocaleString()
      + " records (" + trainRec.toLocaleString() + " training / " + testRec.toLocaleString()
      + " test split) comparing " + clfKeys.length + " classification and " + regKeys.length
      + " regression algorithms across " + nFeat + " features.";
  }

  var bestClfEl = document.getElementById("bm-best-clf-name");
  var rfAccEl = document.getElementById("bm-rf-acc");
  var rfF1El = document.getElementById("bm-rf-f1");
  if (bestClfEl) bestClfEl.textContent = bestClfName;
  if (rfAccEl && bestClf.accuracy !== undefined) {
    var accPct = Number((bestClf.accuracy * 100).toFixed(2));
    if (animate) animateNumber(rfAccEl, 80.0, accPct, 800, 2, "%");
    else rfAccEl.textContent = accPct.toFixed(2) + "%";
  }
  if (rfF1El && bestClf.f1_score !== undefined) {
    rfF1El.textContent = "Weighted F1: " + Number(bestClf.f1_score).toFixed(4) + " | Precision: " + Number(bestClf.precision || 0).toFixed(4);
  }

  var bestRegEl = document.getElementById("bm-best-reg-name");
  var rfR2El = document.getElementById("bm-rf-r2");
  var rfMaeEl = document.getElementById("bm-rf-mae-rmse");
  if (bestRegEl) bestRegEl.textContent = bestRegName;
  if (rfR2El && bestReg.r2_score !== undefined) {
    var r2Val = Number(bestReg.r2_score);
    if (animate) animateNumber(rfR2El, 0.7000, r2Val, 800, 4, "");
    else rfR2El.textContent = r2Val.toFixed(4);
  }
  if (rfMaeEl && bestReg.mae !== undefined) {
    rfMaeEl.textContent = "MAE: " + Number(bestReg.mae).toFixed(4) + " | RMSE: " + Number(bestReg.rmse || 0).toFixed(4);
  }

  var baseClfEl = document.getElementById("bm-base-clf-name");
  var baseAccEl = document.getElementById("bm-base-acc");
  var basePrecEl = document.getElementById("bm-base-prec");
  if (baseClfEl) baseClfEl.textContent = secondaryClfName;
  if (baseAccEl && secondaryClf.accuracy !== undefined) baseAccEl.textContent = (secondaryClf.accuracy * 100).toFixed(2) + "%";
  if (basePrecEl && secondaryClf.precision !== undefined) {
    basePrecEl.textContent = "Precision: " + Number(secondaryClf.precision).toFixed(4) + " | F1: " + Number(secondaryClf.f1_score || 0).toFixed(4);
  }

  var totRecEl = document.getElementById("bm-total-records");
  var featCntEl = document.getElementById("bm-feature-count");
  if (totRecEl) totRecEl.textContent = totalRec.toLocaleString();
  if (featCntEl) featCntEl.textContent = nFeat + " Physical Features (" + testRec.toLocaleString() + " Test Samples)";

  renderClassificationTable(clfMap, clfKeys, bestClfName);
  renderConfusionMatrix(bestClfName, bestClf, testRec);
  renderRegressionTable(regMap, regKeys, bestRegName);

  var takeawayEl = document.getElementById("bm-takeaway-text");
  if (takeawayEl && bestClf.accuracy !== undefined && bestReg.r2_score !== undefined) {
    takeawayEl.textContent = "Verified Kaggle evaluation: " + bestClfName
      + " achieves " + (bestClf.accuracy * 100).toFixed(2) + "% classification accuracy (Weighted F1: "
      + Number(bestClf.f1_score).toFixed(4) + ") and " + bestRegName + " achieves "
      + Number(bestReg.r2_score).toFixed(4) + " R² score (MAE: " + Number(bestReg.mae).toFixed(4)
      + ", RMSE: " + Number(bestReg.rmse).toFixed(4) + ") across all " + nFeat + " physical agro-climatic features.";
  }
}

function loadModelBenchmarks(animate) {
  if (cachedEvaluationData) {
    renderModelBenchmarks(cachedEvaluationData, animate);
    return;
  }
  fetch("/api/models/evaluation")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      cachedEvaluationData = data;
      renderModelBenchmarks(data, animate);
    })
    .catch(function(err) {
      console.warn("Could not load evaluation benchmarks:", err);
    });
}

window.editFarmerRecord = editFarmerRecord;
window.deleteFarmerRecord = deleteFarmerRecord;
window.deletePredictionRecord = deletePredictionRecord;
window.useFarmerInPredictor = useFarmerInPredictor;

window.onhashchange = route;

initModuleDocks();
initPriorityControls();
initClusterControls();
initCardTilt();
initGenieTransitions();
initFarmersView();
route();
setTimeout(updateNavIndicator, 80);

loadPriorityData();
loadClustersData();
loadFarmersData();
loadModelBenchmarks(false);
