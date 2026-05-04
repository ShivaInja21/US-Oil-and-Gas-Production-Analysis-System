import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

interface RegionData {
  production: number;
  yoy_change: number;
  trend: string;
}

interface MapComponentProps {
  regionsData: Record<string, RegionData>;
  selectedRegion: string;
  onRegionSelect: (region: string) => void;
}

const STATE_COORDS: Record<string, [number, number]> = {
  'United States': [39.8283, -98.5795],
  'Alabama': [32.806671, -86.791130],
  'Alaska': [61.370716, -152.404419],
  'Arizona': [33.729759, -111.431221],
  'Arkansas': [34.969704, -92.373123],
  'California': [36.116203, -119.681564],
  'Colorado': [39.059811, -105.311104],
  'Connecticut': [41.597782, -72.755371],
  'Delaware': [39.318523, -75.507141],
  'Florida': [27.766279, -81.686783],
  'Georgia': [33.040619, -83.643074],
  'Hawaii': [21.094318, -157.498337],
  'Idaho': [44.240459, -114.478828],
  'Illinois': [40.349457, -88.986137],
  'Indiana': [39.849426, -86.258278],
  'Iowa': [42.011539, -93.210526],
  'Kansas': [38.526600, -96.726486],
  'Kentucky': [37.668140, -84.670067],
  'Louisiana': [31.169546, -91.867805],
  'Maine': [44.693947, -69.381927],
  'Maryland': [39.063946, -76.802101],
  'Massachusetts': [42.230171, -71.530106],
  'Michigan': [43.326618, -84.536095],
  'Minnesota': [45.694454, -93.900192],
  'Mississippi': [32.741646, -89.678696],
  'Missouri': [38.456085, -92.288368],
  'Montana': [46.921925, -110.454353],
  'Nebraska': [41.125370, -98.268082],
  'Nevada': [38.313515, -117.055374],
  'New Hampshire': [43.452492, -71.563896],
  'New Jersey': [40.298904, -74.521011],
  'New Mexico': [34.840515, -106.248482],
  'New York': [42.165726, -74.948051],
  'North Carolina': [35.630066, -79.806419],
  'North Dakota': [47.528912, -99.784012],
  'Ohio': [40.388783, -82.764915],
  'Oklahoma': [35.565342, -96.928917],
  'Oregon': [44.572021, -122.070938],
  'Pennsylvania': [40.590752, -77.209755],
  'Rhode Island': [41.680893, -71.511780],
  'South Carolina': [33.856892, -80.945007],
  'South Dakota': [44.299782, -99.438828],
  'Tennessee': [35.747845, -86.692345],
  'Texas': [31.054487, -97.563461],
  'Utah': [40.150032, -111.862434],
  'Vermont': [44.045876, -72.710686],
  'Virginia': [37.769337, -78.169968],
  'Washington': [47.400902, -121.490494],
  'West Virginia': [38.491226, -80.954453],
  'Wisconsin': [44.268543, -89.616508],
  'Wyoming': [42.755966, -107.302490],
};

function MapUpdater({ selectedRegion }: { selectedRegion: string }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedRegion && STATE_COORDS[selectedRegion]) {
      map.flyTo(STATE_COORDS[selectedRegion], 6);
    }
  }, [selectedRegion, map]);
  
  return null;
}

export default function MapComponent({ regionsData, selectedRegion, onRegionSelect }: MapComponentProps) {
  const getTrendColor = (trend) => {
    if (trend === 'increasing') return '#22c55e';
    if (trend === 'decreasing') return '#ef4444';
    return '#94a3b8';
  };

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1000,
        fontSize: '12px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Production Trend</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '6px' }}></div>
          <span>Increasing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '6px' }}></div>
          <span>Decreasing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#94a3b8', marginRight: '6px' }}></div>
          <span>Stable</span>
        </div>
      </div>
      <MapContainer 
        center={[39.8283, -98.5795]} 
        zoom={4} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapUpdater selectedRegion={selectedRegion} />
        
        {Object.entries(regionsData).map(([region, data]) => {
          const coords = STATE_COORDS[region];
          if (!coords) return null;
          
          const isSelected = region === selectedRegion;
          const radius = Math.max(5, Math.min(30, data.production / 50000));
          
          return (
            <CircleMarker
              key={region}
              center={coords}
              radius={radius}
              fillColor={getTrendColor(data.trend)}
              color={isSelected ? '#000' : '#fff'}
              weight={isSelected ? 3 : 1}
              opacity={1}
              fillOpacity={0.7}
              eventHandlers={{
                click: () => onRegionSelect(region)
              }}
            >
              <Popup>
                <strong>{region}</strong><br />
                Production: {data.production.toLocaleString()}K bbl/mo<br />
                YoY Change: {data.yoy_change.toFixed(1)}%<br />
                Trend: {data.trend}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
