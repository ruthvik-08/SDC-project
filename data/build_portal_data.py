import json
import re
import pandas as pd

data = pd.read_csv("data/processed/krishijal_master_dataset.csv")
geo = json.load(open("frontend/data/india_districts_simplified.geojson"))

def clean(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"\band\b", "", s)
    return "".join(c for c in s if c.isalnum())

map_districts = {}
for f in geo["features"]:
    st = f["properties"]["state"]
    dt = f["properties"]["district"]
    map_districts[(clean(st), clean(dt))] = (st, dt)

aliases = {
    ("sikkim", "gangtok"): ("Sikkim", "East District"),
    ("sikkim", "pakyong"): ("Sikkim", "East District"),
    ("sikkim", "geyzing"): ("Sikkim", "West District"),
    ("sikkim", "mangan"): ("Sikkim", "North  District"),
    ("sikkim", "namchi"): ("Sikkim", "South District"),
    ("goa", "bardez"): ("Goa", "North Goa"),
    ("goa", "tiswadi"): ("Goa", "North Goa"),
    ("goa", "salcete"): ("Goa", "South Goa"),
    ("uttarakhand", "pantnagar"): ("Uttarakhand", "Udham Singh Nagar"),
    ("westbengal", "burdwan"): ("West Bengal", "Purba Bardhaman"),
    ("dadranagarhavelidamandiu", "daman"): ("Dadra and Nagar Haveli", "Dadra and Nagar Haveli"),
    ("dadranagarhavelidamandiu", "diu"): ("Dadra and Nagar Haveli", "Dadra and Nagar Haveli"),
    ("dadranagarhavelidamandiu", "dadranagarhaveli"): ("Dadra and Nagar Haveli", "Dadra and Nagar Haveli"),
    ("telangana", "warangal"): ("Telangana", "Warangal Urban"),
    ("andamannicobar", "northmiddleandaman"): ("Andaman and Nicobar", "North and Middle Andaman"),
    ("meghalaya", "ribhoi"): ("Meghalaya", "Ribhoi"),
    ("jammuandkashmir", "anantnag"): ("JAMMU & KASHMIR", "Anantnag"),
    ("jammuandkashmir", "baramulla"): ("JAMMU & KASHMIR", "Baramulla"),
    ("jammuandkashmir", "jammu"): ("JAMMU & KASHMIR", "Jammu"),
    ("jammuandkashmir", "srinagar"): ("JAMMU & KASHMIR", "Srinagar"),
    ("jammuandkashmir", "udhampur"): ("JAMMU & KASHMIR", "Udhampur"),
}

out = {}
unmatched = []

for (state, district), g in data.groupby(["state", "district"]):
    c_st = clean(state)
    c_dt = clean(district)
    
    target = None
    if (c_st, c_dt) in aliases:
        target = aliases[(c_st, c_dt)]
    elif (c_st, c_dt) in map_districts:
        target = map_districts[(c_st, c_dt)]
    else:
        for (gst, gdt), (ost, odt) in map_districts.items():
            if (c_st in gst or gst in c_st) and (c_dt in gdt or gdt in c_dt):
                target = (ost, odt)
                break
                
    if target is None:
        unmatched.append(state + " / " + district)
        continue
        
    monthly = g.groupby("month").irrigation_priority_index.mean().round(1)
    counts = g.stress_level.value_counts().to_dict()
    key = target[0] + "|" + target[1]
    out[key] = {
        "state": target[0],
        "district": target[1],
        "ipi": round(float(g.irrigation_priority_index.mean()), 1),
        "ndvi": round(float(g.ndvi.mean()), 3),
        "rainfall": round(float(g.rainfall.mean()), 2),
        "soil_wetness": round(float(g.effective_soil_wetness.mean()), 3),
        "stress": max(counts, key=counts.get),
        "stress_counts": counts,
        "months": {str(k): v for k, v in monthly.items()},
        "records": len(g)
    }

json.dump(out, open("frontend/data/portal_data.json", "w"))
print("districts with data:", len(out), "| not matched to map:", len(unmatched))
