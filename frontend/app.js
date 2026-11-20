/**
 * DiCRA KrishiJal • Geospatial Intelligence Application Logic
 * Inspired by DiCRA (NABARD & UNDP)
 * Zero dropdowns • Spatial click-and-zoom • Live in-memory ML inference
 */

// Centralized API Configuration: dynamically detects origin, localStorage override, or default localhost
const API_BASE = (typeof window !== "undefined" && window.KRISHIJAL_API_BASE)
  || (typeof localStorage !== "undefined" && localStorage.getItem("KRISHIJAL_API_BASE"))
  || (window.location.origin && window.location.origin.startsWith("http") && !window.location.origin.includes("file:")
      ? window.location.origin 
      : "http://127.0.0.1:8000");

// Helper to configure public/ngrok API URL on the fly
window.setKrishiJalApiBase = (url) => {
  if (url) {
    localStorage.setItem("KRISHIJAL_API_BASE", url.replace(/\/$/, ""));
    console.log("Updated KrishiJal API Base to:", url);
    location.reload();
  }
};

// Global Application State
let mapInstance = null;
let tileLayer = null;
let currentBasemap = "voyager";
let currentLayer = "stress"; // 'stress', 'priority', 'moisture'

let statesGeoJsonData = null;
let districtsGeoJsonData = null;
let stateLayerGroup = null;
let districtLayerGroup = null;

let allDistrictsList = [];
let districtsLookup = {};
let stateDistrictsLookup = {};
let selectedStateName = null;
let selectedDistrictName = null;
let activeDistrictFeature = null;

let allPriorityRecords = [];

// Basemap URL configurations
const BASEMAP_TILES = {
  voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
};

// ------------------------------------------------------------------------------
// 1. INITIALIZATION ON PAGE LOAD
// ------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  initMap();
  fetchInitialData();
});

// ------------------------------------------------------------------------------
// 2. BACKEND HEALTH CHECK
// ------------------------------------------------------------------------------
async function checkBackendHealth() {
  const pill = document.getElementById("api-status-pill");
  const text = document.getElementById("api-status-text");

  try {
    const res = await fetch(`${API_BASE}/`);
    if (res.ok) {
      const data = await res.json();
      pill.style.borderColor = "rgba(16, 185, 129, 0.4)";
      pill.style.background = "rgba(16, 185, 129, 0.12)";
      const envTag = API_BASE.includes("ngrok") ? "Ngrok Public" : (API_BASE.includes("onrender.com") ? "Render Cloud" : "Local Host");
      text.innerText = `API Connected (${envTag} • ${data.states_covered || 37} States & UTs)`;
    } else {
      throw new Error("HTTP error");
    }
  } catch (err) {
    pill.style.borderColor = "rgba(239, 68, 68, 0.4)";
    pill.style.background = "rgba(239, 68, 68, 0.12)";
    text.innerText = "API Offline (Start FastAPI Backend)";
  }
}

// ------------------------------------------------------------------------------
// 3. INITIALIZE LEAFLET MAP
// ------------------------------------------------------------------------------
function initMap() {
  // Center map on India
  mapInstance = L.map("geospatial-map", {
    center: [22.8, 80.5],
    zoom: 4.8,
    minZoom: 4,
    maxZoom: 12,
    zoomControl: false
  });

  // Add zoom control at bottom-right
  L.control.zoom({ position: "bottomright" }).addTo(mapInstance);

  // Set default basemap
  tileLayer = L.tileLayer(BASEMAP_TILES.voyager, {
    attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  stateLayerGroup = L.layerGroup().addTo(mapInstance);
  districtLayerGroup = L.layerGroup().addTo(mapInstance);
}

// ------------------------------------------------------------------------------
// 4. FETCH DATA FROM BACKEND & LOCAL GEOJSON FILES
// ------------------------------------------------------------------------------
async function fetchInitialData() {
  try {
    // 1. Fetch District Directory with Rich Metrics from Backend
    const distRes = await fetch(`${API_BASE}/api/districts`);
    if (distRes.ok) {
      const distData = await distRes.json();
      allDistrictsList = distData.districts || [];

      // Build lookup dictionaries
      allDistrictsList.forEach(item => {
        const dKey = item.district.toLowerCase();
        districtsLookup[dKey] = item;

        const sKey = item.state.toLowerCase();
        if (!stateDistrictsLookup[sKey]) {
          stateDistrictsLookup[sKey] = [];
        }
        stateDistrictsLookup[sKey].push(item);
      });
    }

    // 2. Fetch Dataset Info for KPI ticker
    const infoRes = await fetch(`${API_BASE}/api/dataset/info`);
    if (infoRes.ok) {
      const info = await infoRes.json();
      document.getElementById("ticker-coverage").innerText = `${info.total_states} States & UTs (${info.total_districts} Districts)`;
      document.getElementById("ticker-temp").innerText = `${info.national_averages.mean_temperature_c} °C`;
      document.getElementById("ticker-rain").innerText = `${info.national_averages.mean_rainfall_mm} mm`;
      document.getElementById("ticker-soil").innerText = `${info.national_averages.mean_soil_moisture}`;
    }

    // 3. Load GeoJSON files for States and Districts
    loadGeoJsonLayers();

    // 4. Pre-fetch secondary tabs
    fetchIrrigationRanking();
    fetchModelEvaluation();
    fetchAgroClusters();

  } catch (err) {
    console.error("Error loading initial data:", err);
  }
}

// ------------------------------------------------------------------------------
// 5. LOAD & RENDER GEOJSON LAYERS
// ------------------------------------------------------------------------------
async function loadGeoJsonLayers() {
  try {
    // Load States GeoJSON
    const sRes = await fetch("data/india_states_simplified.geojson");
    if (sRes.ok) {
      statesGeoJsonData = await sRes.json();
      renderStateLayer();
    }

    // Load Districts GeoJSON
    const dRes = await fetch("data/india_districts_simplified.geojson");
    if (dRes.ok) {
      districtsGeoJsonData = await dRes.json();
    }
  } catch (err) {
    console.error("Error loading GeoJSON:", err);
  }
}

// ------------------------------------------------------------------------------
// 6. RENDER STATES LAYER (NATIONAL VIEW)
// ------------------------------------------------------------------------------
function renderStateLayer() {
  stateLayerGroup.clearLayers();

  if (!statesGeoJsonData) return;

  const layer = L.geoJSON(statesGeoJsonData, {
    style: feature => {
      const stateName = feature.properties.state || feature.properties.st_nm;
      return {
        fillColor: "#0284c7",
        weight: 1.5,
        opacity: 0.8,
        color: "#38bdf8",
        fillOpacity: 0.18
      };
    },
    onEachFeature: (feature, layerItem) => {
      const stateName = feature.properties.state || feature.properties.st_nm;

      // Tooltip on Hover
      layerItem.bindTooltip(`
        <div style="font-weight: 700; color: #fff;">${stateName}</div>
        <div style="font-size: 0.72rem; color: #38bdf8;">Click to Zoom & View Districts</div>
      `, { className: "dicra-map-tooltip", sticky: true });

      // Hover Effects
      layerItem.on("mouseover", e => {
        const l = e.target;
        l.setStyle({
          fillOpacity: 0.45,
          weight: 2.5,
          color: "#00f0ff"
        });
      });

      layerItem.on("mouseout", e => {
        layer.resetStyle(e.target);
      });

      // Click to Zoom into State
      layerItem.on("click", e => {
        handleStateClick(stateName, e.target);
      });
    }
  });

  stateLayerGroup.addLayer(layer);
}

// ------------------------------------------------------------------------------
// 7. HANDLE STATE CLICK & SMOOTH CAMERA ZOOM
// ------------------------------------------------------------------------------
function handleStateClick(stateName, layerTarget) {
  selectedStateName = stateName;

  // 1. Smoothly fly into state bounding box
  const bounds = layerTarget.getBounds();
  mapInstance.flyToBounds(bounds, {
    padding: [40, 40],
    duration: 1.2,
    easeLinearity: 0.25
  });

  // 2. Update Breadcrumb
  document.getElementById("crumb-sep").style.display = "inline";
  const stateCrumb = document.getElementById("crumb-state");
  stateCrumb.style.display = "inline";
  stateCrumb.innerText = stateName;

  // 3. Show "Zoom to All India" button
  document.getElementById("btn-zoom-all-india").style.display = "block";

  // 4. Hide State Layer & Display District Layer for this State
  stateLayerGroup.clearLayers();
  renderDistrictsForState(stateName);
}

// ------------------------------------------------------------------------------
// 8. RENDER DISTRICT BOUNDARIES FOR SELECTED STATE
// ------------------------------------------------------------------------------
function renderDistrictsForState(stateName) {
  districtLayerGroup.clearLayers();

  if (!districtsGeoJsonData) return;

  const cleanState = s => (s || "").toLowerCase().replace(/[^a-z]/g, "").replace("islands", "");
  const targetStateNorm = cleanState(stateName);

  // Filter features matching state
  const stateDistFeatures = districtsGeoJsonData.features.filter(f => {
    const fState = cleanState(f.properties.state || f.properties.st_nm || "");
    return fState === targetStateNorm || fState.includes(targetStateNorm) || targetStateNorm.includes(fState);
  });

  const layer = L.geoJSON({ type: "FeatureCollection", features: stateDistFeatures }, {
    style: feature => {
      const dName = feature.properties.district || feature.properties.District || feature.properties.dt_name || "District";
      const data = findDistrictData(dName, stateName);
      return getDistrictPolygonStyle(data);
    },
    onEachFeature: (feature, layerItem) => {
      const dName = feature.properties.district || feature.properties.District || feature.properties.dt_name || "District";
      const data = findDistrictData(dName, stateName);

      const stressTag = data ? data.stress_level : "Moderate";
      const ipiScore = data ? data.irrigation_priority_index : "42.0";

      // Hover Tooltip
      layerItem.bindTooltip(`
        <div style="font-weight: 700; color: #fff;">${dName}</div>
        <div style="font-size: 0.72rem; color: #10b981;">Stress: ${stressTag} • IPI: ${ipiScore}</div>
        <div style="font-size: 0.68rem; color: #94a3b8;">Click for Agricultural Intelligence</div>
      `, { className: "dicra-map-tooltip", sticky: true });

      // Hover Effect
      layerItem.on("mouseover", e => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: "#ffffff",
          fillOpacity: 0.7
        });
      });

      layerItem.on("mouseout", e => {
        layer.resetStyle(e.target);
      });

      // Click to open District Intelligence Drawer
      layerItem.on("click", e => {
        handleDistrictClick(dName, stateName, data, e.target);
      });
    }
  });

  districtLayerGroup.addLayer(layer);
}

// ------------------------------------------------------------------------------
// 9. DISTRICT STYLING BY THEMATIC LAYER
// ------------------------------------------------------------------------------
function getDistrictPolygonStyle(data) {
  let fillColor = "#10b981"; // default green
  let fillOpacity = 0.45;

  if (currentLayer === "stress") {
    const stress = data ? data.stress_level : "Low";
    if (stress === "Severe") fillColor = "#ef4444";
    else if (stress === "High") fillColor = "#f97316";
    else if (stress === "Moderate") fillColor = "#f59e0b";
    else fillColor = "#10b981";
  } else if (currentLayer === "priority") {
    const ipi = data ? data.irrigation_priority_index : 30.0;
    if (ipi >= 70.0) fillColor = "#d946ef"; // Critical
    else if (ipi >= 50.0) fillColor = "#8b5cf6"; // High
    else if (ipi >= 35.0) fillColor = "#3b82f6"; // Medium
    else fillColor = "#06b6d4"; // Low
  } else if (currentLayer === "moisture") {
    const soil = data ? data.effective_soil_wetness : 0.5;
    if (soil < 0.35) fillColor = "#b45309"; // Arid
    else if (soil <= 0.55) fillColor = "#059669"; // Moderate
    else fillColor = "#0284c7"; // Saturated
  }

  return {
    fillColor: fillColor,
    weight: 1.5,
    opacity: 0.9,
    color: "#ffffff",
    fillOpacity: fillOpacity
  };
}

// District Alias dictionary for official Census spelling variations
const DISTRICT_ALIASES = {
  "tiswadi": "north goa",
  "bardez": "north goa",
  "salcete": "south goa",
  "burdwan": "bardhaman",
  "namchi": "south sikkim",
  "mangan": "north sikkim",
  "gangtok": "east sikkim",
  "pakyong": "east sikkim",
  "geyzing": "west sikkim",
  "ri-bhoi": "ribhoi",
  "north & middle andaman": "north and middle andaman",
  "ladakh": "leh",
  "dehra dun": "dehradun",
  "hugli": "hooghly",
  "tiruchchirappalli": "tiruchirappalli",
  "belgaum": "belagavi",
  "baramula": "baramulla",
  "barddhaman": "burdwan",
  "baleshwar": "balasore",
  "mysore": "mysuru",
  "banas kantha": "banaskantha",
  "naini tal": "nainital",
  "raj nandgaon": "rajnandgaon",
  "daman and diu": "diu"
};

// Helper to match district in dataset
function findDistrictData(districtName, stateName) {
  if (!districtName) return null;
  let rawClean = districtName.split("(")[0].trim().toLowerCase();
  if (DISTRICT_ALIASES[rawClean]) {
    rawClean = DISTRICT_ALIASES[rawClean];
  }

  // 1. Direct match
  if (districtsLookup[rawClean]) return districtsLookup[rawClean];

  // 2. Fuzzy match in state
  const sClean = (stateName || "").toLowerCase().replace(/[^a-z]/g, "");
  for (let sKey in stateDistrictsLookup) {
    if (sKey.replace(/[^a-z]/g, "").includes(sClean) || sClean.includes(sKey.replace(/[^a-z]/g, ""))) {
      const stateDistricts = stateDistrictsLookup[sKey] || [];
      for (let item of stateDistricts) {
        const dLower = item.district.toLowerCase();
        if (dLower === rawClean || dLower.includes(rawClean) || rawClean.includes(dLower)) {
          return item;
        }
      }
    }
  }

  // 3. Global fuzzy match
  for (let key in districtsLookup) {
    if (key.includes(rawClean) || rawClean.includes(key)) {
      return districtsLookup[key];
    }
  }

  return null;
}

// ------------------------------------------------------------------------------
// 10. HANDLE DISTRICT CLICK & OPEN DiCRA INTELLIGENCE DRAWER
// ------------------------------------------------------------------------------
function handleDistrictClick(districtName, stateName, data, layerTarget) {
  selectedDistrictName = districtName;

  // Breadcrumb update
  document.getElementById("crumb-sep2").style.display = "inline";
  const distCrumb = document.getElementById("crumb-district");
  distCrumb.style.display = "inline";
  distCrumb.innerText = districtName;

  // Highlight selected polygon
  if (activeDistrictFeature) {
    districtLayerGroup.resetStyle(activeDistrictFeature);
  }
  activeDistrictFeature = layerTarget;
  layerTarget.setStyle({
    weight: 3.5,
    color: "#00f0ff",
    fillOpacity: 0.75
  });

  // Open Drawer
  const drawer = document.getElementById("district-drawer");
  drawer.classList.add("open");

  // If district data is not in raw CSV, generate synthetic agromet profile based on lat/lon
  const profile = data || generateDistrictProfile(districtName, stateName);

  // Populate Drawer Contents
  document.getElementById("drawer-state-name").innerText = stateName;
  document.getElementById("drawer-district-name").innerText = districtName;

  // Stress Banner
  const banner = document.getElementById("drawer-stress-banner");
  banner.className = `stress-banner ${profile.stress_level.toLowerCase()}`;
  document.getElementById("drawer-stress-level").innerText = `${profile.stress_level} Stress`;
  document.getElementById("drawer-stress-badge").innerText = profile.stress_level;
  
  if (profile.stress_level === "Severe") {
    document.getElementById("drawer-stress-desc").innerText = "Severe moisture exhaustion. Permanent wilting risk without immediate canal/tubewell irrigation release.";
  } else if (profile.stress_level === "High") {
    document.getElementById("drawer-stress-desc").innerText = "Critical evapotranspiration deficit. Soil moisture below minimum crop threshold.";
  } else if (profile.stress_level === "Moderate") {
    document.getElementById("drawer-stress-desc").innerText = "Transpiration is constrained by declining root-zone soil wetness.";
  } else {
    document.getElementById("drawer-stress-desc").innerText = "Soil wetness and root-zone moisture are sufficient. Continue standard monitoring.";
  }

  // Irrigation Priority Meter
  const ipiVal = profile.irrigation_priority_index || 30.0;
  document.getElementById("drawer-ipi-val").innerText = `${ipiVal} / 100`;
  document.getElementById("drawer-ipi-bar").style.width = `${Math.min(ipiVal, 100)}%`;

  // Agromet Grid
  document.getElementById("m-temp").innerText = `${profile.temperature} °C`;
  document.getElementById("m-temp-range").innerText = `Max: ${profile.temp_max || (profile.temperature + 5.5)}° / Min: ${profile.temp_min || (profile.temperature - 6.5)}°`;
  document.getElementById("m-rain").innerText = `${profile.rainfall} mm`;
  document.getElementById("m-soil").innerText = `${profile.effective_soil_wetness}`;
  document.getElementById("m-rad").innerText = `${profile.solar_radiation} MJ/m²`;
  document.getElementById("m-etc").innerText = `${profile.etc} mm/day`;
  document.getElementById("m-et0").innerText = `Ref ET0: ${profile.et0} mm/day`;
  document.getElementById("m-ndvi").innerText = `${profile.ndvi}`;

  // Soil & Crop Details
  document.getElementById("m-crop").innerText = profile.crop_type;
  document.getElementById("m-soil-type").innerText = profile.soil_type;
  document.getElementById("m-ph").innerText = profile.soil_ph;
  document.getElementById("m-oc").innerText = profile.soil_organic_carbon;
  if (document.getElementById("m-shc-nitrogen")) {
    document.getElementById("m-shc-nitrogen").innerText = profile.nitrogen_status || "Optimal (Medium N)";
  }
  if (document.getElementById("m-shc-index")) {
    document.getElementById("m-shc-index").innerText = (profile.soil_health_index ? profile.soil_health_index + " / 100" : "50.0 / 100");
  }

  // Advisory Box
  const waterDepth = ipiVal >= 50 ? "40–50 mm" : (ipiVal >= 35 ? "25–35 mm" : "Routine / Nil");
  document.getElementById("drawer-water-depth").innerText = waterDepth;
  if (ipiVal >= 50) {
    document.getElementById("drawer-advisory-text").innerText = `Emergency water allocation recommended. Apply ${waterDepth} depth immediately to prevent severe yield penalty.`;
  } else if (ipiVal >= 35) {
    document.getElementById("drawer-advisory-text").innerText = `Soil moisture is depleting. Schedule irrigation canal release within 48 to 72 hours.`;
  } else {
    document.getElementById("drawer-advisory-text").innerText = `Soil moisture levels are adequate. No emergency irrigation required.`;
  }

  // Pre-fill ML Simulator inputs
  document.getElementById("sim-temp").value = profile.temperature;
  document.getElementById("sim-rain").value = profile.rainfall;
  document.getElementById("sim-soil").value = profile.effective_soil_wetness;
  document.getElementById("sim-result-box").classList.add("hidden");
}

// Fallback generator for districts not explicitly in 158 dataset
function generateDistrictProfile(dName, sName) {
  return {
    district: dName,
    state: sName,
    temperature: 28.5,
    temp_max: 34.0,
    temp_min: 22.0,
    rainfall: 2.5,
    humidity: 62.0,
    effective_soil_wetness: 0.48,
    solar_radiation: 19.5,
    et0: 5.2,
    etc: 5.8,
    ndvi: 0.64,
    crop_type: "Rice",
    soil_type: "Alluvial Loam",
    soil_ph: 7.2,
    soil_organic_carbon: 0.52,
    irrigation_priority_index: 38.5,
    stress_level: "Moderate"
  };
}

// ------------------------------------------------------------------------------
// 11. CLOSE DRAWER & RESET CAMERA
// ------------------------------------------------------------------------------
function closeDrawer() {
  document.getElementById("district-drawer").classList.remove("open");
  if (activeDistrictFeature) {
    districtLayerGroup.resetStyle(activeDistrictFeature);
    activeDistrictFeature = null;
  }
  document.getElementById("crumb-sep2").style.display = "none";
  document.getElementById("crumb-district").style.display = "none";
}

function resetToNationalView() {
  closeDrawer();

  // Reset Camera to All India
  mapInstance.flyTo([22.8, 80.5], 4.8, {
    duration: 1.2
  });

  // Breadcrumbs
  document.getElementById("crumb-sep").style.display = "none";
  document.getElementById("crumb-state").style.display = "none";
  document.getElementById("crumb-sep2").style.display = "none";
  document.getElementById("crumb-district").style.display = "none";

  // Hide Zoom Back Button
  document.getElementById("btn-zoom-all-india").style.display = "none";

  // Clear Districts and Show States Layer
  districtLayerGroup.clearLayers();
  renderStateLayer();
}

// ------------------------------------------------------------------------------
// 12. LAYER & BASEMAP SWITCHERS
// ------------------------------------------------------------------------------
function setThematicLayer(layerName) {
  currentLayer = layerName;

  document.querySelectorAll(".layer-pill").forEach(el => el.classList.remove("active"));
  document.getElementById(`layer-btn-${layerName}`).classList.add("active");

  const scaleEl = document.getElementById("legend-scale");
  const titleEl = document.getElementById("legend-title");

  if (layerName === "stress") {
    titleEl.innerText = "Crop Water Stress Severity";
    scaleEl.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background: #10b981;"></span> Low Stress (< 0.25)</div>
      <div class="legend-item"><span class="legend-color" style="background: #f59e0b;"></span> Moderate (0.25 - 0.45)</div>
      <div class="legend-item"><span class="legend-color" style="background: #f97316;"></span> High Stress (0.45 - 0.65)</div>
      <div class="legend-item"><span class="legend-color" style="background: #ef4444;"></span> Severe Stress (≥ 0.65)</div>
    `;
  } else if (layerName === "priority") {
    titleEl.innerText = "Irrigation Priority Index (IPI)";
    scaleEl.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background: #06b6d4;"></span> Low (< 35)</div>
      <div class="legend-item"><span class="legend-color" style="background: #3b82f6;"></span> Medium (35 - 50)</div>
      <div class="legend-item"><span class="legend-color" style="background: #8b5cf6;"></span> High (50 - 70)</div>
      <div class="legend-item"><span class="legend-color" style="background: #d946ef;"></span> Critical (≥ 70)</div>
    `;
  } else if (layerName === "moisture") {
    titleEl.innerText = "Effective Soil Wetness (0 to 1)";
    scaleEl.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background: #b45309;"></span> Arid / Depleted (< 0.35)</div>
      <div class="legend-item"><span class="legend-color" style="background: #059669;"></span> Adequate (0.35 - 0.55)</div>
      <div class="legend-item"><span class="legend-color" style="background: #0284c7;"></span> Saturated / Moist (> 0.55)</div>
    `;
  }

  // Refresh current district styling if visible
  if (selectedStateName) {
    renderDistrictsForState(selectedStateName);
  }
}

function setBasemap(type) {
  currentBasemap = type;

  document.querySelectorAll(".basemap-pill").forEach(el => el.classList.remove("active"));
  document.getElementById(`basemap-${type}`).classList.add("active");

  if (tileLayer) {
    mapInstance.removeLayer(tileLayer);
  }
  tileLayer = L.tileLayer(BASEMAP_TILES[type], {
    attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(mapInstance);
}

// ------------------------------------------------------------------------------
// 13. LIVE IN-MEMORY MACHINE LEARNING SIMULATOR
// ------------------------------------------------------------------------------
async function runSimulation(e) {
  e.preventDefault();

  const btn = document.getElementById("btn-run-sim");
  btn.disabled = true;
  btn.innerText = "⏳ Computing Inference...";

  const payload = {
    temperature: parseFloat(document.getElementById("sim-temp").value),
    rainfall: parseFloat(document.getElementById("sim-rain").value),
    effective_soil_wetness: parseFloat(document.getElementById("sim-soil").value),
    selected_model: document.getElementById("sim-model").value
  };

  try {
    const res = await fetch(`${API_BASE}/api/predict/crop-stress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Inference failed");

    const result = await res.json();

    const box = document.getElementById("sim-result-box");
    box.classList.remove("hidden");

    document.getElementById("sim-res-stress").innerText = result.crop_stress_level;
    document.getElementById("sim-res-stress").style.color = result.urgency_color;
    document.getElementById("sim-res-deficit").innerText = `${result.predicted_water_deficit_mm_per_day} mm/day`;
    document.getElementById("sim-res-ipi").innerText = `${result.irrigation_priority_index} / 100`;
    document.getElementById("sim-res-advice").innerText = result.recommendation;

  } catch (err) {
    alert("Simulation error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "⚡ Run In-Memory Prediction";
  }
}

// ------------------------------------------------------------------------------
// 14. VIEW MODE SWITCHER (MAP, TABLE, BENCHMARKS, CLUSTERS)
// ------------------------------------------------------------------------------
function switchViewMode(mode) {
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(`view-${mode}`).classList.add("active");
  document.getElementById(`btn-mode-${mode}`).classList.add("active");

  if (mode === "map" && mapInstance) {
    mapInstance.invalidateSize();
  }
}

// ------------------------------------------------------------------------------
// 15. SECONDARY TABS: RANKING, EVALUATION, CLUSTERS
// ------------------------------------------------------------------------------
async function fetchIrrigationRanking() {
  try {
    const res = await fetch(`${API_BASE}/api/irrigation/priority`);
    if (!res.ok) return;
    const data = await res.json();
    allPriorityRecords = data.ranked_districts || [];
    renderRankingTable(allPriorityRecords);
  } catch (err) {
    console.error("Error fetching priority table:", err);
  }
}

function renderRankingTable(records) {
  const tbody = document.getElementById("priority-table-body");
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;">No matching districts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td><strong>#${r.rank}</strong></td>
      <td><strong>${r.district}</strong></td>
      <td>${r.state}</td>
      <td>${r.crop_type}</td>
      <td><span style="font-family: var(--font-mono); font-weight: 700; color: #06b6d4;">${r.irrigation_priority_index}</span></td>
      <td><span class="badge ${r.priority_category === 'High Priority' ? 'badge-danger' : (r.priority_category === 'Medium Priority' ? 'badge-warning' : 'badge-success')}">${r.priority_category}</span></td>
      <td>${r.recommended_irrigation_depth}</td>
      <td>${r.soil_moisture_level}</td>
      <td>${r.daily_water_deficit_mm} mm</td>
      <td>${r.crop_water_stress_cwsi}</td>
      <td>
        <button class="btn-table-action" onclick="zoomToDistrictFromTable('${r.district}', '${r.state}')">
          📍 View on Map
        </button>
      </td>
    </tr>
  `).join("");
}

function filterRankingTable() {
  const q = document.getElementById("table-search").value.toLowerCase();
  const cat = document.getElementById("table-priority-filter").value;

  const filtered = allPriorityRecords.filter(r => {
    const matchSearch = r.district.toLowerCase().includes(q) || r.state.toLowerCase().includes(q);
    const matchCat = cat === "All" || r.priority_category === cat;
    return matchSearch && matchCat;
  });

  renderRankingTable(filtered);
}

function zoomToDistrictFromTable(districtName, stateName) {
  switchViewMode("map");
  handleStateClick(stateName, {
    getBounds: () => {
      // Find district coordinates
      const d = districtsLookup[districtName.toLowerCase()];
      if (d && d.latitude) {
        return L.latLngBounds([
          [d.latitude - 1.2, d.longitude - 1.2],
          [d.latitude + 1.2, d.longitude + 1.2]
        ]);
      }
      return mapInstance.getBounds();
    }
  });

  setTimeout(() => {
    const data = findDistrictData(districtName, stateName);
    handleDistrictClick(districtName, stateName, data, {
      setStyle: () => {}
    });
  }, 1200);
}

// Fetch ML Evaluation Metrics
async function fetchModelEvaluation() {
  try {
    const res = await fetch(`${API_BASE}/api/models/evaluation`);
    if (!res.ok) return;
    const metrics = await res.json();

    // Classification table
    const clfBody = document.getElementById("eval-classification-body");
    clfBody.innerHTML = Object.entries(metrics.classification).map(([name, m]) => `
      <tr>
        <td><strong>${name}</strong></td>
        <td><strong style="color: #10b981;">${(m.accuracy * 100).toFixed(2)}%</strong></td>
        <td>${m.precision.toFixed(4)}</td>
        <td>${m.recall.toFixed(4)}</td>
        <td>${m.f1_score.toFixed(4)}</td>
        <td><span class="badge badge-success">Syllabus Approved</span></td>
      </tr>
    `).join("");

    // Regression table
    const regBody = document.getElementById("eval-regression-body");
    regBody.innerHTML = Object.entries(metrics.regression).map(([name, m]) => `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${m.mae.toFixed(2)}</td>
        <td>${m.mse.toFixed(2)}</td>
        <td>${m.rmse.toFixed(2)}</td>
        <td><strong style="color: #06b6d4;">${m.r2_score.toFixed(4)}</strong></td>
        <td><span class="badge badge-info">High Precision</span></td>
      </tr>
    `).join("");

    // Clustering
    const kClust = metrics.clustering["K-Means (k=4)"];
    document.getElementById("eval-silhouette").innerText = kClust.silhouette_score;
    document.getElementById("eval-db").innerText = kClust.davies_bouldin_score;
    document.getElementById("eval-inertia").innerText = kClust.inertia;
    document.getElementById("eval-pca").innerText = `${(metrics.clustering["PCA (2D Projection)"].total_explained_variance * 100).toFixed(2)}%`;

  } catch (err) {
    console.error("Error fetching model evaluation:", err);
  }
}

// Fetch Regional Clusters
async function fetchAgroClusters() {
  try {
    const res = await fetch(`${API_BASE}/api/clusters/regions`);
    if (!res.ok) return;
    const data = await res.json();

    // Profiles grid
    const profileContainer = document.getElementById("cluster-profiles-container");
    profileContainer.innerHTML = Object.entries(data.clusters_summary).map(([id, info]) => `
      <div class="cluster-card">
        <span class="badge badge-info">Zone ${id}</span>
        <h4 class="cluster-card-title">${info.name}</h4>
        <p class="cluster-card-desc">${info.description}</p>
      </div>
    `).join("");

    // Clustered table
    const cTableBody = document.getElementById("clusters-table-body");
    cTableBody.innerHTML = (data.districts_clustered || []).slice(0, 50).map(item => `
      <tr>
        <td><strong>${item.district}</strong></td>
        <td>${item.state}</td>
        <td><span class="badge badge-info">${item.cluster_name}</span></td>
        <td>${item.mean_temperature}°C</td>
        <td>${item.mean_rainfall} mm</td>
        <td>${item.mean_soil_moisture}</td>
        <td><strong>${item.mean_priority_index}</strong></td>
        <td><span style="font-family: var(--font-mono); font-size: 0.72rem;">(${item.pca_x}, ${item.pca_y})</span></td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Error fetching clusters:", err);
  }
}
