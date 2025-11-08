import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  MapPin, 
  Car, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Navigation,
  Zap,
  Target,
  Wifi,
  Battery,
  Thermometer,
  Signal
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons for different parking lot statuses
const createCustomIcon = (color, icon) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: bold;
      ">
        ${icon}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const ParkingLotMarker = ({ lot, onLotClick, isSelected }) => {
  const utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots;
  
  let iconColor = '#10B981'; // Green for low utilization
  let iconSymbol = 'P';
  
  if (utilization > 0.8) {
    iconColor = '#EF4444'; // Red for high utilization
    iconSymbol = 'F';
  } else if (utilization > 0.5) {
    iconColor = '#F59E0B'; // Yellow for medium utilization
    iconSymbol = 'H';
  }
  
  const icon = createCustomIcon(iconColor, iconSymbol);
  
  return (
    <Marker
      position={[lot.location.lat, lot.location.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onLotClick(lot),
      }}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-bold text-lg mb-2">{lot.name}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Slots:</span>
              <span className="font-semibold">{lot.total_slots}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Available:</span>
              <span className="font-semibold text-green-600">{lot.competitive_slots}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Reserved:</span>
              <span className="font-semibold text-yellow-600">{lot.reserved_slots}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Occupied:</span>
              <span className="font-semibold text-red-600">{lot.occupied_slots}</span>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    utilization > 0.8 ? 'bg-red-500' : 
                    utilization > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${utilization * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(utilization * 100)}% Utilization
              </div>
            </div>
            <button
              onClick={() => onLotClick(lot)}
              className="w-full mt-3 bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

const UserLocationMarker = ({ position }) => {
  const icon = createCustomIcon('#3B82F6', 'U');
  
  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="p-2">
          <h3 className="font-bold text-blue-600">Your Location</h3>
          <p className="text-sm text-gray-600">
            Lat: {position[0].toFixed(4)}, Lng: {position[1].toFixed(4)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

const DestinationMarker = ({ position }) => {
  const icon = createCustomIcon('#8B5CF6', 'D');
  
  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="p-2">
          <h3 className="font-bold text-purple-600">Destination</h3>
          <p className="text-sm text-gray-600">
            Lat: {position[0].toFixed(4)}, Lng: {position[1].toFixed(4)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  
  return null;
};

const InteractiveParkingMap = ({ 
  parkingLots = [], 
  currentLocation = { lat: 40.7128, lng: -74.0060 },
  destination = null,
  onLotSelect,
  onLocationSelect,
  selectedLot = null,
  liveUpdates = true,
  connectionStatus = 'connected'
}) => {
  const [mapCenter, setMapCenter] = useState([currentLocation.lat, currentLocation.lng]);
  const [mapZoom, setMapZoom] = useState(13);
  const [userLocation, setUserLocation] = useState([currentLocation.lat, currentLocation.lng]);
  const [destinationLocation, setDestinationLocation] = useState(
    destination ? [destination.lat, destination.lng] : null
  );
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapType, setMapType] = useState('street');

  const mapRef = useRef(null);

  useEffect(() => {
    setUserLocation([currentLocation.lat, currentLocation.lng]);
    setMapCenter([currentLocation.lat, currentLocation.lng]);
  }, [currentLocation]);

  useEffect(() => {
    if (destination) {
      setDestinationLocation([destination.lat, destination.lng]);
    }
  }, [destination]);

  const handleMapClick = (latlng) => {
    if (onLocationSelect) {
      onLocationSelect({ lat: latlng[0], lng: latlng[1] });
    }
  };

  const handleLotClick = (lot) => {
    if (onLotSelect) {
      onLotSelect(lot);
    }
    setMapCenter([lot.location.lat, lot.location.lng]);
    setMapZoom(16);
  };

  const getTileLayerUrl = () => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getUtilizationColor = (utilization) => {
    if (utilization > 0.8) return '#EF4444';
    if (utilization > 0.5) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="w-full h-full relative">
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-white rounded-lg shadow-lg p-2 space-y-1">
          <button
            onClick={() => setMapType('street')}
            className={`w-full px-3 py-1 text-xs rounded ${
              mapType === 'street' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`w-full px-3 py-1 text-xs rounded ${
              mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType('terrain')}
            className={`w-full px-3 py-1 text-xs rounded ${
              mapType === 'terrain' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Terrain
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-2">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-full px-3 py-1 text-xs rounded ${
              showHeatmap ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {showHeatmap ? 'Hide' : 'Show'} Heatmap
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-2">
          <div className="flex items-center space-x-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            <span className="text-gray-700">
              {liveUpdates ? 'Live' : 'Static'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3">
        <h4 className="font-semibold text-sm mb-2">Parking Status</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Available (0-50%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Busy (50-80%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Full (80-100%)</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url={getTileLayerUrl()}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapController center={mapCenter} zoom={mapZoom} />
        <MapClickHandler onMapClick={handleMapClick} />
        
        {/* User Location Marker */}
        <UserLocationMarker position={userLocation} />
        
        {/* Destination Marker */}
        {destinationLocation && <DestinationMarker position={destinationLocation} />}
        
        {/* Parking Lot Markers */}
        {parkingLots.map((lot) => (
          <ParkingLotMarker
            key={lot.lot_id}
            lot={lot}
            onLotClick={handleLotClick}
            isSelected={selectedLot?.lot_id === lot.lot_id}
          />
        ))}
        
        {/* Heatmap Circles */}
        {showHeatmap && parkingLots.map((lot) => {
          const utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots;
          const radius = Math.max(50, utilization * 200);
          const color = getUtilizationColor(utilization);
          
          return (
            <Circle
              key={`heatmap-${lot.lot_id}`}
              center={[lot.location.lat, lot.location.lng]}
              radius={radius}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2,
                opacity: 0.6
              }}
            />
          );
        })}
        
        {/* Selected Lot Highlight */}
        {selectedLot && (
          <Circle
            center={[selectedLot.location.lat, selectedLot.location.lng]}
            radius={100}
            pathOptions={{
              color: '#3B82F6',
              fillColor: '#3B82F6',
              fillOpacity: 0.1,
              weight: 3,
              opacity: 0.8
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default InteractiveParkingMap;
