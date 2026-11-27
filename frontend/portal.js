var LAYERS = {
  stress: {
    name: "Crop Stress",
    cat: ["#48A66A", "#E9BD45", "#EF873D", "#D94740"],
    labels: ["Low", "Moderate", "High", "Severe"]
  },
  ipi: {
    name: "Irrigation Priority",
    key: "ipi",
    unit: "/100",
    labels: ["Low", "Medium", "High"],
    colors: ["#48A66A", "#E9BD45", "#D94740"]
  },
  wet: {
    name: "Soil Wetness",
    key: "soil_wetness",
    unit: "",
    labels: ["Low", "Moderate", "High"],
    colors: ["#D6B66A", "#A5B66B", "#538F65"]
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
  dark: {
    name: "Dark",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
      maxZoom: 19
    }
  },
  light: {
    name: "Light",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
      maxZoom: 19
    }
  }
};

var currentBasemap = "dark";
var baseTileLayer = null;
var layer = "stress";
var DATA = {};
var statesGeo = null;
var distsGeo = null;
var stateLayer = null;
var distLayer = null;
var riskPulseLayerGroup = L.layerGroup();
var current = null;
var selected = null;
var selectedDistrictLayer = null;
var ranges = {};
var districtMap = {};
var stateBounds = {};
var stateList = [];
var stateCounts = {};
var stateSummaries = {};
var districtMlCache = {};
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

var map = L.map("map", { zoomControl: false, zoomSnap: 0.25, preferCanvas: false }).setView([22.8, 84.5], 4.5);
riskPulseLayerGroup.addTo(map);

if (!map.getPane("stateBoundariesPane")) {
  var statePane = map.createPane("stateBoundariesPane");
  statePane.style.zIndex = "650";
  statePane.style.pointerEvents = "none";
}

function normState(s) {
  var text = s || "";
  var cleaned = text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  if (cleaned === "andamanandnicobarislands") {
    return "andamanandnicobar";
  }
  return cleaned;
}

function formatStateName(s) {
  if (!s) return "";
  if (s.toUpperCase() === "JAMMU & KASHMIR" || s.toLowerCase() === "jammu and kashmir") {
    return "Jammu and Kashmir";
  }
  if (s.toLowerCase() === "andaman and nicobar islands") {
    return "Andaman and Nicobar";
  }
  return s;
}

function setGeoLoading(active, message) {
  var wrap = document.getElementById("geo-loading-wrap");
  var txt = document.getElementById("geo-loading-text");
  if (!wrap) return;
  if (active) {
    if (txt && message) txt.textContent = message;
    wrap.classList.add("on");
  } else {
    wrap.classList.remove("on");
  }
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

function getRiskStatusLabel(d) {
  if (!d) return "Data Unavailable";
  if (d.stress === "Severe" || d.ipi >= 60.0) return "Critical Risk";
  if (d.stress === "High" || d.ipi >= 45.0) return "High Risk";
  if (d.stress === "Moderate" || d.ipi >= 30.0) return "Elevated Risk";
  return "Optimal / Low Risk";
}

function getPriorityCategoryLabel(ipi) {
  if (ipi >= 50.0) return "High Priority";
  if (ipi >= 35.0) return "Medium Priority";
  return "Low Priority";
}

function getStressLayerColor(stressLevel) {
  if (stressLevel === "Severe") return "#D94740";
  if (stressLevel === "High") return "#EF873D";
  if (stressLevel === "Moderate") return "#E9BD45";
  return "#48A66A";
}

function getPriorityLayerColor(score) {
  if (score >= 50.0) return "#D94740";
  if (score >= 35.0) return "#E9BD45";
  return "#48A66A";
}

function getWetnessLayerColor(wetness) {
  if (wetness >= 0.55) return "#538F65";
  if (wetness >= 0.35) return "#A5B66B";
  return "#D6B66A";
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
  return "#FFF0D5";
}

function setBasemap(styleKey) {
  if (!BASEMAP_CONFIG[styleKey]) return;
  currentBasemap = styleKey;

  var appEl = document.getElementById("app");
  if (appEl) {
    appEl.setAttribute("data-basemap", styleKey);
  }

  var mapEl = document.getElementById("map");
  if (styleKey === "satellite" || styleKey === "dark") {
    mapEl.style.backgroundColor = "#171615";
  } else {
    mapEl.style.backgroundColor = "#fafaf8";
  }

  var tilePane = map.getPane("tilePane");
  if (tilePane) {
    tilePane.style.opacity = "0.28";
  }

  if (baseTileLayer) {
    map.removeLayer(baseTileLayer);
  }
  var cfg = BASEMAP_CONFIG[styleKey];
  baseTileLayer = L.tileLayer(cfg.url, cfg.options);
  baseTileLayer.on("load", function() {
    if (tilePane) {
      tilePane.style.opacity = "1";
    }
  });
  baseTileLayer.addTo(map);
  setTimeout(function() {
    if (tilePane) {
      tilePane.style.opacity = "1";
    }
  }, 450);

  if (distLayer) distLayer.bringToFront();
  if (stateLayer) stateLayer.bringToFront();

  var btns = document.querySelectorAll(".map-switcher .ms-btn[data-style]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle("active", btns[i].dataset.style === styleKey);
  }

  recolor();
}

setBasemap("dark");

function colorFor(d) {
  if (!d) {
    if (currentBasemap === "light") return "#d6cfc7";
    return "#332F2B";
  }

  if (layer === "stress") {
    return getStressLayerColor(d.stress);
  }

  if (layer === "ipi") {
    return getPriorityLayerColor(Number(d.ipi || 0));
  }

  if (layer === "wet") {
    return getWetnessLayerColor(Number(d.soil_wetness || 0));
  }

  return "#EF873D";
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

  var activeWeight = 1.6;
  var strokeOpacity = 0.80;
  if (isCurrent) {
    activeWeight = 3.6;
    strokeOpacity = 1.0;
  } else if (isHovered) {
    activeWeight = 3.0;
    strokeOpacity = 1.0;
  } else if (current) {
    activeWeight = 1.0;
    strokeOpacity = 0.30;
  }

  var strokeColor = "#F28C45";
  if (isCurrent || isHovered) {
    strokeColor = "#FFAD55";
  }

  var glowFill = "transparent";
  var glowFillOp = 0;
  if (!current && isHovered) {
    glowFill = "#F28C45";
    glowFillOp = 0.16;
  }

  return {
    fillColor: glowFill,
    fillOpacity: glowFillOp,
    color: strokeColor,
    weight: activeWeight,
    opacity: strokeOpacity,
    lineCap: "round",
    lineJoin: "round"
  };
}

function styleDist(f) {
  var d = dataFor(f.properties);
  var fill = colorFor(d);
  var hasData = Boolean(d);
  var nDistState = normState(f.properties.state);
  var inActiveState = current && nDistState === normState(current);
  var isStateDimmed = current && !inActiveState;
  var isStateHovered = !current && hoveredState && nDistState === hoveredState;

  var fillOpacity = 0.78;
  var borderColor = "rgba(23, 22, 21, 0.55)";
  var borderWeight = 0.75;
  var borderOpacity = 0.72;

  if (currentBasemap === "satellite") {
    fillOpacity = 0.72;
    borderColor = "rgba(255, 240, 213, 0.42)";
  } else if (currentBasemap === "light") {
    fillOpacity = 0.86;
    borderColor = "#49413A";
    borderOpacity = 0.40;
  }

  if (!hasData) {
    fillOpacity = 0.30;
  }

  if (isStateHovered) {
    fillOpacity = 0.92;
    borderColor = "#FFAD55";
    borderWeight = 1.0;
  } else if (inActiveState) {
    fillOpacity = 0.88;
    borderColor = "rgba(255, 240, 213, 0.65)";
    borderWeight = 1.1;
    borderOpacity = 0.90;
    if (currentBasemap === "light") {
      borderColor = "#49413A";
      borderOpacity = 0.58;
    }
  } else if (isStateDimmed) {
    fillOpacity = 0.10;
    borderOpacity = 0.18;
    borderWeight = 0.4;
  }

  return {
    fillColor: fill,
    fillOpacity: fillOpacity,
    color: borderColor,
    weight: borderWeight,
    opacity: borderOpacity
  };
}

function renderDynamicLegend() {
  var el = document.getElementById("map-legend");
  if (!el) return;

  var title = "Crop Stress Layer";
  var rows = [];

  if (layer === "stress") {
    title = "Crop Stress Gradient";
    rows = [
      { label: "Low", color: "#48A66A" },
      { label: "Moderate", color: "#E9BD45" },
      { label: "High", color: "#EF873D" },
      { label: "Severe", color: "#D94740" }
    ];
  } else if (layer === "ipi") {
    title = "Irrigation Priority";
    rows = [
      { label: "Low (< 35)", color: "#48A66A" },
      { label: "Medium (35–49)", color: "#E9BD45" },
      { label: "High (50+)", color: "#D94740" }
    ];
  } else {
    title = "Soil Wetness Index";
    rows = [
      { label: "Low (< 0.35)", color: "#D6B66A" },
      { label: "Moderate (0.35–0.54)", color: "#A5B66B" },
      { label: "High (0.55+)", color: "#538F65" }
    ];
  }

  var itemsHtml = "";
  for (var i = 0; i < rows.length; i++) {
    itemsHtml += "<div class='geo-legend-item'>"
      + "<span class='geo-legend-swatch' style='background:" + rows[i].color + ";'></span>"
      + "<span>" + rows[i].label + "</span>"
      + "</div>";
  }

  itemsHtml += "<div class='geo-legend-item'>"
    + "<span class='geo-legend-swatch' style='background:#F28C45;'></span>"
    + "<span>State Border</span>"
    + "</div>";

  el.innerHTML = "<div class='geo-legend-title'><span>" + title + "</span><span>732 Districts</span></div>"
    + "<div class='geo-legend-items'>" + itemsHtml + "</div>";
}

function escapeSingleQuote(str) {
  return String(str || "").replace(/'/g, "\\'");
}

function syncBreadcrumbControls() {
  var pillEl = document.getElementById("pill");
  var crumbState = document.getElementById("crumb-state");
  var crumbSepDist = document.getElementById("crumb-sep-district");
  var crumbDist = document.getElementById("crumb-district");
  var btnBackIndia = document.getElementById("btn-back-india");
  var btnBackState = document.getElementById("btn-back-state");

  if (pillEl) {
    pillEl.textContent = "INDIA";
  }

  if (!current) {
    if (crumbState) crumbState.style.display = "none";
    if (crumbSepDist) crumbSepDist.style.display = "none";
    if (crumbDist) crumbDist.style.display = "none";
    if (btnBackIndia) btnBackIndia.style.display = "none";
    if (btnBackState) btnBackState.style.display = "none";
    return;
  }

  if (crumbState) {
    crumbState.style.display = "inline-flex";
    crumbState.textContent = current;
  }
  if (btnBackIndia) {
    btnBackIndia.style.display = "inline-flex";
  }

  if (selected) {
    if (crumbSepDist) crumbSepDist.style.display = "inline";
    if (crumbDist) {
      crumbDist.style.display = "inline";
      crumbDist.textContent = selected.district;
    }
    if (btnBackState) {
      btnBackState.style.display = "inline-flex";
      btnBackState.textContent = "\u2190 Back to " + current;
    }
  } else {
    if (crumbSepDist) crumbSepDist.style.display = "none";
    if (crumbDist) crumbDist.style.display = "none";
    if (btnBackState) btnBackState.style.display = "none";
  }
}

function showMapTooltip(htmlContent, mouseEvent) {
  var tooltipEl = document.getElementById("map-tooltip");
  var appEl = document.getElementById("app");
  if (!tooltipEl || !appEl) return;

  tooltipEl.innerHTML = htmlContent;
  tooltipEl.classList.add("visible");
  tooltipEl.setAttribute("aria-hidden", "false");

  if (!mouseEvent || !mouseEvent.originalEvent) return;
  var rect = appEl.getBoundingClientRect();
  var clientX = mouseEvent.originalEvent.clientX - rect.left;
  var clientY = mouseEvent.originalEvent.clientY - rect.top;

  var boxW = tooltipEl.offsetWidth || 240;
  var boxH = tooltipEl.offsetHeight || 130;
  var left = clientX + 16;
  var top = clientY - 18;

  if (left + boxW > rect.width - 14) {
    left = clientX - boxW - 16;
  }
  if (left < 64) left = 64;
  if (top + boxH > rect.height - 14) {
    top = rect.height - boxH - 14;
  }
  if (top < 70) top = 70;

  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}

function hideMapTooltip() {
  var tooltipEl = document.getElementById("map-tooltip");
  if (!tooltipEl) return;
  tooltipEl.classList.remove("visible");
  tooltipEl.setAttribute("aria-hidden", "true");
}

function buildStateHoverTooltipHtml(stateName) {
  var summary = stateSummaries[normState(stateName)];
  if (!summary) {
    return "<div class='geo-tooltip-title'>" + stateName + "</div>"
      + "<div class='geo-tooltip-sub'>Indian State / Union Territory Boundary</div>"
      + "<div class='geo-tooltip-grid'><div><span>Coverage</span><b>Click to Explore</b></div><div><span>Districts</span><b>Boundary Only</b></div></div>";
  }
  var stressCol = getStressLayerColor(summary.dominantStress);
  var ipiCol = getPriorityLayerColor(summary.avgIpi);
  var wetCol = getWetnessLayerColor(summary.avgWet);
  return "<div class='geo-tooltip-title'>" + summary.name + "</div>"
    + "<div class='geo-tooltip-sub'>Click State to View " + summary.districtCount + " Districts</div>"
    + "<div class='geo-tooltip-grid'>"
    + "<div><span>Districts</span><b>" + summary.districtCount + "</b></div>"
    + "<div><span>Avg Priority</span><b style='color:" + ipiCol + ";'>" + summary.avgIpi.toFixed(1) + " / 100</b></div>"
    + "<div><span>Dominant Stress</span><b style='color:" + stressCol + ";'>" + summary.dominantStress + "</b></div>"
    + "<div><span>Soil Wetness</span><b style='color:" + wetCol + ";'>" + summary.avgWet.toFixed(2) + "</b></div>"
    + "</div>";
}

function buildDistrictHoverTooltipHtml(props, d) {
  var stateTitle = formatStateName(props.state);
  if (!d) {
    return "<div class='geo-tooltip-title'>" + props.district + "</div>"
      + "<div class='geo-tooltip-sub'>" + stateTitle + "</div>"
      + "<div class='geo-tooltip-grid'><div><span>Status</span><b>Data Unavailable</b></div><div><span>Boundary</span><b>Verified</b></div></div>";
  }
  var stressCol = getStressLayerColor(d.stress);
  var ipiCol = getPriorityLayerColor(Number(d.ipi || 0));
  var wetCol = getWetnessLayerColor(Number(d.soil_wetness || 0));
  return "<div class='geo-tooltip-title'>" + d.district + "</div>"
    + "<div class='geo-tooltip-sub'>" + formatStateName(d.state) + " · " + (d.crop || "Mixed") + "</div>"
    + "<div class='geo-tooltip-grid'>"
    + "<div><span>Crop Stress</span><b style='color:" + stressCol + ";'>" + d.stress + "</b></div>"
    + "<div><span>Priority</span><b style='color:" + ipiCol + ";'>" + d.ipi + " / 100</b></div>"
    + "<div><span>Soil Wetness</span><b style='color:" + wetCol + ";'>" + d.soil_wetness + "</b></div>"
    + "<div><span>Risk Status</span><b>" + getRiskStatusLabel(d) + "</b></div>"
    + "</div>";
}

function animateIntelNumbers() {
  var els = document.querySelectorAll("#info .intel-anim-num");
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var target = parseFloat(el.getAttribute("data-target"));
    var decimals = parseInt(el.getAttribute("data-decimals"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (!isNaN(target)) {
      animateNumber(el, 0, target, 420, decimals, suffix);
    }
  }
}

function buildIndiaOverviewHtml() {
  var highCount = 0;
  var modCount = 0;
  var totalWet = 0;
  var count = 0;
  for (var k in DATA) {
    var row = DATA[k];
    count += 1;
    totalWet += Number(row.soil_wetness || 0);
    if (row.stress === "High" || row.stress === "Severe") highCount += 1;
    else if (row.stress === "Moderate") modCount += 1;
  }
  var meanWet = 0;
  if (count > 0) meanWet = totalWet / count;

  return "<span class='tag' style='color:var(--geo-accent);margin-bottom:4px;'>INDIA GEOSPATIAL INTELLIGENCE</span>"
    + "<h4>All-India Overview</h4>"
    + "<p>Interactive view across all 37 States/UTs and " + count + " districts. Hover a state boundary or click any state to enter State Map mode.</p>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>National Agricultural Snapshot</div>"
    + "<div class='intel-kpi-grid'>"
    + "<div class='intel-kpi'><span>Districts Covered</span><b class='intel-anim-num' data-target='" + count + "' data-decimals='0'>0</b></div>"
    + "<div class='intel-kpi'><span>High / Severe Stress</span><b style='color:#D94740;' class='intel-anim-num' data-target='" + highCount + "' data-decimals='0'>0</b></div>"
    + "<div class='intel-kpi'><span>Moderate Stress</span><b style='color:#E9BD45;' class='intel-anim-num' data-target='" + modCount + "' data-decimals='0'>0</b></div>"
    + "<div class='intel-kpi'><span>Mean Soil Wetness</span><b style='color:" + getWetnessLayerColor(meanWet) + ";' class='intel-anim-num' data-target='" + meanWet.toFixed(2) + "' data-decimals='2'>0.00</b></div>"
    + "</div></div>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>Navigation Guide</div>"
    + "<p>1. Click any State (e.g. Telangana) or pick from dropdown.</p>"
    + "<p>2. Select any District to run live Random Forest intelligence.</p>"
    + "</div>";
}

function buildStateSummaryHtml() {
  var summary = stateSummaries[normState(current)];
  if (!summary) {
    return "<span class='tag' style='color:var(--geo-accent);margin-bottom:4px;'>STATE GEOGRAPHY</span>"
      + "<h4>" + current + "</h4>"
      + "<div style='margin:8px 0;'><span class='badge'>Data Unavailable</span></div>"
      + "<p>Boundary loaded cleanly for " + current + ". Detailed district benchmark observations are unavailable for this union territory in the dataset.</p>"
      + "<div class='intel-actions'>"
      + "<button type='button' class='btn fill' onclick=\"filterByState('ALL')\">Back to India</button>"
      + "</div>";
  }

  return "<span class='tag' style='color:var(--geo-highlight);margin-bottom:4px;'>STATE INTELLIGENCE VIEW</span>"
    + "<h4>" + summary.name + "</h4>"
    + "<p>Click any highlighted district boundary inside " + summary.name + " to open its ML District Intelligence Panel.</p>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>State Agricultural Statistics</div>"
    + "<div class='intel-kpi-grid'>"
    + "<div class='intel-kpi'><span>Total Districts</span><b class='intel-anim-num' data-target='" + summary.districtCount + "' data-decimals='0'>0</b></div>"
    + "<div class='intel-kpi'><span>Avg Priority Index</span><b style='color:" + getPriorityLayerColor(summary.avgIpi) + ";' class='intel-anim-num' data-target='" + summary.avgIpi.toFixed(1) + "' data-decimals='1'>0.0</b></div>"
    + "<div class='intel-kpi'><span>Dominant Stress</span><b style='color:" + getStressLayerColor(summary.dominantStress) + ";'>" + summary.dominantStress + "</b></div>"
    + "<div class='intel-kpi'><span>Mean Soil Wetness</span><b style='color:" + getWetnessLayerColor(summary.avgWet) + ";' class='intel-anim-num' data-target='" + summary.avgWet.toFixed(2) + "' data-decimals='2'>0.00</b></div>"
    + "<div class='intel-kpi'><span>Primary Crop</span><b>" + summary.dominantCrop + "</b></div>"
    + "<div class='intel-kpi'><span>Verified Rows</span><b>" + summary.dataCount + " / " + summary.districtCount + "</b></div>"
    + "</div></div>"
    + "<div class='intel-actions'>"
    + "<button type='button' class='btn fill' onclick=\"filterByState('ALL')\">&larr; Back to India</button>"
    + "</div>";
}

function lookupPriorityRecord(stateName, distName) {
  var nDt = normState(distName);
  var nSt = normState(stateName);
  for (var i = 0; i < allPriorityList.length; i++) {
    var row = allPriorityList[i];
    if (normState(row.district) === nDt && normState(row.state) === nSt) {
      return row;
    }
  }
  return null;
}

function lookupClusterRecord(stateName, distName) {
  var nDt = normState(distName);
  var nSt = normState(stateName);
  for (var i = 0; i < allClustersList.length; i++) {
    var row = allClustersList[i];
    if (normState(row.district) === nDt && normState(row.state) === nSt) {
      return row;
    }
  }
  return null;
}

function getPeakModelProbability(probs) {
  if (!probs) return null;
  var bestLabel = "";
  var bestVal = -1;
  for (var key in probs) {
    if (Number(probs[key]) > bestVal) {
      bestVal = Number(probs[key]);
      bestLabel = key;
    }
  }
  if (bestVal < 0) return null;
  return { label: bestLabel, pct: (bestVal * 100).toFixed(1) };
}

function buildDistrictInfoHtml(d, mlRes) {
  var stateTitle = formatStateName(d.state);
  var priorityRec = lookupPriorityRecord(d.state, d.district);
  var clusterRec = lookupClusterRecord(d.state, d.district);

  var stressLevel = d.stress;
  var ipiScore = Number(d.ipi || 0);
  var priorityCat = getPriorityCategoryLabel(ipiScore);
  var depthText = "Based on model priority score";
  var reasonText = "Derived from verified crop water stress index and district baseline observations.";
  var actionText = "Monitor field moisture and align irrigation with crop stage.";
  var deficitText = "";
  var probs = null;

  if (priorityRec) {
    priorityCat = priorityRec.priority_category || priorityCat;
    depthText = priorityRec.recommended_irrigation_depth || depthText;
    deficitText = " · Daily Deficit: " + priorityRec.daily_water_deficit_mm + " mm";
  }

  if (mlRes && mlRes.crop_stress_prediction && mlRes.irrigation_priority_prediction) {
    var cs = mlRes.crop_stress_prediction;
    var ip = mlRes.irrigation_priority_prediction;
    var ag = mlRes.calculated_agronomic_indicators || {};
    stressLevel = cs.stress_level || stressLevel;
    ipiScore = Number(ip.irrigation_priority_index || ipiScore);
    priorityCat = ip.priority_category || priorityCat;
    depthText = ip.recommended_irrigation_depth || depthText;
    reasonText = cs.condition_summary || reasonText;
    actionText = ip.actionable_farmer_advisory || actionText;
    probs = cs.stress_probabilities || null;
    if (ag.daily_water_deficit_mm !== undefined) {
      deficitText = " · Daily Deficit: " + Number(ag.daily_water_deficit_mm).toFixed(1) + " mm";
    }
  }

  var badgeCls = getStressBadgeClass(stressLevel);
  var riskStatus = getRiskStatusLabel({ stress: stressLevel, ipi: ipiScore });
  var regionText = "India Agro-Climatic Grid";
  if (clusterRec) {
    regionText = "Zone " + clusterRec.cluster_id + ": " + clusterRec.cluster_name;
  }

  var rankHtml = "";
  if (priorityRec && priorityRec.rank) {
    rankHtml = " · Rank #" + priorityRec.rank + " / 732";
  }

  var confHtml = "";
  if (probs) {
    var peak = getPeakModelProbability(probs);
    var confBars = "";
    var order = ["Low", "Moderate", "High", "Severe"];
    for (var i = 0; i < order.length; i++) {
      var lbl = order[i];
      var pct = ((Number(probs[lbl] || 0)) * 100).toFixed(1);
      confBars += "<div class='intel-conf-row'>"
        + "<span class='intel-conf-lbl'>" + lbl + "</span>"
        + "<div class='intel-conf-track'><div class='intel-conf-fill' style='width:" + pct + "%;'></div></div>"
        + "<span class='intel-conf-pct'>" + pct + "%</span>"
        + "</div>";
    }
    var peakText = "";
    if (peak) {
      peakText = " (" + peak.label + " confidence: " + peak.pct + "%)";
    }
    confHtml = "<div class='intel-section-title' style='margin-top:10px;'>Model Class Probabilities" + peakText + "</div>"
      + "<div class='intel-conf-list'>" + confBars + "</div>";
  } else {
    confHtml = "<div style='font-size:11px;color:var(--geo-muted);margin-top:6px;'>Loading live Random Forest class probabilities...</div>";
  }

  var monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var barsHtml = "";
  for (var m = 6; m <= 11; m++) {
    var heightPx = Math.max(4, (d.months[m] || 0) * 0.55);
    barsHtml += "<div data-m='" + monthNames[m] + "' style='height:" + heightPx + "px'></div>";
  }

  var safeState = escapeSingleQuote(d.state);
  var safeDistrict = escapeSingleQuote(d.district);

  return "<span class='tag' style='color:var(--geo-accent);margin-bottom:4px;'>DISTRICT INTELLIGENCE PANEL</span>"
    + "<h4>" + d.district + ", " + stateTitle + "</h4>"
    + "<div style='display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px;'>"
    + "<span class='badge " + badgeCls + "'>" + stressLevel + " Stress</span>"
    + "<span class='badge'>" + riskStatus + "</span>"
    + "</div>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>1. Geographical Information</div>"
    + "<p><b>Region Cluster:</b> " + regionText + "</p>"
    + "<p><b>Crop &amp; Soil:</b> " + (d.crop || "Mixed") + " · " + (d.soil_type || "Alluvial") + " · Irrig Coverage: " + (d.irrigation_coverage || 45) + "%</p>"
    + "</div>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>2. ML Intelligence" + rankHtml + "</div>"
    + "<div class='intel-kpi-grid'>"
    + "<div class='intel-kpi'><span>Crop Stress</span><b style='color:" + getStressLayerColor(stressLevel) + ";'>" + stressLevel + "</b></div>"
    + "<div class='intel-kpi'><span>Irrigation Priority</span><b style='color:" + getPriorityLayerColor(ipiScore) + ";' class='intel-anim-num' data-target='" + ipiScore.toFixed(1) + "' data-decimals='1' data-suffix='/100'>0.0</b></div>"
    + "<div class='intel-kpi'><span>Risk Class</span><b>" + priorityCat + "</b></div>"
    + "<div class='intel-kpi'><span>Soil Wetness</span><b style='color:" + getWetnessLayerColor(Number(d.soil_wetness || 0)) + ";' class='intel-anim-num' data-target='" + Number(d.soil_wetness).toFixed(2) + "' data-decimals='2'>0.00</b></div>"
    + "</div>"
    + confHtml
    + "</div>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>3. Irrigation Recommendation</div>"
    + "<div class='intel-advisory-box'>"
    + "<p style='margin:0 0 4px;color:var(--geo-text);'><b>Priority &amp; Depth:</b> " + priorityCat + " (" + depthText + ")</p>"
    + "<p style='margin:0 0 4px;color:var(--geo-muted);'><b>Reason:</b> " + reasonText + "</p>"
    + "<p style='margin:0 0 4px;color:var(--geo-muted);'><b>Environment:</b> Temp " + (d.temperature || 28) + "°C · Humidity " + (d.humidity || 60) + "% · Rain " + d.rainfall + " mm · NDVI " + d.ndvi + deficitText + "</p>"
    + "<p style='margin:0;color:var(--geo-highlight);'><b>Action:</b> " + actionText + "</p>"
    + "</div>"
    + "</div>"
    + "<div class='intel-section'>"
    + "<div class='intel-section-title'>Jun–Nov Seasonal Priority Trend</div>"
    + "<div class='chart'>" + barsHtml + "</div>"
    + "</div>"
    + "<div class='intel-actions'>"
    + "<button type='button' onclick=\"openDistrictInPredictor('" + safeState + "', '" + safeDistrict + "')\" class='btn fill'>Open in Predictor</button>"
    + "<button type='button' onclick=\"backToParentState()\" class='geo-action-btn'>&larr; Back to " + stateTitle + "</button>"
    + "</div>";
}

function showInfo(d, p, mlRes) {
  var el = document.getElementById("info");
  if (!el) return;
  var html = "";

  if (!p) {
    if (current) {
      html = buildStateSummaryHtml();
    } else {
      html = buildIndiaOverviewHtml();
    }
  } else if (!d) {
    html = "<span class='tag' style='color:var(--geo-muted);margin-bottom:4px;'>GEOGRAPHICAL BOUNDARY</span>"
      + "<h4>" + p.district + ", " + formatStateName(p.state) + "</h4>"
      + "<div style='margin:8px 0;'><span class='badge'>Data Unavailable</span></div>"
      + "<p style='line-height:1.5;'>Boundary geometry verified for " + p.district + ". Agricultural telemetry and ML prediction data are unavailable for this district in the current dataset.</p>"
      + "<div class='intel-actions'>"
      + "<button type='button' onclick=\"backToParentState()\" class='geo-action-btn'>&larr; Back to State</button>"
      + "</div>";
  } else {
    html = buildDistrictInfoHtml(d, mlRes);
  }

  el.innerHTML = html;
  el.scrollTop = 0;
  animateIntelNumbers();
  renderDynamicLegend();
}

function fetchDistrictMlIntelligence(props, d) {
  if (!d || !props) return;
  var cacheKey = normState(props.state) + "|" + normState(props.district);
  if (districtMlCache[cacheKey]) {
    if (selected && normState(selected.district) === normState(props.district)) {
      showInfo(d, props, districtMlCache[cacheKey]);
    }
    return;
  }

  setGeoLoading(true, "Running ML intelligence for " + props.district + "...");

  var payload = {
    state: formatStateName(props.state),
    district: props.district,
    temperature: Number(d.temperature || 28.0),
    rainfall: Number(d.rainfall || 2.0),
    humidity: Number(d.humidity || 60.0),
    effective_soil_wetness: Number(d.soil_wetness || 0.45),
    ndvi: Number(d.ndvi || 0.55),
    crop_type: d.crop || "Cotton",
    growth_stage: "Reproductive",
    save_history: false
  };

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
      setGeoLoading(false);
      districtMlCache[cacheKey] = res;
      if (selected && normState(selected.district) === normState(props.district)) {
        showInfo(d, props, res);
      }
    })
    .catch(function() {
      setGeoLoading(false);
    });
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

function getFitBoundsOptions(maxZoomLimit) {
  if (window.innerWidth > 900) {
    return {
      duration: 1.0,
      maxZoom: maxZoomLimit,
      paddingTopLeft: [45, 55],
      paddingBottomRight: [370, 35]
    };
  }
  return {
    duration: 1.0,
    maxZoom: maxZoomLimit,
    paddingTopLeft: [20, 40],
    paddingBottomRight: [20, 220]
  };
}

function selectDistrict(props, ly, skipFly) {
  if (!props || !ly) return;
  var parentState = formatStateName(props.state);
  if (!current || normState(current) !== normState(parentState)) {
    current = parentState;
    document.getElementById("state-select").value = parentState;
  }

  if (selectedDistrictLayer && distLayer) {
    if (selectedDistrictLayer._path) {
      selectedDistrictLayer._path.classList.remove("geo-district-selected");
    }
    distLayer.resetStyle(selectedDistrictLayer);
  }
  selectedDistrictLayer = ly;
  selected = props;

  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);

  ly.setStyle({
    weight: 3.8,
    color: getSelectedDistrictColor(),
    fillOpacity: 0.94,
    opacity: 1
  });
  if (ly._path) {
    ly._path.classList.add("geo-district-selected");
  }
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    ly.bringToFront();
  }
  if (stateLayer) {
    stateLayer.bringToFront();
  }

  if (!skipFly) {
    map.flyToBounds(ly.getBounds(), getFitBoundsOptions(8.5));
  }

  syncBreadcrumbControls();
  updateRiskPulseMarkers();
  var distData = dataFor(props);
  var cacheKey = normState(props.state) + "|" + normState(props.district);
  showInfo(distData, props, districtMlCache[cacheKey] || null);
  fetchDistrictMlIntelligence(props, distData);
}

function clearSelectedDistrict() {
  if (selectedDistrictLayer && distLayer) {
    if (selectedDistrictLayer._path) {
      selectedDistrictLayer._path.classList.remove("geo-district-selected");
    }
    distLayer.resetStyle(selectedDistrictLayer);
  }
  selectedDistrictLayer = null;
  selected = null;
}

window.backToParentState = function() {
  if (!current) {
    filterByState("ALL");
    return;
  }
  filterByState(current);
};

function filterByState(stName) {
  clearSelectedDistrict();
  hideMapTooltip();

  if (!stName || stName === "ALL") {
    current = null;
    document.getElementById("state-select").value = "ALL";
    if (distLayer) distLayer.setStyle(styleDist);
    if (stateLayer) stateLayer.setStyle(styleState);
    map.flyTo([22.8, 84.5], 4.5, { duration: 1.1 });
    syncBreadcrumbControls();
    updateRiskPulseMarkers();
    showInfo(null, null);
    return;
  }

  var formatted = formatStateName(stName);
  current = formatted;
  var stateSelectEl = document.getElementById("state-select");
  if (stateSelectEl) {
    selectOptionCaseInsensitive(stateSelectEl, formatted);
  }

  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) {
    stateLayer.setStyle(styleState);
    stateLayer.bringToFront();
  }

  var nSt = normState(formatted);
  var bounds = stateBounds[nSt];
  if (bounds && bounds.isValid()) {
    map.flyToBounds(bounds, getFitBoundsOptions(7.5));
  }
  syncBreadcrumbControls();
  updateRiskPulseMarkers();
  showInfo(null, null);
}

function updateRiskPulseMarkers() {
  if (!riskPulseLayerGroup || !distsGeo) return;
  riskPulseLayerGroup.clearLayers();

  var candidates = [];
  for (var k in districtMap) {
    var ly = districtMap[k];
    var props = ly.feature.properties;
    if (current && normState(props.state) !== normState(current)) {
      continue;
    }
    var d = dataFor(props);
    if (!d) continue;

    var isRisk = false;
    var pulseColor = "#EF873D";
    var score = Number(d.ipi || 0);

    if (layer === "stress") {
      if (d.stress === "Severe" || d.stress === "High") {
        isRisk = true;
        if (d.stress === "Severe") pulseColor = "#D94740";
      }
    } else if (layer === "ipi") {
      if (d.ipi >= 50.0) {
        isRisk = true;
        pulseColor = "#D94740";
      }
    } else if (layer === "wet") {
      if (d.soil_wetness < 0.30) {
        isRisk = true;
        pulseColor = "#D6B66A";
      }
    }

    if (isRisk) {
      candidates.push({
        layerObj: ly,
        score: score,
        color: pulseColor
      });
    }
  }

  candidates.sort(function(a, b) { return b.score - a.score; });

  var maxMarkers = 15;
  if (current) {
    maxMarkers = 40;
  }
  var limit = Math.min(candidates.length, maxMarkers);

  for (var i = 0; i < limit; i++) {
    var item = candidates[i];
    var center = item.layerObj.getBounds().getCenter();
    var icon = L.divIcon({
      className: "geo-pulse-marker",
      html: "<div class='geo-pulse-wrap' style='--geo-pulse-color:" + item.color + ";'>"
        + "<div class='geo-risk-pulse-ring'></div>"
        + "<div class='geo-risk-pulse-core'></div>"
        + "</div>",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker(center, { icon: icon, interactive: false, keyboard: false }).addTo(riskPulseLayerGroup);
  }
}

function recolor() {
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);
  if (selectedDistrictLayer) {
    selectedDistrictLayer.setStyle({ weight: 3.8, color: getSelectedDistrictColor(), fillOpacity: 0.94 });
    if (selectedDistrictLayer._path) {
      selectedDistrictLayer._path.classList.add("geo-district-selected");
    }
  }
  updateRiskPulseMarkers();
  var selectedData = null;
  var cacheKey = "";
  var cachedMl = null;
  if (selected) {
    selectedData = dataFor(selected);
    cacheKey = normState(selected.state) + "|" + normState(selected.district);
    cachedMl = districtMlCache[cacheKey] || null;
  }
  showInfo(selectedData, selected, cachedMl);
}

function syncLayerButtonsState() {
  var btns = document.querySelectorAll(".layer-dock .ld-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle("active", btns[i].getAttribute("data-layer") === layer);
  }
}

function setActiveLayer(layerKey) {
  if (!LAYERS[layerKey]) return;
  layer = layerKey;
  syncLayerButtonsState();
  buildLayerLinks();
  recolor();
}

function buildLayerLinks() {
  var html = "";
  for (var k in LAYERS) {
    var activeClass = "";
    if (k === layer) {
      activeClass = "sel";
    }
    html += "<a data-k='" + k + "' class='" + activeClass + "'>" + LAYERS[k].name + "</a>";
  }
  var box = document.getElementById("layers");
  if (!box) return;
  box.innerHTML = html;
  box.onclick = function(e) {
    if (e.target.dataset.k) {
      setActiveLayer(e.target.dataset.k);
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

function computeStateSummaries() {
  stateSummaries = {};
  if (!distsGeo) return;

  for (var i = 0; i < distsGeo.features.length; i++) {
    var props = distsGeo.features[i].properties;
    var stName = formatStateName(props.state);
    var nSt = normState(stName);
    if (!stateSummaries[nSt]) {
      stateSummaries[nSt] = {
        name: stName,
        districtCount: 0,
        dataCount: 0,
        ipiSum: 0,
        wetSum: 0,
        stressCounts: {},
        cropCounts: {}
      };
    }
    var entry = stateSummaries[nSt];
    entry.districtCount += 1;

    var d = dataFor(props);
    if (d) {
      entry.dataCount += 1;
      entry.ipiSum += Number(d.ipi || 0);
      entry.wetSum += Number(d.soil_wetness || 0);
      if (d.stress) {
        entry.stressCounts[d.stress] = (entry.stressCounts[d.stress] || 0) + 1;
      }
      if (d.crop) {
        entry.cropCounts[d.crop] = (entry.cropCounts[d.crop] || 0) + 1;
      }
    }
  }

  for (var k in stateSummaries) {
    var s = stateSummaries[k];
    s.avgIpi = 0;
    s.avgWet = 0;
    if (s.dataCount > 0) {
      s.avgIpi = s.ipiSum / s.dataCount;
      s.avgWet = s.wetSum / s.dataCount;
    }
    s.dominantStress = pickTopKey(s.stressCounts, "Low");
    s.dominantCrop = pickTopKey(s.cropCounts, "Mixed");
  }
}

function pickTopKey(freqMap, fallback) {
  var bestKey = fallback;
  var bestCount = -1;
  for (var key in freqMap) {
    if (freqMap[key] > bestCount) {
      bestCount = freqMap[key];
      bestKey = key;
    }
  }
  return bestKey;
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

  selectDistrict(ly.feature.properties, ly, false);
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

    var cacheKey = normState(ly.feature.properties.state) + "|" + normState(ly.feature.properties.district);
    districtMlCache[cacheKey] = res;
    selectDistrict(ly.feature.properties, ly, false);
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
    var parentStateName = formatStateName(feature.properties.state);
    if (!current) {
      filterByState(parentStateName);
      return;
    }
    if (normState(parentStateName) !== normState(current)) {
      filterByState(parentStateName);
      return;
    }
    selectDistrict(feature.properties, layerObj, false);
  });

  layerObj.on("mouseover", function(e) {
    hoveredState = nSt;
    if (!current) {
      if (stateLayer) stateLayer.setStyle(styleState);
      if (distLayer) distLayer.setStyle(styleDist);
      showMapTooltip(buildStateHoverTooltipHtml(formatStateName(feature.properties.state)), e);
      return;
    }

    if (layerObj !== selectedDistrictLayer) {
      layerObj.setStyle({ weight: 2.8, color: "#FFC66D", fillOpacity: 0.96, opacity: 1.0 });
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layerObj.bringToFront();
      }
      if (stateLayer) stateLayer.bringToFront();
    }
    showMapTooltip(buildDistrictHoverTooltipHtml(feature.properties, dataFor(feature.properties)), e);
  });

  layerObj.on("mousemove", function(e) {
    if (!current) {
      showMapTooltip(buildStateHoverTooltipHtml(formatStateName(feature.properties.state)), e);
    } else {
      showMapTooltip(buildDistrictHoverTooltipHtml(feature.properties, dataFor(feature.properties)), e);
    }
  });

  layerObj.on("mouseout", function() {
    hoveredState = null;
    if (stateLayer) stateLayer.setStyle(styleState);
    if (!current) {
      if (distLayer) distLayer.setStyle(styleDist);
    } else if (layerObj !== selectedDistrictLayer && distLayer) {
      distLayer.resetStyle(layerObj);
    }
    hideMapTooltip();
  });
}

function populateMapControls() {
  stateList = [];
  var seenStates = {};
  stateCounts = {};
  districtMap = {};

  if (statesGeo && statesGeo.features) {
    for (var s = 0; s < statesGeo.features.length; s++) {
      var stFromGeo = formatStateName(statesGeo.features[s].properties.state);
      var nGeoSt = normState(stFromGeo);
      if (!seenStates[nGeoSt]) {
        seenStates[nGeoSt] = stFromGeo;
        stateList.push(stFromGeo);
      }
    }
  }

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
    coverageBadge.textContent = distsGeo.features.length + " Districts · " + stateList.length + " States/UTs";
  }

  var sel = document.getElementById("state-select");
  sel.innerHTML = "<option value='ALL'>All States / UTs (" + stateList.length + ")</option>";
  for (var j = 0; j < stateList.length; j++) {
    var st = stateList[j];
    var cnt = stateCounts[normState(st)] || 0;
    var opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st + " (" + cnt + ")";
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

setGeoLoading(true, "Loading India boundaries & agricultural datasets...");

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
    computeStateSummaries();
    syncLayerButtonsState();
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

    for (var sbIdx = 0; sbIdx < statesGeo.features.length; sbIdx++) {
      var stFeat = statesGeo.features[sbIdx];
      var sbName = formatStateName(stFeat.properties.state);
      var sbNorm = normState(sbName);
      var tempLayer = L.geoJSON(stFeat);
      if (!stateBounds[sbNorm]) {
        stateBounds[sbNorm] = L.latLngBounds(tempLayer.getBounds());
      }
    }

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
    syncBreadcrumbControls();
    updateRiskPulseMarkers();
    showInfo(null, null);
    setGeoLoading(false);
    initPredictorForm();
  })
  .catch(function(err) {
    setGeoLoading(false);
    console.error("Map initialization failed:", err);
    document.getElementById("info").innerHTML = "<h4>Could not load data</h4><p>Open this page through the FastAPI server at /app/.</p>";
  });

var zoomInBtn = document.getElementById("map-zoom-in");
if (zoomInBtn) {
  zoomInBtn.onclick = function() {
    map.zoomIn();
  };
}
var zoomOutBtn = document.getElementById("map-zoom-out");
if (zoomOutBtn) {
  zoomOutBtn.onclick = function() {
    map.zoomOut();
  };
}
var resetCamBtn = document.getElementById("map-reset");
if (resetCamBtn) {
  resetCamBtn.onclick = function() {
    filterByState("ALL");
  };
}

document.getElementById("lb").onclick = function() {
  var panelEl = document.getElementById("panel");
  if (panelEl) panelEl.classList.toggle("on");
};
document.getElementById("lyr").onclick = function() {
  var panelEl = document.getElementById("panel");
  if (panelEl) panelEl.classList.toggle("on");
};
document.getElementById("pill").onclick = function() {
  filterByState("ALL");
};
var btnBackIndia = document.getElementById("btn-back-india");
if (btnBackIndia) {
  btnBackIndia.onclick = function() {
    filterByState("ALL");
  };
}
var btnBackState = document.getElementById("btn-back-state");
if (btnBackState) {
  btnBackState.onclick = window.backToParentState;
}
var crumbStateBtn = document.getElementById("crumb-state");
if (crumbStateBtn) {
  crumbStateBtn.onclick = window.backToParentState;
}

function getSystemDarkPreference() {
  if (window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

function applyColorSchemeState(scheme) {
  var metaEl = document.getElementById("color-scheme-meta");
  if (metaEl) {
    metaEl.content = scheme;
  }

  var isDark = false;
  if (scheme === "dark") {
    isDark = true;
  } else if (scheme === "light") {
    isDark = false;
  } else {
    isDark = getSystemDarkPreference();
  }

  var appEl = document.getElementById("app");
  if (isDark) {
    document.documentElement.dataset.theme = "dark";
    if (appEl) appEl.setAttribute("data-contrast", "dark");
  } else {
    document.documentElement.dataset.theme = "";
    if (appEl) appEl.removeAttribute("data-contrast");
  }

  var navToggleBtn = document.getElementById("nav-theme-toggle");
  if (navToggleBtn) {
    navToggleBtn.setAttribute("aria-pressed", String(isDark));
    if (isDark) {
      navToggleBtn.setAttribute("title", "Switch to light mode");
    } else {
      navToggleBtn.setAttribute("title", "Switch to dark mode");
    }
  }
}

function toggleSiteTheme() {
  var currentIsDark = document.documentElement.dataset.theme === "dark";
  var targetScheme = "dark";
  if (currentIsDark) {
    targetScheme = "light";
  }

  var sysDark = getSystemDarkPreference();
  var matchesSystem = (targetScheme === "dark") === sysDark;

  if (matchesSystem) {
    try { localStorage.removeItem("color-scheme"); } catch (e) {}
    applyColorSchemeState("light dark");
  } else {
    try { localStorage.setItem("color-scheme", targetScheme); } catch (e) {}
    applyColorSchemeState(targetScheme);
  }
  updateNavIndicator();
}

function initColorSchemeToggle() {
  var saved = null;
  try { saved = localStorage.getItem("color-scheme"); } catch (e) {}
  applyColorSchemeState(saved || "light dark");

  var navToggleBtn = document.getElementById("nav-theme-toggle");
  if (navToggleBtn) {
    navToggleBtn.onclick = toggleSiteTheme;
  }

  var railThemeBtn = document.getElementById("theme");
  if (railThemeBtn) {
    railThemeBtn.onclick = toggleSiteTheme;
  }

  window.addEventListener("storage", function(e) {
    if (e.key === "color-scheme") {
      applyColorSchemeState(e.newValue || "light dark");
    }
  });

  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) {
      mq.addEventListener("change", function() {
        var metaEl = document.getElementById("color-scheme-meta");
        if (!metaEl || metaEl.content === "light dark") {
          applyColorSchemeState("light dark");
        }
      });
    }
  }
}

initColorSchemeToggle();

var layerDockBtns = document.querySelectorAll(".layer-dock .ld-btn");
for (var ldIdx = 0; ldIdx < layerDockBtns.length; ldIdx++) {
  layerDockBtns[ldIdx].onclick = function() {
    setActiveLayer(this.getAttribute("data-layer"));
  };
}

var msBtns = document.querySelectorAll(".map-switcher .ms-btn[data-style]");
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
      if (selected && distLayer) recolor();
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
      if (selected && distLayer) recolor();
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
  hideMapTooltip();
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
