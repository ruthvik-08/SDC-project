CREATE DATABASE IF NOT EXISTS crop_stress_db;
USE crop_stress_db;

CREATE TABLE IF NOT EXISTS farmers (
    farmer_id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) DEFAULT '',
    village VARCHAR(120) DEFAULT '',
    state_name VARCHAR(100) NOT NULL,
    district_name VARCHAR(100) NOT NULL,
    primary_crop VARCHAR(80) DEFAULT 'Cotton',
    soil_type VARCHAR(80) DEFAULT 'Loamy',
    land_area_acres DECIMAL(6,2) DEFAULT 2.50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS districts (
    district_id INT AUTO_INCREMENT PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL,
    district_name VARCHAR(100) NOT NULL,
    lgd_code INT NULL,
    avg_temperature DECIMAL(5,2) DEFAULT 28.00,
    avg_rainfall DECIMAL(6,2) DEFAULT 0.00,
    avg_humidity DECIMAL(5,2) DEFAULT 60.00,
    UNIQUE KEY unique_state_district (state_name, district_name)
);

CREATE TABLE IF NOT EXISTS crops (
    crop_id INT AUTO_INCREMENT PRIMARY KEY,
    crop_name VARCHAR(80) NOT NULL,
    growth_stage VARCHAR(80) NOT NULL,
    UNIQUE KEY unique_crop_stage (crop_name, growth_stage)
);

CREATE TABLE IF NOT EXISTS soil_info (
    soil_id INT AUTO_INCREMENT PRIMARY KEY,
    district_id INT NOT NULL,
    soil_type VARCHAR(80) DEFAULT 'Loamy',
    soil_moisture DECIMAL(5,3) NOT NULL,
    soil_ph DECIMAL(4,2) DEFAULT 7.40,
    soil_organic_carbon DECIMAL(5,2) DEFAULT 0.48,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts(district_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS irrigation_predictions (
    prediction_id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NULL,
    district_id INT NOT NULL,
    crop_id INT NOT NULL,
    soil_id INT NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    rainfall DECIMAL(6,2) NOT NULL,
    soil_moisture DECIMAL(5,3) NOT NULL,
    soil_ph DECIMAL(4,2) DEFAULT 7.40,
    soil_organic_carbon DECIMAL(5,2) DEFAULT 0.48,
    stress_level VARCHAR(50) NOT NULL,
    stress_code INT NOT NULL,
    priority_index DECIMAL(5,2) NOT NULL,
    priority_category VARCHAR(60) NOT NULL,
    recommended_depth VARCHAR(50) NOT NULL,
    daily_deficit DECIMAL(6,2) DEFAULT 0.00,
    advisory TEXT,
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE,
    FOREIGN KEY (district_id) REFERENCES districts(district_id) ON DELETE CASCADE,
    FOREIGN KEY (crop_id) REFERENCES crops(crop_id) ON DELETE CASCADE,
    FOREIGN KEY (soil_id) REFERENCES soil_info(soil_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prediction_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    prediction_id INT NOT NULL,
    farmer_id INT NULL,
    action_note VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prediction_id) REFERENCES irrigation_predictions(prediction_id) ON DELETE CASCADE,
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE
);
