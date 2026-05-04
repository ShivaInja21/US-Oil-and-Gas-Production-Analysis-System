"""Interactive geographic visualization for regional production data.

Provides map-based interface with clickable regions that integrate with forecasting.
"""
from __future__ import annotations
from typing import Dict, Any, List
import pandas as pd

# State coordinates (centroids) for oil/gas producing states with EIA data
STATE_COORDS = {
    "United States": {"lat": 39.8283, "lon": -98.5795, "zoom": 3},
    "Alabama": {"lat": 32.3182, "lon": -86.9023, "zoom": 6},
    "Alaska": {"lat": 64.2008, "lon": -149.4937, "zoom": 4},
    "Arkansas": {"lat": 35.2010, "lon": -91.8318, "zoom": 6},
    "California": {"lat": 36.7783, "lon": -119.4179, "zoom": 5},
    "Colorado": {"lat": 39.5501, "lon": -105.7821, "zoom": 6},
    "Florida": {"lat": 27.6648, "lon": -81.5158, "zoom": 6},
    "Illinois": {"lat": 40.6331, "lon": -89.3985, "zoom": 6},
    "Indiana": {"lat": 40.2672, "lon": -86.1349, "zoom": 6},
    "Kansas": {"lat": 39.0119, "lon": -98.4842, "zoom": 6},
    "Kentucky": {"lat": 37.8393, "lon": -84.2700, "zoom": 6},
    "Louisiana": {"lat": 30.9843, "lon": -91.9623, "zoom": 6},
    "Michigan": {"lat": 44.3148, "lon": -85.6024, "zoom": 6},
    "Mississippi": {"lat": 32.3547, "lon": -89.3985, "zoom": 6},
    "Montana": {"lat": 46.8797, "lon": -110.3626, "zoom": 6},
    "Nebraska": {"lat": 41.4925, "lon": -99.9018, "zoom": 6},
    "New Mexico": {"lat": 34.5199, "lon": -105.8701, "zoom": 6},
    "North Dakota": {"lat": 47.5515, "lon": -101.0020, "zoom": 6},
    "Ohio": {"lat": 40.4173, "lon": -82.9071, "zoom": 6},
    "Oklahoma": {"lat": 35.4676, "lon": -97.5164, "zoom": 6},
    "Pennsylvania": {"lat": 41.2033, "lon": -77.1945, "zoom": 6},
    "Texas": {"lat": 31.9686, "lon": -99.9018, "zoom": 5},
    "Utah": {"lat": 39.3210, "lon": -111.0937, "zoom": 6},
    "West Virginia": {"lat": 38.5976, "lon": -80.4549, "zoom": 7},
    "Wyoming": {"lat": 43.0760, "lon": -107.2903, "zoom": 6},
    "Federal Offshore Gulf of Mexico": {"lat": 27.5, "lon": -90.0, "zoom": 6},
}


def get_region_geojson(regions_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert region data to GeoJSON format for map visualization.
    
    Args:
        regions_data: Dict mapping region names to their production metrics
        
    Returns:
        GeoJSON FeatureCollection with point features for each region
    """
    features = []
    
    for region, data in regions_data.items():
        if region not in STATE_COORDS:
            continue
            
        coords = STATE_COORDS[region]
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [coords["lon"], coords["lat"]]
            },
            "properties": {
                "name": region,
                "production": data.get("production", 0),
                "trend": data.get("trend", "stable"),
                "yoy_change": data.get("yoy_change", 0),
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def create_map_html(regions_data: Dict[str, Any], selected_region: str = "United States") -> str:
    """Generate interactive Leaflet map HTML with clickable regions.
    
    Args:
        regions_data: Dict with region names as keys and production metrics as values
        selected_region: Currently selected region to highlight
        
    Returns:
        HTML string containing the complete map visualization
    """
    geojson = get_region_geojson(regions_data)
    
    # Get center coordinates
    center = STATE_COORDS.get(selected_region, STATE_COORDS["United States"])
    
    # Build marker data for JavaScript
    markers_js = []
    for region, coords in STATE_COORDS.items():
        data = regions_data.get(region, {})
        production = data.get("production", 0)
        trend = data.get("trend", "stable")
        yoy_change = data.get("yoy_change", 0)
        
        # Color based on trend
        color = "#28a745" if yoy_change > 0 else "#dc3545" if yoy_change < 0 else "#6c757d"
        
        # Size based on production volume
        radius = max(8, min(25, production / 50000))
        
        is_selected = region == selected_region
        
        markers_js.append(f"""
        {{
            lat: {coords['lat']},
            lon: {coords['lon']},
            name: "{region}",
            production: {production:.0f},
            trend: "{trend}",
            yoy_change: {yoy_change:.2f},
            color: "{color}",
            radius: {radius},
            selected: {str(is_selected).lower()}
        }}
        """)
    
    markers_array = ",".join(markers_js)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            #map {{ height: 500px; width: 100%; border-radius: 8px; }}
            .legend {{
                background: white;
                padding: 10px;
                border-radius: 5px;
                box-shadow: 0 0 15px rgba(0,0,0,0.2);
            }}
            .legend-item {{
                margin: 5px 0;
                display: flex;
                align-items: center;
            }}
            .legend-color {{
                width: 20px;
                height: 20px;
                border-radius: 50%;
                margin-right: 8px;
            }}
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            // Initialize map
            var map = L.map('map').setView([{center['lat']}, {center['lon']}], {center['zoom']});
            
            // Add tile layer
            L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }}).addTo(map);
            
            // Region data
            var regions = [{markers_array}];
            
            // Add markers
            regions.forEach(function(region) {{
                var marker = L.circleMarker([region.lat, region.lon], {{
                    radius: region.radius,
                    fillColor: region.color,
                    color: region.selected ? '#000' : '#fff',
                    weight: region.selected ? 3 : 2,
                    opacity: 1,
                    fillOpacity: 0.7
                }});
                
                var popupContent = `
                    <div style="min-width: 200px;">
                        <h4 style="margin: 0 0 10px 0;">${{region.name}}</h4>
                        <p style="margin: 5px 0;"><strong>Production:</strong> ${{region.production.toLocaleString()}} thousand barrels/month</p>
                        <p style="margin: 5px 0;"><strong>YoY Change:</strong> ${{region.yoy_change.toFixed(2)}}%</p>
                        <p style="margin: 5px 0;"><strong>Trend:</strong> ${{region.trend}}</p>
                        <button onclick="selectRegion('${{region.name}}')" 
                                style="margin-top: 10px; padding: 5px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            View Details
                        </button>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                marker.addTo(map);
                
                // Click handler
                marker.on('click', function() {{
                    selectRegion(region.name);
                }});
            }});
            
            // Add legend
            var legend = L.control({{position: 'bottomright'}});
            legend.onAdd = function(map) {{
                var div = L.DomUtil.create('div', 'legend');
                div.innerHTML = `
                    <h4 style="margin: 0 0 10px 0;">Production Trend</h4>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #28a745;"></div>
                        <span>Increasing</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #6c757d;"></div>
                        <span>Stable</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #dc3545;"></div>
                        <span>Decreasing</span>
                    </div>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">
                        Circle size = production volume<br>
                        Click region to update dashboard
                    </p>
                `;
                return div;
            }};
            legend.addTo(map);
            
            // Region selection handler
            function selectRegion(regionName) {{
                // Send message to Streamlit
                window.parent.postMessage({{
                    type: 'streamlit:setComponentValue',
                    value: regionName
                }}, '*');
            }}
        </script>
    </body>
    </html>
    """
    
    return html


def calculate_region_metrics(region: str, ts: pd.Series, projection_value: float = None) -> Dict[str, Any]:
    """Calculate metrics for a region to display on map.
    
    Args:
        region: Region name
        ts: Time series of historical production data
        projection_value: Optional projected production value
        
    Returns:
        Dict with production, trend, and yoy_change metrics
    """
    if ts is None or len(ts) == 0:
        return {"production": 0, "trend": "unknown", "yoy_change": 0}
    
    # Get latest production value
    latest_production = float(ts.iloc[-1]) if len(ts) > 0 else 0
    
    # Calculate YoY change if we have at least 2 years
    yoy_change = 0
    if len(ts) >= 2:
        prev_year = ts.iloc[-2]
        if prev_year != 0:
            yoy_change = ((latest_production - prev_year) / prev_year) * 100
    
    # Determine trend
    trend = "stable"
    if yoy_change > 2:
        trend = "increasing"
    elif yoy_change < -2:
        trend = "decreasing"
    
    return {
        "production": latest_production,
        "trend": trend,
        "yoy_change": yoy_change,
    }
