import json
import re
import pandas as pd


def clean_text(text):
    lowered = text.lower().replace("&", "and")
    without_and = re.sub(r"\band\b", "", lowered)
    result = ""
    for ch in without_and:
        if ch.isalnum():
            result = result + ch
    return result


ALIASES = {
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


def load_map_districts(geojson_path):
    with open(geojson_path, "r") as f:
        geo = json.load(f)

    map_districts = {}
    for feature in geo["features"]:
        props = feature["properties"]
        st = props["state"]
        dt = props["district"]
        map_districts[(clean_text(st), clean_text(dt))] = (st, dt)
    return map_districts


def find_matching_district(state_name, district_name, map_districts):
    cleaned_state = clean_text(state_name)
    cleaned_district = clean_text(district_name)
    pair = (cleaned_state, cleaned_district)

    if pair in ALIASES:
        return ALIASES[pair]
    if pair in map_districts:
        return map_districts[pair]

    for (geo_st, geo_dt), original_pair in map_districts.items():
        state_matches = cleaned_state in geo_st or geo_st in cleaned_state
        district_matches = cleaned_district in geo_dt or geo_dt in cleaned_district
        if state_matches and district_matches:
            return original_pair
    return None


def find_most_frequent_stress(stress_counts):
    best_label = ""
    best_count = -1
    for label, count in stress_counts.items():
        if count > best_count:
            best_count = count
            best_label = label
    return best_label


def build_portal_data():
    data = pd.read_csv("data/processed/krishijal_master_dataset.csv")
    map_districts = load_map_districts("frontend/data/india_districts_simplified.geojson")

    portal_records = {}
    unmatched_count = 0

    for (state_name, district_name), group in data.groupby(["state", "district"]):
        target = find_matching_district(state_name, district_name, map_districts)
        if target is None:
            unmatched_count += 1
            continue

        monthly_series = group.groupby("month")["irrigation_priority_index"].mean()
        months_dict = {}
        for month_num, value in monthly_series.items():
            months_dict[str(month_num)] = round(float(value), 1)

        stress_counts = group["stress_level"].value_counts().to_dict()
        dominant_stress = find_most_frequent_stress(stress_counts)
        record_key = target[0] + "|" + target[1]

        portal_records[record_key] = {
            "state": target[0],
            "district": target[1],
            "ipi": round(float(group["irrigation_priority_index"].mean()), 1),
            "ndvi": round(float(group["ndvi"].mean()), 3),
            "rainfall": round(float(group["rainfall"].mean()), 2),
            "soil_wetness": round(float(group["effective_soil_wetness"].mean()), 3),
            "stress": dominant_stress,
            "stress_counts": stress_counts,
            "months": months_dict,
            "records": len(group),
        }

    with open("frontend/data/portal_data.json", "w") as out_file:
        json.dump(portal_records, out_file)

    print("districts with data:", len(portal_records), "| not matched to map:", unmatched_count)


if __name__ == "__main__":
    build_portal_data()
