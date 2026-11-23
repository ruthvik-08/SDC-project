import json
import pandas as pd

data = pd.read_csv("data/processed/krishijal_master_dataset.csv")
geo = json.load(open("frontend/data/india_districts_simplified.geojson"))

map_names = {}
for f in geo["features"]:
    key = "".join(c for c in (f["properties"]["state"] + f["properties"]["district"]).lower() if c.isalnum())
    map_names[key] = [f["properties"]["state"], f["properties"]["district"]]

out = {}
unmatched = []
for (state, district), g in data.groupby(["state", "district"]):
    key = "".join(c for c in (state + district).lower() if c.isalnum())
    if key not in map_names:
        unmatched.append(state + " / " + district)
        continue
    m = map_names[key]
    monthly = g.groupby("month").irrigation_priority_index.mean().round(1)
    counts = g.stress_level.value_counts().to_dict()
    out[m[0] + "|" + m[1]] = {
        "state": state, "district": district,
        "ipi": round(g.irrigation_priority_index.mean(), 1),
        "ndvi": round(g.ndvi.mean(), 3),
        "rainfall": round(g.rainfall.mean(), 2),
        "soil_wetness": round(g.effective_soil_wetness.mean(), 3),
        "stress": max(counts, key=counts.get),
        "stress_counts": counts,
        "months": {str(k): v for k, v in monthly.items()},
        "records": len(g),
    }

json.dump(out, open("frontend/data/portal_data.json", "w"))
print("districts with data:", len(out), "| not matched to map:", len(unmatched))
