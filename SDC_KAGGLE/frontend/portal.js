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
var highlightStateBorders = true, hoveredState = null;

var map = L.map("map", {zoomControl:false, zoomSnap:0.25}).setView([22.5, 80], 4.5);
L.control.zoom({position:"bottomright"}).addTo(map);

if (!map.getPane("stateBoundariesPane")) {
  var statePane = map.createPane("stateBoundariesPane");
  statePane.style.zIndex = "650";
  statePane.style.pointerEvents = "none";
}

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
  
  if (distLayer) distLayer.setStyle(styleDist);
  if (stateLayer) stateLayer.setStyle(styleState);
  if (selectedDistrictLayer) {
    var selColor = currentBasemap === "satellite" ? "#ffd700" : "#b5573a";
    selectedDistrictLayer.setStyle({ weight: 3.5, color: selColor });
  }
  showInfo(selected ? dataFor(selected) : null, selected);
}

setBasemap("clean");

function colorFor(d) {
  if (!d) return currentBasemap === "satellite" ? "#000000" : "#e6e2dc";
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

  if (currentBasemap === "satellite") {
    if (isCurrent || isHovered) {
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        color: "#fbbf24",
        weight: isCurrent ? 4.2 : 3.6,
        opacity: 1.0,
        lineCap: "round",
        lineJoin: "round"
      };
    }
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: "#38bdf8",
      weight: 2.8,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    };
  }

  // Clean / Light Basemap
  if (isCurrent || isHovered) {
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: "#b45309",
      weight: isCurrent ? 4.2 : 3.6,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    };
  }
  return {
    fillColor: "transparent",
    fillOpacity: 0,
    color: "#0f172a",
    weight: 2.8,
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round"
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
  var noDataColor = currentBasemap === "satellite" ? "#000000" : "#e6e2dc";
  var stateBdrColor = currentBasemap === "satellite" ? "#38bdf8" : "#0f172a";
  return "<div class='leg'><div style='background:" + noDataColor + ";flex:.5'></div>" + h + "</div><div class='legl'><span>NO DATA</span><span>" + lo + "</span><span>" + hi + "</span></div>"
    + "<div style='display:flex;align-items:center;gap:7px;margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);font-size:11.5px;color:var(--ink);font-weight:600;'>"
    + "<span style='display:inline-block;width:20px;height:4px;background:" + stateBdrColor + ";border-radius:2px;box-shadow:0 0 2px rgba(0,0,0,0.3);'></span>"
    + "<span>State Boundaries (Highlighted)</span>"
    + "</div>";
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
      + "<div class='v mono'>" + v + "</div><p>" + L1.name + " · 2024–25 Authentic Data</p>"
      + "<p>Irrigation priority " + d.ipi + " · NDVI " + d.ndvi + " · rain " + d.rainfall + " mm/mo</p>"
      + (d.crop ? "<p style='font-size:12px;margin:4px 0;'><b>Crop:</b> " + d.crop + " · <b>Soil:</b> " + (d.soil_type || "Alluvial") + " · <b>Irrig:</b> " + (d.irrigation_coverage || 45) + "%</p>" : "")
      + "<p>Monthly irrigation priority</p><div class='chart'>";
    var mn = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    for (var m = 6; m <= 11; m++) {
      h += "<div data-m='" + mn[m] + "' style='height:" + Math.max(4, (d.months[m] || 0) * 0.6) + "px'></div>";
    }
    h += "</div>"
      + "<button type='button' onclick=\"openDistrictInPredictor('" + (d.state || '').replace(/'/g, "\\'") + "', '" + (d.district || '').replace(/'/g, "\\'") + "')\" class='btn fill' style='width:100%;font-size:12px;padding:8px 10px;margin-top:14px;cursor:pointer;'>Open in Predictor</button>";
  }
  el.innerHTML = h + drawLegend();
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
  var selColor = currentBasemap === "satellite" ? "#ffd700" : "#b5573a";
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
    var selColor = currentBasemap === "satellite" ? "#ffd700" : "#b5573a";
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

// ========================================================
// SECTION 5: AGRICULTURAL DECISION PREDICTOR SYSTEM
// ========================================================
var stateDistrictsList = {};
var latestPrediction = null;

function initPredictorForm() {
  var stateSelect = document.getElementById("pred-state");
  var distSelect = document.getElementById("pred-district");
  if (!stateSelect || !distSelect || !distsGeo) return;

  stateDistrictsList = {};
  distsGeo.features.forEach(function(f) {
    var rawSt = f.properties.state;
    var formattedSt = formatStateName(rawSt);
    if (!stateDistrictsList[formattedSt]) {
      stateDistrictsList[formattedSt] = [];
    }
    stateDistrictsList[formattedSt].push(f.properties.district);
  });

  stateSelect.innerHTML = "";
  var sortedStates = Object.keys(stateDistrictsList).sort();
  sortedStates.forEach(function(st) {
    var opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st + " (" + stateDistrictsList[st].length + " districts)";
    if (st === "Telangana") opt.selected = true;
    stateSelect.appendChild(opt);
  });

  var stateSearch = document.getElementById("pred-state-search");
  var distSearch = document.getElementById("pred-district-search");

  if (stateSearch) {
    stateSearch.oninput = function() {
      var q = this.value.toLowerCase().trim();
      stateSelect.innerHTML = "";
      sortedStates.forEach(function(st) {
        if (!q || st.toLowerCase().indexOf(q) !== -1) {
          var opt = document.createElement("option");
          opt.value = st;
          opt.textContent = st + " (" + stateDistrictsList[st].length + " districts)";
          stateSelect.appendChild(opt);
        }
      });
      updateDistrictsForSelectedState();
    };
  }

  if (distSearch) {
    distSearch.oninput = function() {
      var q = this.value.toLowerCase().trim();
      var chosenState = stateSelect.value;
      var dists = (stateDistrictsList[chosenState] || []).slice().sort();
      distSelect.innerHTML = "";
      dists.forEach(function(dt) {
        if (!q || dt.toLowerCase().indexOf(q) !== -1) {
          var opt = document.createElement("option");
          opt.value = dt;
          opt.textContent = dt;
          distSelect.appendChild(opt);
        }
      });
      if (distSelect.value) {
        loadDistrictProfile(chosenState, distSelect.value);
      }
    };
  }

  function loadDistrictProfile(state, district) {
    if (!district) return;
    fetch("/api/district-profile?state=" + encodeURIComponent(state) + "&district=" + encodeURIComponent(district))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === "success") {
          updateDistrictProfileUI(data);
          autoPopulatePredictorInputs(data);
        }
      }).catch(function(err) {
        console.warn("Could not load district profile:", err);
      });
  }

  function updateDistrictProfileUI(data) {
    var lgdBadge = document.getElementById("profile-lgd-badge");
    if (lgdBadge) lgdBadge.textContent = "LGD Code: " + data.lgd_code;
    var cropEl = document.getElementById("profile-crop");
    if (cropEl) cropEl.textContent = (data.agriculture && data.agriculture.crop) || "—";
    var soilEl = document.getElementById("profile-soil");
    if (soilEl) soilEl.textContent = (data.soil && data.soil.soil_type) || "—";
    var irrigEl = document.getElementById("profile-irrig");
    if (irrigEl) irrigEl.textContent = (data.irrigation && data.irrigation.irrigation_coverage_pct ? data.irrigation.irrigation_coverage_pct.toFixed(1) : "45.0") + "%";
    var rainEl = document.getElementById("profile-rain");
    if (rainEl) rainEl.textContent = Math.round(data.climate && data.climate.rainfall_annual_mm || 0) + " mm";
    var tempEl = document.getElementById("profile-temp");
    if (tempEl) tempEl.textContent = (data.climate && data.climate.temperature_mean_c ? data.climate.temperature_mean_c.toFixed(1) : "30.0") + " °C";
    var humEl = document.getElementById("profile-hum");
    if (humEl) humEl.textContent = Math.round(data.climate && data.climate.humidity_mean_pct || 50) + "%";

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

  var knobControllers = {};

  function initKnobs() {
    var knobEls = document.querySelectorAll(".knob-control");
    knobEls.forEach(function(el) {
      var id = el.getAttribute("data-id");
      var min = parseFloat(el.getAttribute("data-min"));
      var max = parseFloat(el.getAttribute("data-max"));
      var step = parseFloat(el.getAttribute("data-step")) || 1;
      var decimals = parseInt(el.getAttribute("data-decimals"), 10) || 0;
      var unit = el.getAttribute("data-unit") || "";

      var dialBox = el.querySelector(".knob-dial-box");
      var progressCircle = el.querySelector(".knob-progress");
      var rotor = el.querySelector(".knob-rotor");
      var displayVal = el.querySelector(".knob-display-val");
      var numInput = document.getElementById(id);

      if (!dialBox || !numInput) return;

      var fullTrack = 216.77;
      var fullCirc = 289.03;

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

        var formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
        if (displayVal) {
          displayVal.textContent = formatted;
        }

        dialBox.setAttribute("aria-valuenow", formatted);

        if (updateInput && numInput && parseFloat(numInput.value) !== val) {
          numInput.value = formatted;
        }
      }

      var ctrl = {
        id: id,
        min: min,
        max: max,
        step: step,
        decimals: decimals,
        getValue: function() {
          return parseFloat(numInput.value) || min;
        },
        setValue: function(val) {
          var v = roundToStep(clamp(val));
          render(v, true);
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
        ctrl.setValue(isNaN(v) ? min : v);
      };

      var isDragging = false;
      var startY = 0;
      var startVal = 0;

      function onPointerDown(e) {
        isDragging = true;
        dialBox.focus();
        dialBox.classList.add("dragging");
        startY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        startVal = ctrl.getValue();
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp);
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        if (e.preventDefault && e.cancelable) e.preventDefault();
        var currentY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        var deltaY = startY - currentY;
        var range = max - min;
        var change = (deltaY / 140) * range;
        var newVal = roundToStep(clamp(startVal + change));
        render(newVal, true);
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

      dialBox.addEventListener("mousedown", onPointerDown);
      dialBox.addEventListener("touchstart", onPointerDown, { passive: true });

      dialBox.addEventListener("wheel", function(e) {
        e.preventDefault();
        var dir = e.deltaY < 0 ? 1 : -1;
        var current = ctrl.getValue();
        var newVal = roundToStep(clamp(current + dir * step));
        ctrl.setValue(newVal);
      }, { passive: false });

      dialBox.addEventListener("keydown", function(e) {
        var current = ctrl.getValue();
        var newVal = current;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          e.preventDefault();
          newVal = current + step;
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          e.preventDefault();
          newVal = current - step;
        } else if (e.key === "PageUp") {
          e.preventDefault();
          newVal = current + (step * 5);
        } else if (e.key === "PageDown") {
          e.preventDefault();
          newVal = current - (step * 5);
        } else if (e.key === "Home") {
          e.preventDefault();
          newVal = min;
        } else if (e.key === "End") {
          e.preventDefault();
          newVal = max;
        } else {
          return;
        }
        ctrl.setValue(newVal);
      });
    });
  }

  function autoPopulatePredictorInputs(data) {
    var inputs = data.suggested_predictor_inputs || {};
    if (knobControllers["pred-temp"] && inputs.temperature !== undefined) {
      knobControllers["pred-temp"].setValue(inputs.temperature);
    }
    if (knobControllers["pred-hum"] && inputs.humidity !== undefined) {
      knobControllers["pred-hum"].setValue(inputs.humidity);
    }
    if (knobControllers["pred-rain"] && inputs.rainfall !== undefined) {
      knobControllers["pred-rain"].setValue(inputs.rainfall);
    }
    if (knobControllers["pred-soil"] && inputs.effective_soil_wetness !== undefined) {
      knobControllers["pred-soil"].setValue(inputs.effective_soil_wetness);
    }
    if (knobControllers["pred-ph"] && inputs.soil_ph !== undefined) {
      knobControllers["pred-ph"].setValue(inputs.soil_ph);
    }
    if (knobControllers["pred-soc"] && inputs.soil_organic_carbon !== undefined) {
      knobControllers["pred-soc"].setValue(inputs.soil_organic_carbon);
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

  function updateDistrictsForSelectedState() {
    var chosenState = stateSelect.value;
    var dists = (stateDistrictsList[chosenState] || []).slice().sort();
    distSelect.innerHTML = "";
    dists.forEach(function(dt) {
      var opt = document.createElement("option");
      opt.value = dt;
      opt.textContent = dt;
      if (dt === "Khammam" || dt === "Bikaner") opt.selected = true;
      distSelect.appendChild(opt);
    });
    if (distSelect.value) {
      loadDistrictProfile(chosenState, distSelect.value);
    }
  }

  stateSelect.onchange = updateDistrictsForSelectedState;
  distSelect.onchange = function() {
    loadDistrictProfile(stateSelect.value, distSelect.value);
  };
  updateDistrictsForSelectedState();

  initKnobs();

  function applyPreset(soil, temp, rain, hum, crop, stage, ph, soc) {
    if (knobControllers["pred-soil"] && soil !== undefined) knobControllers["pred-soil"].setValue(soil);
    if (knobControllers["pred-temp"] && temp !== undefined) knobControllers["pred-temp"].setValue(temp);
    if (knobControllers["pred-rain"] && rain !== undefined) knobControllers["pred-rain"].setValue(rain);
    if (knobControllers["pred-hum"] && hum !== undefined) knobControllers["pred-hum"].setValue(hum);
    if (knobControllers["pred-ph"] && ph !== undefined) knobControllers["pred-ph"].setValue(ph);
    if (knobControllers["pred-soc"] && soc !== undefined) knobControllers["pred-soc"].setValue(soc);
    if (crop) {
      var cEl = document.getElementById("pred-crop");
      if (cEl) cEl.value = crop;
    }
    if (stage) {
      var sEl = document.getElementById("pred-stage");
      if (sEl) sEl.value = stage;
    }
  }

  var btnArid = document.getElementById("preset-arid");
  if (btnArid) {
    btnArid.onclick = function() {
      applyPreset(0.18, 39.0, 0.0, 22, "Cotton", "Reproductive", 8.2, 0.30);
    };
  }
  var btnDry = document.getElementById("preset-dry");
  if (btnDry) {
    btnDry.onclick = function() {
      applyPreset(0.30, 33.5, 0.0, 38, "Cotton", "Reproductive", 7.5, 0.45);
    };
  }
  var btnMonsoon = document.getElementById("preset-monsoon");
  if (btnMonsoon) {
    btnMonsoon.onclick = function() {
      applyPreset(0.58, 28.0, 24.0, 78, "Rice", "Vegetative", 6.8, 0.65);
    };
  }
  var btnReset = document.getElementById("preset-reset");
  if (btnReset) {
    btnReset.onclick = function() {
      loadDistrictProfile(stateSelect.value, distSelect.value);
    };
  }

  var btnRun = document.getElementById("btn-run-predict");
  if (btnRun) {
    btnRun.onclick = runPredictionInference;
  }

  var btnMap = document.getElementById("btn-view-on-map");
  if (btnMap) {
    btnMap.onclick = navigatePredictionToMap;
  }
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

  if (isNaN(temp) || temp < 15 || temp > 48) {
    alert("Please enter a valid temperature between 15 °C and 48 °C.");
    return;
  }
  if (isNaN(hum) || hum < 10 || hum > 95) {
    alert("Please enter a valid humidity between 10% and 95%.");
    return;
  }
  if (isNaN(rain) || rain < 0 || rain > 100) {
    alert("Please enter a valid daily rainfall between 0 and 100 mm.");
    return;
  }
  if (isNaN(soil) || soil < 0.10 || soil > 0.85) {
    alert("Please enter a valid soil moisture index between 0.10 and 0.85.");
    return;
  }
  if (isNaN(ph) || ph < 4.5 || ph > 9.5) {
    alert("Please enter a valid soil pH between 4.5 and 9.5.");
    return;
  }
  if (isNaN(soc) || soc < 0.10 || soc > 1.50) {
    alert("Please enter a valid soil organic carbon between 0.10% and 1.50%.");
    return;
  }

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
    soil_organic_carbon: soc
  };

  btnRun.disabled = true;
  btnRun.textContent = "Processing Prediction...";

  fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function(res) {
    btnRun.disabled = false;
    btnRun.textContent = "Predict";
    renderPredictionResults(res, payload);
  }).catch(function(err) {
    btnRun.disabled = false;
    btnRun.textContent = "Predict";
    alert("Prediction failed: " + err.message + ". Please verify input parameters.");
  });
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

  var stressBadge = document.getElementById("res-stress-badge");
  var stressLevel = cStress.stress_level || "Moderate";
  stressBadge.textContent = stressLevel + " Stress";
  stressBadge.className = "badge " + (stressLevel === "Severe" || stressLevel === "High" ? "high" : (stressLevel === "Moderate" ? "med" : "low"));

  var stressVal = document.getElementById("res-stress-val");
  stressVal.textContent = stressLevel;
  var stressColors = { "Low": "var(--green)", "Moderate": "var(--amber)", "High": "var(--acc)", "Severe": "var(--red)" };
  stressVal.style.color = stressColors[stressLevel] || "var(--acc)";

  var ipiVal = document.getElementById("res-ipi-val");
  var ipiScore = iPriority.irrigation_priority_index || 0.0;
  ipiVal.textContent = ipiScore.toFixed(1);
  ipiVal.style.color = ipiScore >= 50.0 ? "var(--red)" : (ipiScore >= 35.0 ? "var(--amber)" : "var(--green)");

  document.getElementById("res-depth-val").textContent = iPriority.recommended_irrigation_depth || "35–45 mm";
  document.getElementById("res-deficit-val").textContent = (agro.daily_water_deficit_mm || 0.0).toFixed(1) + " mm/d";

  var probs = cStress.stress_probabilities || {};
  var pLow = probs["Low"] || 0.0;
  var pMod = probs["Moderate"] || 0.0;
  var pHigh = probs["High"] || 0.0;
  var pSev = probs["Severe"] || 0.0;

  document.getElementById("prob-fill-low").style.width = (pLow * 100).toFixed(0) + "%";
  document.getElementById("prob-num-low").textContent = (pLow * 100).toFixed(1) + "%";

  document.getElementById("prob-fill-mod").style.width = (pMod * 100).toFixed(0) + "%";
  document.getElementById("prob-num-mod").textContent = (pMod * 100).toFixed(1) + "%";

  document.getElementById("prob-fill-high").style.width = (pHigh * 100).toFixed(0) + "%";
  document.getElementById("prob-num-high").textContent = (pHigh * 100).toFixed(1) + "%";

  document.getElementById("prob-fill-sev").style.width = (pSev * 100).toFixed(0) + "%";
  document.getElementById("prob-num-sev").textContent = (pSev * 100).toFixed(1) + "%";

  document.getElementById("res-advisory-title").textContent = iPriority.priority_category + " Advisory";
  document.getElementById("res-advisory-text").textContent = (iPriority.actionable_farmer_advisory || "") + " " + (cStress.condition_summary || "");

  document.getElementById("res-et0").textContent = (agro.reference_et0_mm || 0.0).toFixed(2) + " mm";
  document.getElementById("res-etc").textContent = (agro.crop_etc_mm || 0.0).toFixed(2) + " mm";
  document.getElementById("res-ndvi").textContent = (agro.vegetation_ndvi || 0.0).toFixed(3);

  var sumLoc = document.getElementById("sum-loc");
  if (sumLoc) sumLoc.textContent = payload.district + ", " + payload.state;
  var sumCrop = document.getElementById("sum-crop");
  if (sumCrop) sumCrop.textContent = payload.crop_type + " · " + payload.growth_stage;
  var sumTemp = document.getElementById("sum-temp");
  if (sumTemp) sumTemp.textContent = payload.temperature.toFixed(1) + " °C";
  var sumHum = document.getElementById("sum-hum");
  if (sumHum) sumHum.textContent = Math.round(payload.humidity) + " %";
  var sumRain = document.getElementById("sum-rain");
  if (sumRain) sumRain.textContent = payload.rainfall.toFixed(1) + " mm";
  var sumSoil = document.getElementById("sum-soil");
  if (sumSoil) sumSoil.textContent = payload.effective_soil_wetness.toFixed(2);
  var sumPh = document.getElementById("sum-ph");
  if (sumPh) sumPh.textContent = (payload.soil_ph !== undefined ? payload.soil_ph.toFixed(1) : "7.4") + " pH";
  var sumSoc = document.getElementById("sum-soc");
  if (sumSoc) sumSoc.textContent = (payload.soil_organic_carbon !== undefined ? payload.soil_organic_carbon.toFixed(2) : "0.48") + " %";
}

function navigatePredictionToMap() {
  if (!latestPrediction) return;
  var payload = latestPrediction.payload;
  var res = latestPrediction.res;

  location.hash = "#/map";

  setTimeout(function() {
    var targetDt = normState(payload.district);
    var targetSt = normState(payload.state);
    var exactKey = targetSt + "|" + targetDt;
    var ly = districtMap[exactKey];

    if (!ly) {
      for (var k in districtMap) {
        if (k.split("|")[1] === targetDt) {
          ly = districtMap[k];
          break;
        }
      }
    }

    if (ly) {
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
      var badgeCls = stressLevel === "Severe" || stressLevel === "High" ? "high" : (stressLevel === "Moderate" ? "med" : "low");

      var h = "<h4>" + payload.district + ", " + formatStateName(payload.state) + "</h4>"
        + "<div style='margin:6px 0;'><span class='badge " + badgeCls + "'>Predicted: " + stressLevel + " Stress</span> "
        + "<span class='badge' style='background:rgba(15,118,110,0.15);color:var(--teal);'>ML INFERENCE</span></div>"
        + "<div class='v mono' style='color:var(--acc);font-size:22px;margin:4px 0;'>IPI " + (iPriority.irrigation_priority_index || 0.0).toFixed(1) + " / 100</div>"
        + "<p><b>Recommended Irrigation:</b> " + (iPriority.recommended_irrigation_depth || "35–45 mm") + "</p>"
        + "<p><b>Crop:</b> " + payload.crop_type + " (" + payload.growth_stage + " stage)</p>"
        + "<p style='font-size:12px;margin:8px 0;line-height:1.4;'><b>Advisory:</b> " + (iPriority.actionable_farmer_advisory || "") + "</p>"
        + "<p style='font-size:11.5px;color:var(--mute);margin-top:10px;'>Deficit: " + (agro.daily_water_deficit_mm || 0.0).toFixed(1) + " mm/d · ETc: " + (agro.crop_etc_mm || 0.0).toFixed(2) + " mm · NDVI: " + (agro.vegetation_ndvi || 0.0).toFixed(3) + "</p>";

      document.getElementById("info").innerHTML = h + drawLegend();
    }
  }, 180);
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
        hoveredState = normState(f.properties.state);
        if (stateLayer) stateLayer.setStyle(styleState);
      });
      ly.on("mouseout", function () {
        if (ly !== selectedDistrictLayer && distLayer) {
          distLayer.resetStyle(ly);
        }
        hoveredState = null;
        if (stateLayer) stateLayer.setStyle(styleState);
      });

      var distData = dataFor(f.properties);
      var statusText = distData ? (distData.stress ? distData.stress + " Stress · IPI " + distData.ipi : "IPI " + distData.ipi) : "Agricultural prediction data unavailable.";
      var tipText = "<b>" + f.properties.district + "</b>, " + formatStateName(f.properties.state) + "<br><span style='font-size:11px;opacity:0.85;'>" + statusText + "</span>";
      ly.bindTooltip(tipText, {sticky:true});
    }
  }).addTo(map);

  stateLayer = L.geoJSON(statesGeo, {
    pane: "stateBoundariesPane",
    style: styleState,
    interactive: false
  }).addTo(map);

  var btnStateBorders = document.getElementById("btn-state-borders");
  if (btnStateBorders) {
    btnStateBorders.onclick = function () {
      highlightStateBorders = !highlightStateBorders;
      this.classList.toggle("active", highlightStateBorders);
      if (stateLayer) stateLayer.setStyle(styleState);
    };
  }

  distLayer.bringToFront();
  stateLayer.bringToFront();
  showInfo(null);

  initPredictorForm();
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

var priorityPage = 1;
var priorityPageSize = 50;
var prioritySortKey = "rank";
var prioritySortAsc = true;
var currentFilteredPriority = [];

function loadPriorityData() {
  fetch("/api/irrigation/priority").then(function(r) { return r.json(); }).then(function(res) {
    allPriorityList = res.ranked_districts || [];
    renderPriorityKPIs(allPriorityList);
    populateStateDropdown(allPriorityList);
    renderTop10Chart(allPriorityList.slice(0, 10));
    filterRankings();
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
  var totalEl = document.getElementById("rank-total-districts");
  if (totalEl) animateNumber(totalEl, 0, list.length, 700, 0, "");
  var highEl = document.getElementById("rank-high-count");
  if (highEl) animateNumber(highEl, 0, high, 700, 0, "");
  var medEl = document.getElementById("rank-med-count");
  if (medEl) animateNumber(medEl, 0, med, 700, 0, "");
  var lowEl = document.getElementById("rank-low-count");
  if (lowEl) animateNumber(lowEl, 0, low, 700, 0, "");
  var avgEl = document.getElementById("rank-avg-ipi");
  if (avgEl) animateNumber(avgEl, 0, (totalScore / (list.length || 1)), 700, 1, "");
}

function populateStateDropdown(list) {
  var states = {};
  for (var i = 0; i < list.length; i++) {
    states[list[i].state] = true;
  }
  var sortedStates = Object.keys(states).sort();
  var sel = document.getElementById("ranking-state-filter");
  if (sel && sel.options.length <= 1) {
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
  if (!container) return;
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
      th.classList.add(prioritySortAsc ? "asc" : "desc");
      if (icon) icon.innerHTML = prioritySortAsc ? "&#9650;" : "&#9660;";
    }
  }
}

function applyPrioritySorting() {
  var key = prioritySortKey;
  var asc = prioritySortAsc;
  currentFilteredPriority.sort(function(a, b) {
    var valA = a[key];
    var valB = b[key];
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });
}

function filterRankings() {
  var search = (document.getElementById("ranking-search").value || "").toLowerCase().trim();
  var state = document.getElementById("ranking-state-filter").value;
  currentFilteredPriority = allPriorityList.filter(function(d) {
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesState = state === "ALL" || d.state === state;
    var matchesCat = currentRankCategory === "ALL" || d.priority_category === currentRankCategory;
    return matchesSearch && matchesState && matchesCat;
  });
  applyPrioritySorting();
  priorityPage = 1;
  renderPriorityTable();
}

var rankSearchEl = document.getElementById("ranking-search");
if (rankSearchEl) rankSearchEl.oninput = filterRankings;
var rankStateEl = document.getElementById("ranking-state-filter");
if (rankStateEl) rankStateEl.onchange = filterRankings;

var rankFilterBtns = document.querySelectorAll(".filter-tabs .filter-btn");
for (var i = 0; i < rankFilterBtns.length; i++) {
  rankFilterBtns[i].onclick = function() {
    for (var j = 0; j < rankFilterBtns.length; j++) rankFilterBtns[j].classList.remove("active");
    this.classList.add("active");
    currentRankCategory = this.dataset.cat;
    filterRankings();
  };
}

var prevRankBtn = document.getElementById("priority-prev-btn");
if (prevRankBtn) {
  prevRankBtn.onclick = function() {
    if (priorityPage > 1) {
      priorityPage--;
      renderPriorityTable();
    }
  };
}

var nextRankBtn = document.getElementById("priority-next-btn");
if (nextRankBtn) {
  nextRankBtn.onclick = function() {
    var totalPages = Math.ceil(currentFilteredPriority.length / priorityPageSize);
    if (priorityPage < totalPages) {
      priorityPage++;
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
  (function(th) {
    th.onclick = function() {
      var sortKey = th.getAttribute("data-sort");
      if (sortKey) sortPriorityList(sortKey);
    };
  })(prioritySortHeaders[sIdx]);
}

// ========================================================
// SECTION 4: REGIONAL AGRO-CLIMATIC CLUSTERS & 2D PCA (732)
// ========================================================
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

function loadClustersData() {
  fetch("/api/clusters/regions").then(function(r) { return r.json(); }).then(function(res) {
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
  }).catch(function(err) {
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

  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < list.length; i++) {
    var x = list[i].pca_x;
    var y = list[i].pca_y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  minX -= 0.6; maxX += 0.6;
  minY -= 0.6; maxY += 0.6;

  function scaleX(val) {
    return padLeft + ((val - minX) / (maxX - minX)) * (width - padLeft - padRight);
  }
  function scaleY(val) {
    return height - padBottom - ((val - minY) / (maxY - minY)) * (height - padTop - padBottom);
  }

  var svgHtml = "";

  // Grid Lines and Center Axis
  var zeroX = scaleX(0);
  var zeroY = scaleY(0);
  svgHtml += "<line x1='" + padLeft + "' y1='" + zeroY + "' x2='" + (width - padRight) + "' y2='" + zeroY + "' stroke='var(--line)' stroke-dasharray='4 4' stroke-width='1.5'/>";
  svgHtml += "<line x1='" + zeroX + "' y1='" + padTop + "' x2='" + zeroX + "' y2='" + (height - padBottom) + "' stroke='var(--line)' stroke-dasharray='4 4' stroke-width='1.5'/>";

  // Border Box
  svgHtml += "<rect x='" + padLeft + "' y='" + padTop + "' width='" + (width - padLeft - padRight) + "' height='" + (height - padTop - padBottom) + "' fill='none' stroke='var(--line)' stroke-width='1'/>";

  // Axis Labels
  svgHtml += "<text x='" + (padLeft + (width - padLeft - padRight) / 2) + "' y='" + (height - 14) + "' text-anchor='middle' font-size='12' font-weight='600' fill='var(--mute)'>Principal Component 1 (PC1: 49.59% Variance) &rarr; Moisture Deficit &amp; Evaporative Demand</text>";
  svgHtml += "<text x='18' y='" + (padTop + (height - padTop - padBottom) / 2) + "' text-anchor='middle' transform='rotate(-90 18 " + (padTop + (height - padTop - padBottom) / 2) + ")' font-size='12' font-weight='600' fill='var(--mute)'>Principal Component 2 (PC2: 37.27%) &rarr; Thermal Profile</text>";

  // Points (732 Districts)
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

function initPcaTooltipEvents(list) {
  var svg = document.getElementById("pca-svg");
  var tooltip = document.getElementById("pca-tooltip");
  var container = document.getElementById("pca-scatter-container");
  if (!svg || !tooltip || !container) return;

  var points = svg.querySelectorAll(".pca-point");
  for (var i = 0; i < points.length; i++) {
    (function(pt) {
      pt.onmouseenter = function(e) {
        pt.setAttribute("r", "8");
        pt.setAttribute("stroke-width", "2.5");
        var idx = parseInt(pt.getAttribute("data-index"), 10);
        var d = list[idx];
        if (!d) return;

        var col = clusterColorMap[d.cluster_id] || "var(--acc)";
        var content = "<div class='pca-tooltip-title'>" + d.district + ", " + d.state + "</div>"
                    + "<div class='pca-tooltip-zone' style='background:" + col + "25;color:" + col + ";border:1px solid " + col + "60;'>Zone " + d.cluster_id + ": " + d.cluster_name + "</div>"
                    + "<div class='pca-tooltip-grid'>"
                    + "<div><span class='lbl'>Primary Crop:</span> <b>" + (d.crop || "Mixed") + "</b></div>"
                    + "<div><span class='lbl'>Priority Score:</span> <b style='color:" + (d.mean_priority_index >= 50 ? "var(--red)" : (d.mean_priority_index >= 35 ? "var(--amber)" : "var(--green)")) + ";'>" + d.mean_priority_index + "</b></div>"
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
    })(points[i]);
  }
}

function positionPcaTooltip(e) {
  var tooltip = document.getElementById("pca-tooltip");
  var container = document.getElementById("pca-scatter-container");
  if (!tooltip || !container) return;
  var cRect = container.getBoundingClientRect();
  var mouseX = e.clientX - cRect.left;
  var mouseY = e.clientY - cRect.top;

  var tipWidth = 240;
  var tipHeight = 150;
  var posX = mouseX + 16;
  var posY = mouseY - 20;

  if (posX + tipWidth > cRect.width) posX = mouseX - tipWidth - 16;
  if (posY + tipHeight > cRect.height) posY = cRect.height - tipHeight - 10;
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
      th.classList.add(clustersSortAsc ? "asc" : "desc");
      if (icon) icon.innerHTML = clustersSortAsc ? "&#9650;" : "&#9660;";
    }
  }
}

function applyClustersSorting() {
  var key = clustersSortKey;
  var asc = clustersSortAsc;
  currentFilteredClusters.sort(function(a, b) {
    var valA = a[key];
    var valB = b[key];
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });
}

function filterClusters() {
  var search = (document.getElementById("cluster-search").value || "").toLowerCase().trim();
  var zone = currentClusterZone;
  currentFilteredClusters = allClustersList.filter(function(d) {
    var matchesSearch = !search || d.district.toLowerCase().indexOf(search) !== -1 || d.state.toLowerCase().indexOf(search) !== -1;
    var matchesZone = zone === "ALL" || String(d.cluster_id) === String(zone);
    return matchesSearch && matchesZone;
  });
  applyClustersSorting();
  clustersPage = 1;
  renderClustersTable();
  updateClusterPcaPointsDimming();
}

var clusterSearchEl = document.getElementById("cluster-search");
if (clusterSearchEl) clusterSearchEl.oninput = filterClusters;

var clusterZoneEl = document.getElementById("cluster-zone-filter");
if (clusterZoneEl) {
  clusterZoneEl.onchange = function() {
    currentClusterZone = this.value;
    updatePillButtonsState(currentClusterZone);
    filterClusters();
  };
}

var clusterPillBtns = document.querySelectorAll(".cluster-pill-btn");
for (var pIdx = 0; pIdx < clusterPillBtns.length; pIdx++) {
  (function(btn) {
    btn.onclick = function() {
      currentClusterZone = btn.getAttribute("data-zone") || "ALL";
      updatePillButtonsState(currentClusterZone);
      if (clusterZoneEl) clusterZoneEl.value = currentClusterZone;
      filterClusters();
    };
  })(clusterPillBtns[pIdx]);
}

function updatePillButtonsState(zone) {
  for (var i = 0; i < clusterPillBtns.length; i++) {
    var b = clusterPillBtns[i];
    if (b.getAttribute("data-zone") === String(zone)) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  }
}

var prevClustersBtn = document.getElementById("clusters-prev-btn");
if (prevClustersBtn) {
  prevClustersBtn.onclick = function() {
    if (clustersPage > 1) {
      clustersPage--;
      renderClustersTable();
    }
  };
}

var nextClustersBtn = document.getElementById("clusters-next-btn");
if (nextClustersBtn) {
  nextClustersBtn.onclick = function() {
    var totalPages = Math.ceil(currentFilteredClusters.length / clustersPageSize);
    if (clustersPage < totalPages) {
      clustersPage++;
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
  (function(th) {
    th.onclick = function() {
      var sortKey = th.getAttribute("data-sort");
      if (sortKey) sortClustersList(sortKey);
    };
  })(clustersSortHeaders[csIdx]);
}

// ========================================================
// ADVANCED MOTION: 3D CARD TILT ON CURSOR HOVER
// ========================================================
function initCardTilt() {
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) return;
  var cards = document.querySelectorAll(".nav-card, .cluster-card, .pred-card");
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
        var rotX = (-dy * 5).toFixed(2);
        var rotY = (dx * 5).toFixed(2);
        card.style.transform = "perspective(1200px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) translateY(-3px)";
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
  if (hash.indexOf("#/predictor") === 0) return document.getElementById("view-predictor");
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
  var predictorEl = document.getElementById("view-predictor");
  var rankingEl = document.getElementById("view-ranking");
  var benchmarksEl = document.getElementById("view-benchmarks");
  var clustersEl = document.getElementById("view-clusters");

  appEl.classList.remove("on");
  homeEl.classList.remove("on");
  if (predictorEl) predictorEl.classList.remove("on");
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
  } else if (hash.indexOf("#/predictor") === 0) {
    if (predictorEl) predictorEl.classList.add("on");
    var navPred = document.getElementById("nav-predictor");
    if (navPred) navPred.classList.add("active");
    window.scrollTo({top:0, behavior:"smooth"});
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
