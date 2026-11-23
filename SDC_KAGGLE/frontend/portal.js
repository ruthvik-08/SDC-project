var LAYERS = {
  stress:{name:"Crop Stress",cat:["#2e9e5b","#e6c229","#e8873a","#c0392b"],labels:["Low","Moderate","High","Severe"]},
  ipi:{name:"Irrigation priority",key:"ipi",unit:"/100",ramp:["#fbeee6","#f1b896","#d9784f","#b5573a","#7a2e17"]},
  wet:{name:"Soil wetness",key:"soil_wetness",unit:"",ramp:["#f3ead7","#d9c79a","#9fb98c","#4f9d9a","#1f6a7a"]},
  ndvi:{name:"NDVI",key:"ndvi",unit:"",ramp:["#ffff66","#a6e07a","#4fbf8a","#14917f","#1d4e5f"]},
  rainfall:{name:"Rainfall",key:"rainfall",unit:" mm/day",ramp:["#eef6fb","#bcdcee","#7fb8de","#3f86c4","#1f4e8c"]}
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
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    options: {
      subdomains: "abcd",
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\">CARTO</a>",
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
var layer = "stress", DATA = {}, statesGeo, distsGeo, stateLayer = null, distLayer = null;
var current = null, selected = null, selectedDistrictLayer = null, ranges = {};
var districtMap = {}, stateBounds = {}, stateList = [], stateCounts = {};
var lastGenieOrigin = null;

var map = L.map("map", {zoomControl:false, zoomSnap:0.25}).setView([22.5, 80], 4.5);
L.control.zoom({position:"bottomright"}).addTo(map);

function normState(s) {
  return (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function formatStateName(s) {
  if (!s) return "";
  if (s.toUpperCase() === "JAMMU & KASHMIR" || s.toLowerCase() === "jammu and kashmir") return "Jammu and Kashmir";
  return s;
}

function setBasemap(styleKey) {
  if (!BASEMAP_CONFIG[styleKey]) return;
  currentBasemap = styleKey;
  
  var mapEl = document.getElementById("map");
  if (styleKey === "dark") {
    mapEl.style.backgroundColor = "#12100f";
  } else if (styleKey === "satellite") {
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
  
  var btns = document.querySelectorAll(".map-switcher .ms-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle("active", btns[i].dataset.style === styleKey);
  }
  
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);
  if (selectedDistrictLayer) {
    var selColor = currentBasemap === "satellite" ? "#ffd700" : (currentBasemap === "dark" ? "#ffd700" : "#b5573a");
    selectedDistrictLayer.setStyle({ weight: 3.5, color: selColor });
  }
  showInfo(selected ? dataFor(selected) : null, selected);
}

setBasemap("clean");

function colorFor(d) {
  if (!d) return currentBasemap === "dark" ? "#221f1d" : (currentBasemap === "satellite" ? "#000000" : "#e6e2dc");
  var L1 = LAYERS[layer];
  if (layer === "stress") return L1.cat[L1.labels.indexOf(d.stress)] || "#e6c229";
  var r = ranges[layer], t = (d[L1.key] - r[0]) / ((r[1] - r[0]) || 1);
  return L1.ramp[Math.max(0, Math.min(L1.ramp.length - 1, Math.floor(t * L1.ramp.length)))];
}

function dataFor(p) {
  if (!p) return null;
  var exactKey = p.state + "|" + p.district;
  if (DATA[exactKey]) return DATA[exactKey];
  var nSt = normState(p.state), nDt = normState(p.district);
  for (var k in DATA) {
    var parts = k.split("|");
    var sSt = normState(parts[0]), sDt = normState(parts[1]);
    if ((sSt === nSt || sSt.indexOf(nSt) !== -1 || nSt.indexOf(sSt) !== -1) &&
        (sDt === nDt || sDt.indexOf(nDt) !== -1 || nDt.indexOf(sDt) !== -1)) {
      return DATA[k];
    }
  }
  return null;
}

function styleState(f) {
  var isCurrent = current && normState(f.properties.state) === normState(current);
  if (currentBasemap === "satellite") {
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: isCurrent ? "#ffd700" : "#ffffff",
      weight: isCurrent ? 2.6 : 1.5,
      opacity: isCurrent ? 1 : 0.75
    };
  }
  if (currentBasemap === "dark") {
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: isCurrent ? "#ffd700" : "#e8873a",
      weight: isCurrent ? 2.4 : 1.3,
      opacity: isCurrent ? 1 : 0.75
    };
  }
  return {
    fillColor: "transparent",
    fillOpacity: 0,
    color: isCurrent ? "#ffd700" : "#b5573a",
    weight: isCurrent ? 2.4 : 1.3,
    opacity: isCurrent ? 1 : 0.8
  };
}

function styleDist(f) {
  var d = dataFor(f.properties);
  var fill = colorFor(d);
  var hasData = !!d;
  var isStateDimmed = current && normState(f.properties.state) !== normState(current);

  if (currentBasemap === "satellite") {
    return {
      fillColor: fill,
      fillOpacity: isStateDimmed ? 0.05 : (hasData ? 0.82 : 0.20),
      color: isStateDimmed ? "rgba(255,255,255,0.15)" : (hasData ? "#ffffff" : "rgba(255,255,255,0.5)"),
      weight: hasData ? 0.9 : 0.6,
      opacity: isStateDimmed ? 0.2 : 0.8
    };
  }
  if (currentBasemap === "dark") {
    return {
      fillColor: fill,
      fillOpacity: isStateDimmed ? 0.12 : (hasData ? 0.90 : 0.60),
      color: isStateDimmed ? "#221f1d" : (hasData ? "#383430" : "#383430"),
      weight: hasData ? 0.8 : 0.6,
      opacity: isStateDimmed ? 0.3 : 0.9
    };
  }
  return {
    fillColor: fill,
    fillOpacity: isStateDimmed ? 0.10 : (hasData ? 0.88 : 0.45),
    color: isStateDimmed ? "#d5d1cb" : (hasData ? "#ffffff" : "#c2bcb2"),
    weight: hasData ? 0.8 : 0.6,
    opacity: isStateDimmed ? 0.3 : 1.0
  };
}

function drawLegend() {
  var L1 = LAYERS[layer], c = layer === "stress" ? L1.cat : L1.ramp, h = "";
  for (var i = 0; i < c.length; i++) h += "<div style='background:" + c[i] + "'></div>";
  var lo = layer === "stress" ? "LOW" : "LOW", hi = layer === "stress" ? "SEVERE" : "HIGH";
  var noDataColor = currentBasemap === "dark" ? "#221f1d" : (currentBasemap === "satellite" ? "#000000" : "#e6e2dc");
  return "<div class='leg'><div style='background:" + noDataColor + ";flex:.5'></div>" + h + "</div><div class='legl'><span>NO DATA</span><span>" + lo + "</span><span>" + hi + "</span></div>";
}

function showInfo(d, p) {
  var L1 = LAYERS[layer], el = document.getElementById("info"), h;
  if (!p) {
    if (current) {
      var stateDists = distsGeo.features.filter(function(f) {
        return normState(f.properties.state) === normState(current);
      });
      var dataCount = stateDists.filter(function(f) { return dataFor(f.properties) !== null; }).length;
      h = "<h4>" + current + "</h4>"
        + "<div class='v mono' style='font-size:18px;color:var(--teal);margin:6px 0;'>" + stateDists.length + " Districts</div>"
        + "<p style='margin-bottom:8px;'><b>" + dataCount + "</b> district(s) with active ML predictions in verified dataset.</p>"
        + "<p style='font-size:12px;color:var(--mute);'>Click any individual district on the map or search above to inspect agricultural metrics.</p>";
    } else {
      h = "<h4>All-India Coverage</h4>"
        + "<div class='v mono' style='font-size:18px;color:var(--teal);margin:6px 0;'>732 Districts Across 36 States/UTs</div>"
        + "<p style='margin-bottom:8px;'>Comprehensive nationwide district-level boundaries with verified agricultural intelligence.</p>"
        + "<p style='font-size:12px;color:var(--mute);'>Select a state from the dropdown or click any district to explore data.</p>";
    }
  } else if (!d) {
    h = "<h4>" + p.district + ", " + formatStateName(p.state) + "</h4>"
      + "<div style='margin:8px 0;'><span class='badge' style='background:#f3f4f6;color:#4b5563;border:1px solid #d1d5db;'>Agricultural prediction data unavailable.</span></div>"
      + "<p style='margin:8px 0;font-size:13px;line-height:1.5;'><b>Geographical Boundary Verified.</b> Authentic Survey of India district boundaries loaded for " + p.district + ".</p>"
      + "<p style='font-size:12px;color:var(--mute);line-height:1.5;'>Agricultural sensor and ML prediction data is unavailable for this district in the Jun–Nov 2023 verified benchmark dataset. Predictions are only displayed for districts with genuine verified sensor inputs.</p>";
  } else {
    var v = layer === "stress" ? d.stress : d[L1.key] + L1.unit;
    var badgeCls = d.stress === "Severe" || d.stress === "High" ? "high" : (d.stress === "Moderate" ? "med" : "low");
    h = "<h4>" + d.district + ", " + formatStateName(d.state) + "</h4>"
      + "<div style='margin:6px 0;'><span class='badge " + badgeCls + "'>" + (d.stress || "Verified") + " Stress</span></div>"
      + "<div class='v mono'>" + v + "</div><p>" + L1.name + " · average Jun–Nov 2023</p>"
      + "<p>Irrigation priority " + d.ipi + " · NDVI " + d.ndvi + " · rain " + d.rainfall + " mm/day</p>"
      + "<p>Monthly irrigation priority</p><div class='chart'>";
    var mn = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    for (var m = 6; m <= 11; m++) {
      h += "<div data-m='" + mn[m] + "' style='height:" + Math.max(4, (d.months[m] || 0) * 0.6) + "px'></div>";
    }
    h += "</div><p style='margin-top:18px'>" + d.records + " verified records</p>";
  }
  el.innerHTML = h + drawLegend();
}

function selectDistrict(props, ly) {
  if (selectedDistrictLayer && distLayer) {
    distLayer.resetStyle(selectedDistrictLayer);
  }
  selectedDistrictLayer = ly;
  selected = props;
  var selColor = currentBasemap === "satellite" ? "#ffd700" : (currentBasemap === "dark" ? "#ffd700" : "#b5573a");
  ly.setStyle({
    weight: 3.5,
    color: selColor,
    fillOpacity: Math.min(1.0, (ly.options.fillOpacity || 0.8) + 0.12),
    opacity: 1
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    ly.bringToFront();
  }
  showInfo(dataFor(props), props);
}

function filterByState(stName) {
  if (!stName || stName === "ALL") {
    current = null;
    document.getElementById("pill").textContent = "INDIA";
    document.getElementById("state-select").value = "ALL";
    if (selectedDistrictLayer && distLayer) {
      distLayer.resetStyle(selectedDistrictLayer);
      selectedDistrictLayer = null;
      selected = null;
    }
    if (distLayer) distLayer.setStyle(styleDist);
    if (stateLayer) stateLayer.setStyle(styleState);
    map.flyTo([22.5, 80], 4.5, { duration: 1.2 });
    showInfo(null);
    return;
  }

  current = stName;
  document.getElementById("pill").textContent = stName.toUpperCase();
  document.getElementById("state-select").value = stName;
  
  if (selectedDistrictLayer && distLayer) {
    distLayer.resetStyle(selectedDistrictLayer);
    selectedDistrictLayer = null;
    selected = null;
  }

  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);

  var nSt = normState(stName);
  var b = stateBounds[nSt];
  if (b && b.isValid()) {
    map.flyToBounds(b, { duration: 1.2, padding: [35, 35] });
  }
  showInfo(null);
}

function recolor() {
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);
  if (selectedDistrictLayer) {
    var selColor = currentBasemap === "satellite" ? "#ffd700" : (currentBasemap === "dark" ? "#ffd700" : "#b5573a");
    selectedDistrictLayer.setStyle({ weight: 3.5, color: selColor });
  }
  showInfo(selected ? dataFor(selected) : null, selected);
}

function buildLayerLinks() {
  var h = "";
  for (var k in LAYERS) {
    h += "<a data-k='" + k + "' class='" + (k === layer ? "sel" : "") + "' style='color:" + (k === "stress" ? "#c0392b" : "var(--acc)") + "'>" + LAYERS[k].name + "</a>";
  }
  var box = document.getElementById("layers");
  box.innerHTML = h;
  box.onclick = function (e) {
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
    var lo = 1e9, hi = -1e9;
    for (var id in DATA) {
      var v = DATA[id][LAYERS[k].key];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    ranges[k] = [lo, hi];
  }
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
  var targetSt = parts[1] ? normState(parts[1].trim()) : null;

  var matchedKey = null;
  if (targetSt) {
    var exactKey = targetSt + "|" + targetDt;
    if (districtMap[exactKey]) matchedKey = exactKey;
  }
  if (!matchedKey) {
    for (var k in districtMap) {
      var kDt = k.split("|")[1];
      if (kDt === targetDt) {
        matchedKey = k;
        break;
      }
    }
  }
  if (!matchedKey && targetDt.length >= 3) {
    for (var k2 in districtMap) {
      var kDt2 = k2.split("|")[1];
      if (kDt2.indexOf(targetDt) === 0 || kDt2.indexOf(targetDt) !== -1) {
        matchedKey = k2;
        break;
      }
    }
  }

  if (matchedKey && districtMap[matchedKey]) {
    var ly = districtMap[matchedKey];
    var f = ly.feature;
    if (current && normState(f.properties.state) !== normState(current)) {
      current = formatStateName(f.properties.state);
      document.getElementById("pill").textContent = current.toUpperCase();
      document.getElementById("state-select").value = current;
      distLayer.setStyle(styleDist);
      stateLayer.setStyle(styleState);
    }
    selectDistrict(f.properties, ly);
    map.flyToBounds(ly.getBounds(), { duration: 1.0, maxZoom: 8, padding: [50, 50] });
  }
}

Promise.all([
  fetch("data/india_states_simplified.geojson").then(function (r) { return r.json(); }),
  fetch("data/india_districts_simplified.geojson").then(function (r) { return r.json(); }),
  fetch("data/portal_data.json").then(function (r) { return r.json(); })
]).then(function (res) {
  statesGeo = res[0];
  distsGeo = res[1];
  DATA = res[2];
  computeRanges();
  buildLayerLinks();

  stateList = [];
  var seenStates = {};
  stateBounds = {};
  stateCounts = {};
  districtMap = {};

  distsGeo.features.forEach(function(f) {
    var rawSt = f.properties.state;
    var formattedSt = formatStateName(rawSt);
    var normSt = normState(formattedSt);
    stateCounts[normSt] = (stateCounts[normSt] || 0) + 1;
    if (!seenStates[normSt]) {
      seenStates[normSt] = formattedSt;
      stateList.push(formattedSt);
    }
  });
  stateList.sort();

  var coverageBadge = document.getElementById("coverage-badge");
  if (coverageBadge) {
    coverageBadge.textContent = distsGeo.features.length + " Districts | All India Coverage";
  }

  var sel = document.getElementById("state-select");
  sel.innerHTML = "<option value='ALL'>All States / UTs (" + distsGeo.features.length + " Districts)</option>";
  stateList.forEach(function(st) {
    var opt = document.createElement("option");
    opt.value = st;
    var cnt = stateCounts[normState(st)] || 0;
    opt.textContent = st + " (" + cnt + " districts)";
    sel.appendChild(opt);
  });
  sel.onchange = function() {
    filterByState(this.value);
  };

  var dlHtml = "";
  stateList.forEach(function(st) {
    dlHtml += "<option value='" + st + " (All Districts)'>";
  });
  distsGeo.features.forEach(function(f) {
    var dt = f.properties.district;
    var st = formatStateName(f.properties.state);
    dlHtml += "<option value='" + dt + ", " + st + "'>";
  });
  document.getElementById("dl").innerHTML = dlHtml;

  distLayer = L.geoJSON(distsGeo, {
    style: styleDist,
    onEachFeature: function (f, ly) {
      var k = normState(f.properties.state) + "|" + normState(f.properties.district);
      districtMap[k] = ly;

      var nSt = normState(f.properties.state);
      if (!stateBounds[nSt]) {
        stateBounds[nSt] = L.latLngBounds(ly.getBounds());
      } else {
        stateBounds[nSt].extend(ly.getBounds());
      }

      ly.on("click", function () {
        selectDistrict(f.properties, ly);
      });
      ly.on("mouseover", function () {
        if (ly !== selectedDistrictLayer) {
          var hoverColor = currentBasemap === "satellite" ? "#ffffff" : "#b5573a";
          ly.setStyle({ weight: 2.5, color: hoverColor });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            ly.bringToFront();
          }
        }
      });
      ly.on("mouseout", function () {
        if (ly !== selectedDistrictLayer && distLayer) {
          distLayer.resetStyle(ly);
        }
      });

      var distData = dataFor(f.properties);
      var statusText = distData ? (distData.stress ? distData.stress + " Stress · IPI " + distData.ipi : "IPI " + distData.ipi) : "Agricultural prediction data unavailable.";
      var tipText = "<b>" + f.properties.district + "</b>, " + formatStateName(f.properties.state) + "<br><span style='font-size:11px;opacity:0.85;'>" + statusText + "</span>";
      ly.bindTooltip(tipText, {sticky:true});
    }
  }).addTo(map);

  stateLayer = L.geoJSON(statesGeo, {
    style: styleState,
    interactive: false
  }).addTo(map);

  distLayer.bringToFront();
  stateLayer.bringToFront();
  showInfo(null);
}).catch(function (err) {
  console.error("Map initialization failed:", err);
  document.getElementById("info").innerHTML = "<h4>Could not load data</h4><p>Open this page through the FastAPI server at /app/portal.html.</p>";
});

document.getElementById("lb").onclick = function () {
  document.getElementById("panel").classList.add("on");
  this.style.display = "none";
};
document.getElementById("lyr").onclick = function () {
  document.getElementById("panel").classList.toggle("on");
};
document.getElementById("pill").onclick = function () {
  filterByState("ALL");
};
document.getElementById("theme").onclick = function () {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "" : "dark";
};

var msBtns = document.querySelectorAll(".map-switcher .ms-btn");
for (var i = 0; i < msBtns.length; i++) {
  msBtns[i].onclick = function () {
    setBasemap(this.dataset.style);
  };
}

var searchTimeout = null;
document.getElementById("search").oninput = function () {
  clearTimeout(searchTimeout);
  var v = this.value;
  searchTimeout = setTimeout(function () {
    if (v.length >= 3) handleSearch(v);
  }, 280);
};
document.getElementById("search").onchange = function () {
  handleSearch(this.value);
};
document.getElementById("search").onkeydown = function (e) {
  if (e.key === "Enter") handleSearch(this.value);
};

// ========================================================
// SECTION 2: IRRIGATION PRIORITY RANKING DATA & FILTERS
// ========================================================
var allPriorityList = [];
var currentRankCategory = "ALL";

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
  fetch("/api/irrigation/priority").then(function(r) { return r.json(); }).then(function(res) {
    allPriorityList = res.ranked_districts || [];
    renderPriorityKPIs(allPriorityList);
    populateStateDropdown(allPriorityList);
    renderTop10Chart(allPriorityList.slice(0, 10));
    renderPriorityTable(allPriorityList);
  }).catch(function(err) {
    console.error("Could not load priority rankings:", err);
  });
}

function renderPriorityKPIs(list) {
  var high = 0, med = 0, low = 0, totalScore = 0;
  for (var i = 0; i < list.length; i++) {
    var sc = list[i].irrigation_priority_index;
    totalScore += sc;
    if (sc >= 50.0) high++;
    else if (sc >= 35.0) med++;
    else low++;
  }
  animateNumber(document.getElementById("rank-total-districts"), 0, list.length, 700, 0, "");
  animateNumber(document.getElementById("rank-high-count"), 0, high, 700, 0, "");
  animateNumber(document.getElementById("rank-med-count"), 0, med, 700, 0, "");
  animateNumber(document.getElementById("rank-low-count"), 0, low, 700, 0, "");
  animateNumber(document.getElementById("rank-avg-ipi"), 0, (totalScore / (list.length || 1)), 700, 1, "");
}

function populateStateDropdown(list) {
  var states = {};
  for (var i = 0; i < list.length; i++) {
    states[list[i].state] = true;
  }
  var sortedStates = Object.keys(states).sort();
  var sel = document.getElementById("ranking-state-filter");
  if (sel.options.length <= 1) {
    for (var j = 0; j < sortedStates.length; j++) {
      var opt = document.createElement("option");
      opt.value = sortedStates[j];
      opt.textContent = sortedStates[j];
      sel.appendChild(opt);
    }
  }
}

function renderTop10Chart(top10) {
  var container = document.getElementById("top-10-bars");
  var html = "";
  for (var i = 0; i < top10.length; i++) {
    var d = top10[i];
    var pct = Math.min(100, (d.irrigation_priority_index / 70) * 100).toFixed(0);
    var color = d.irrigation_priority_index >= 50.0 ? "var(--red)" : (d.irrigation_priority_index >= 35.0 ? "var(--amber)" : "var(--green)");
    html += "<div class='bar-chart-row'>"
          + "<div class='bar-chart-label' title='" + d.district + ", " + d.state + "'><b>#" + d.rank + "</b> " + d.district + " (" + d.state + ")</div>"
          + "<div class='bar-chart-track'><div class='bar-chart-fill' style='width:" + pct + "%;background:" + color + ";'>" + d.recommended_irrigation_depth + "</div></div>"
          + "<div class='bar-chart-val' style='color:" + color + ";'>" + d.irrigation_priority_index + "</div>"
          + "</div>";
  }
  container.innerHTML = html;
}

function renderPriorityTable(list) {
  var tbody = document.getElementById("priority-tbody");
  if (!list || list.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9' style='text-align:center;padding:20px;color:var(--mute);'>No districts matching filter criteria.</td></tr>";
    return;
  }
  var html = "";
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    var badgeCls = d.irrigation_priority_index >= 50.0 ? "high" : (d.irrigation_priority_index >= 35.0 ? "med" : "low");
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
}

function filterRankings() {
  var search = (document.getElementById("ranking-search").value || "").toLowerCase().trim();
  var state = document.getElementById("ranking-state-filter").value;
  var filtered = allPriorityList.filter(function(d) {
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesState = state === "ALL" || d.state === state;
    var matchesCat = currentRankCategory === "ALL" || d.priority_category === currentRankCategory;
    return matchesSearch && matchesState && matchesCat;
  });
  renderPriorityTable(filtered);
}

document.getElementById("ranking-search").oninput = filterRankings;
document.getElementById("ranking-state-filter").onchange = filterRankings;

var rankFilterBtns = document.querySelectorAll(".filter-tabs .filter-btn");
for (var i = 0; i < rankFilterBtns.length; i++) {
  rankFilterBtns[i].onclick = function() {
    for (var j = 0; j < rankFilterBtns.length; j++) rankFilterBtns[j].classList.remove("active");
    this.classList.add("active");
    currentRankCategory = this.dataset.cat;
    filterRankings();
  };
}

// ========================================================
// SECTION 4: REGIONAL AGRO-CLIMATIC CLUSTERS DATA & FILTER
// ========================================================
var allClustersList = [];

function loadClustersData() {
  fetch("/api/clusters/regions").then(function(r) { return r.json(); }).then(function(res) {
    allClustersList = res.districts_clustered || [];
    renderClustersTable(allClustersList);
  }).catch(function(err) {
    console.error("Could not load regional clusters:", err);
  });
}

function renderClustersTable(list) {
  var tbody = document.getElementById("clusters-tbody");
  if (!list || list.length === 0) {
    tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;padding:20px;color:var(--mute);'>No clustered districts matching criteria.</td></tr>";
    return;
  }
  var clusterColors = {
    0: "#d9784f",
    1: "#0f766e",
    2: "#c0392b",
    3: "#2e9e5b"
  };
  var html = "";
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var col = clusterColors[c.cluster_id] || "var(--acc)";
    html += "<tr>"
          + "<td><b>" + c.district + "</b></td>"
          + "<td>" + c.state + "</td>"
          + "<td><span class='badge' style='background:" + col + "20;color:" + col + ";border:1px solid " + col + "60;'>Zone " + c.cluster_id + ": " + c.cluster_name + "</span></td>"
          + "<td>" + (c.crop || "Mixed") + "</td>"
          + "<td class='mono'>" + c.mean_temperature + " °C</td>"
          + "<td class='mono'>" + c.mean_rainfall + " mm</td>"
          + "<td class='mono'>" + c.mean_soil_moisture + "</td>"
          + "<td class='mono'><b>" + c.mean_priority_index + "</b></td>"
          + "</tr>";
  }
  tbody.innerHTML = html;
}

function filterClusters() {
  var search = (document.getElementById("cluster-search").value || "").toLowerCase().trim();
  var zone = document.getElementById("cluster-zone-filter").value;
  var filtered = allClustersList.filter(function(d) {
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesZone = zone === "ALL" || String(d.cluster_id) === String(zone);
    return matchesSearch && matchesZone;
  });
  renderClustersTable(filtered);
}

document.getElementById("cluster-search").oninput = filterClusters;
document.getElementById("cluster-zone-filter").onchange = filterClusters;

// ========================================================
// ADVANCED MOTION: 3D CARD TILT ON CURSOR HOVER
// ========================================================
function initCardTilt() {
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) return;
  var cards = document.querySelectorAll(".nav-card, .cluster-card");
  for (var i = 0; i < cards.length; i++) {
    (function(card) {
      card.addEventListener("mousemove", function(e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var dx = (x - cx) / cx;
        var dy = (y - cy) / cy;
        var rotX = (-dy * 6).toFixed(2);
        var rotY = (dx * 6).toFixed(2);
        card.style.transform = "perspective(1200px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function() {
        card.style.transform = "";
      });
    })(cards[i]);
  }
}

// ========================================================
// ADVANCED MOTION: TOP NAVIGATION SLIDING INDICATOR
// ========================================================
function updateNavIndicator() {
  var indicator = document.getElementById("nav-indicator");
  var activeLink = document.querySelector("nav.top a.nav-link.active");
  if (!indicator || !activeLink) return;
  var wrap = activeLink.parentElement;
  if (!wrap) return;
  var wrapRect = wrap.getBoundingClientRect();
  var linkRect = activeLink.getBoundingClientRect();
  var left = linkRect.left - wrapRect.left;
  var width = linkRect.width;
  indicator.style.left = left + "px";
  indicator.style.width = width + "px";
  indicator.style.opacity = "1";
}
window.addEventListener("resize", updateNavIndicator);

// ========================================================
// ADVANCED MOTION: MACOS-INSPIRED GENIE MORPHING EFFECT
// ========================================================
function getTargetElementForHash(hash) {
  if (hash.indexOf("#/map") === 0) return document.getElementById("app");
  if (hash.indexOf("#/ranking") === 0) return document.getElementById("view-ranking");
  if (hash.indexOf("#/benchmarks") === 0) return document.getElementById("view-benchmarks");
  if (hash.indexOf("#/clusters") === 0) return document.getElementById("view-clusters");
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
  var deltaX = rect.left;
  var deltaY = rect.top;

  targetEl.style.setProperty("--genie-x", deltaX + "px");
  targetEl.style.setProperty("--genie-y", deltaY + "px");
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
    var deltaX = rect.left;
    var deltaY = rect.top;

    activeSection.style.setProperty("--genie-x", deltaX + "px");
    activeSection.style.setProperty("--genie-y", deltaY + "px");
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

function initGenieTransitions() {
  var navCards = document.querySelectorAll(".nav-card[data-target]");
  for (var i = 0; i < navCards.length; i++) {
    (function(card) {
      card.addEventListener("click", function(e) {
        e.preventDefault();
        var targetHash = card.getAttribute("data-target");
        triggerGenieExpand(card, targetHash);
      });
    })(navCards[i]);
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

// ========================================================
// HASH ROUTER FOR SEAMLESS CLIENT-SIDE NAVIGATION
// ========================================================
function route() {
  var hash = location.hash || "#/";
  var appEl = document.getElementById("app");
  var homeEl = document.getElementById("view-home");
  var rankingEl = document.getElementById("view-ranking");
  var benchmarksEl = document.getElementById("view-benchmarks");
  var clustersEl = document.getElementById("view-clusters");

  appEl.classList.remove("on");
  homeEl.classList.remove("on");
  rankingEl.classList.remove("on");
  benchmarksEl.classList.remove("on");
  clustersEl.classList.remove("on");

  var navLinks = document.querySelectorAll("nav.top a.nav-link");
  for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].classList.remove("active");
  }

  if (hash.indexOf("#/map") === 0) {
    appEl.classList.add("on");
    document.getElementById("nav-map").classList.add("active");
    setTimeout(function() { map.invalidateSize(); }, 60);
  } else if (hash.indexOf("#/ranking") === 0) {
    rankingEl.classList.add("on");
    document.getElementById("nav-ranking").classList.add("active");
    if (allPriorityList.length === 0) {
      loadPriorityData();
    } else {
      renderPriorityKPIs(allPriorityList);
    }
    window.scrollTo({top:0, behavior:"smooth"});
  } else if (hash.indexOf("#/benchmarks") === 0) {
    benchmarksEl.classList.add("on");
    document.getElementById("nav-benchmarks").classList.add("active");
    var rfAcc = document.getElementById("bm-rf-acc");
    var rfR2 = document.getElementById("bm-rf-r2");
    if (rfAcc) animateNumber(rfAcc, 80.0, 99.62, 800, 2, "%");
    if (rfR2) animateNumber(rfR2, 0.7000, 0.9954, 800, 4, "");
    window.scrollTo({top:0, behavior:"smooth"});
  } else if (hash.indexOf("#/clusters") === 0) {
    clustersEl.classList.add("on");
    document.getElementById("nav-clusters").classList.add("active");
    if (allClustersList.length === 0) loadClustersData();
    window.scrollTo({top:0, behavior:"smooth"});
  } else {
    homeEl.classList.add("on");
    document.getElementById("nav-home").classList.add("active");
    window.scrollTo({top:0, behavior:"smooth"});
  }

  setTimeout(updateNavIndicator, 20);
}

window.onhashchange = route;

route();
initCardTilt();
initGenieTransitions();
setTimeout(updateNavIndicator, 80);

loadPriorityData();
loadClustersData();
