var LAYERS = {
  stress:{name:"Stress level",cat:["#2e9e5b","#e6c229","#e8873a","#c0392b"],labels:["Low","Moderate","High","Severe"]},
  ipi:{name:"Irrigation priority",key:"ipi",unit:"/100",ramp:["#fbeee6","#f1b896","#d9784f","#b5573a","#7a2e17"]},
  ndvi:{name:"NDVI",key:"ndvi",unit:"",ramp:["#ffff66","#a6e07a","#4fbf8a","#14917f","#1d4e5f"]},
  rainfall:{name:"Rainfall",key:"rainfall",unit:" mm/day",ramp:["#eef6fb","#bcdcee","#7fb8de","#3f86c4","#1f4e8c"]},
  wet:{name:"Soil wetness",key:"soil_wetness",unit:"",ramp:["#f3ead7","#d9c79a","#9fb98c","#4f9d9a","#1f6a7a"]}
};
var layer = "ndvi", DATA = {}, statesGeo, distsGeo, stateLayer, distLayer = null, current = null, selected = null, ranges = {};
var map = L.map("map", {zoomControl:false, zoomSnap:0.25}).setView([22.5, 80], 4.5);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {attribution:"© OpenStreetMap © CARTO"}).addTo(map);

function normState(s) {
  return (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function colorFor(d) {
  if (!d) return "#cfcac3";
  var L1 = LAYERS[layer];
  if (layer === "stress") return L1.cat[L1.labels.indexOf(d.stress)];
  var r = ranges[layer], t = (d[L1.key] - r[0]) / ((r[1] - r[0]) || 1);
  return L1.ramp[Math.max(0, Math.min(L1.ramp.length - 1, Math.floor(t * L1.ramp.length)))];
}

function dataFor(p) {
  if (!p) return null;
  if (DATA[p.state + "|" + p.district]) return DATA[p.state + "|" + p.district];
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

function styleDist(f) { return {fillColor:colorFor(dataFor(f.properties)), fillOpacity:.88, color:"#fff", weight:.8}; }

function drawLegend() {
  var L1 = LAYERS[layer], c = layer === "stress" ? L1.cat : L1.ramp, h = "";
  for (var i = 0; i < c.length; i++) h += "<div style='background:" + c[i] + "'></div>";
  var lo = layer === "stress" ? "LOW" : "LOW", hi = layer === "stress" ? "SEVERE" : "HIGH";
  return "<div class='leg'><div style='background:#cfcac3;flex:.5'></div>" + h + "</div><div class='legl'><span>NO DATA</span><span>" + lo + "</span><span>" + hi + "</span></div>";
}
function showInfo(d, p) {
  var L1 = LAYERS[layer], el = document.getElementById("info"), h;
  if (!d) {
    h = "<h4>" + (p ? p.district : (current || "India")) + "</h4><p>" + (p ? "No genuine data for this district." : (current ? "Click a district for details." : "Click a state to zoom in.")) + "</p>";
  } else {
    var v = layer === "stress" ? d.stress : d[L1.key] + L1.unit;
    h = "<h4>" + d.district + ", " + d.state + "</h4><div class='v mono'>" + v + "</div><p>" + L1.name + " · average Jun–Nov 2023</p>"
      + "<p>Irrigation priority " + d.ipi + " · NDVI " + d.ndvi + " · rain " + d.rainfall + " mm/day</p>"
      + "<p>Monthly irrigation priority</p><div class='chart'>";
    var mn = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    for (var m = 6; m <= 11; m++) h += "<div data-m='" + mn[m] + "' style='height:" + Math.max(4, (d.months[m] || 0) * 0.6) + "px'></div>";
    h += "</div><p style='margin-top:18px'>" + d.records + " records</p>";
  }
  el.innerHTML = h + drawLegend();
}
function showStates() {
  current = null; document.getElementById("pill").textContent = "INDIA";
  if (distLayer) { map.removeLayer(distLayer); distLayer = null; }
  stateLayer.addTo(map); map.flyTo([22.5, 80], 4.5, {duration:1.2}); showInfo(null);
}
function showState(name, bounds) {
  current = name; document.getElementById("pill").textContent = name.toUpperCase();
  map.removeLayer(stateLayer); if (distLayer) map.removeLayer(distLayer);
  var nTarget = normState(name);
  var feats = distsGeo.features.filter(function (f) {
    var nFeat = normState(f.properties.state);
    return nFeat === nTarget || nFeat.indexOf(nTarget) !== -1 || nTarget.indexOf(nFeat) !== -1;
  });
  distLayer = L.geoJSON({type:"FeatureCollection", features:feats}, {style:styleDist, onEachFeature:function (f, ly) {
    ly.on("click", function () { selected = f.properties; showInfo(dataFor(f.properties), f.properties); });
    ly.on("mouseover", function () { ly.setStyle({weight:2.5, color:"#b5573a"}); });
    ly.on("mouseout", function () { distLayer.resetStyle(ly); });
    ly.bindTooltip(f.properties.district, {sticky:true});
  }}).addTo(map);
  if (distLayer.getBounds().isValid()) {
    map.flyToBounds(distLayer.getBounds(), {duration:1.2, padding:[40, 40]});
  }
  showInfo(null);
}
function recolor() { if (distLayer) distLayer.setStyle(styleDist); showInfo(selected ? dataFor(selected) : null, selected); }

function buildLayerLinks() {
  var h = "";
  for (var k in LAYERS) h += "<a data-k='" + k + "' class='" + (k === layer ? "sel" : "") + "' style='color:" + (k === "stress" ? "#c0392b" : "var(--acc)") + "'>" + LAYERS[k].name + "</a>";
  var box = document.getElementById("layers"); box.innerHTML = h;
  box.onclick = function (e) { if (e.target.dataset.k) { layer = e.target.dataset.k; buildLayerLinks(); recolor(); } };
}
function computeRanges() {
  for (var k in LAYERS) { if (!LAYERS[k].key) continue; var lo = 1e9, hi = -1e9;
    for (var id in DATA) { var v = DATA[id][LAYERS[k].key]; if (v < lo) lo = v; if (v > hi) hi = v; }
    ranges[k] = [lo, hi]; }
}

Promise.all([fetch("data/india_states_simplified.geojson").then(function (r) { return r.json(); }),
             fetch("data/india_districts_simplified.geojson").then(function (r) { return r.json(); }),
             fetch("data/portal_data.json").then(function (r) { return r.json(); })]).then(function (res) {
  statesGeo = res[0]; distsGeo = res[1]; DATA = res[2]; computeRanges(); buildLayerLinks();
  var dl = ""; for (var id in DATA) dl += "<option value='" + DATA[id].district + ", " + DATA[id].state + "'>";
  document.getElementById("dl").innerHTML = dl;
  stateLayer = L.geoJSON(statesGeo, {style:{fillColor:"#b5573a", fillOpacity:.12, color:"#b5573a", weight:1.2}, onEachFeature:function (f, ly) {
    ly.on("click", function () { showState(f.properties.state, ly.getBounds()); });
    ly.on("mouseover", function () { ly.setStyle({fillOpacity:.35}); });
    ly.on("mouseout", function () { stateLayer.resetStyle(ly); });
    ly.bindTooltip(f.properties.state, {sticky:true});
  }}).addTo(map);
  showInfo(null);
}).catch(function () { document.getElementById("info").innerHTML = "<h4>Could not load data</h4><p>Open this page through the FastAPI server at /app/portal.html.</p>"; });

document.getElementById("lb").onclick = function () { document.getElementById("panel").classList.add("on"); this.style.display = "none"; };
document.getElementById("lyr").onclick = function () { document.getElementById("panel").classList.toggle("on"); };
document.getElementById("pill").onclick = function () { if (current) showStates(); };
document.getElementById("theme").onclick = function () { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "" : "dark"; };
document.getElementById("search").onchange = function () {
  for (var id in DATA) { if (DATA[id].district + ", " + DATA[id].state === this.value) {
    var parts = id.split("|"); showState(parts[0]); selected = {state:parts[0], district:parts[1]}; showInfo(DATA[id], selected); } }
};
function route() { var on = location.hash.indexOf("#/map") === 0; document.getElementById("app").classList.toggle("on", on); if (on) setTimeout(function () { map.invalidateSize(); }, 50); }
window.onhashchange = route; route();
