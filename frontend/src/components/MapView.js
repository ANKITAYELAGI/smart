import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Target, 
  Zap, 
  Car, 
  Clock,
  RefreshCw,
  Layers,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import InteractiveParkingMap from './InteractiveParkingMap';
import toast from 'react-hot-toast';

const MapView = ({ parkingLots = [], onLotSelect, onReservation }) => {
  const [currentLocation, setCurrentLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [destination, setDestination] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [mapView, setMapView] = useState('full'); // 'full', 'split'
  const [showDetails, setShowDetails] = useState(true);
  const [costPrediction, setCostPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
          toast.error('Could not get your location. Using default location.');
        }
      );
    }
  }, []);

  const handleLocationSelect = (location) => {
    if (!destination) {
      setDestination(location);
      toast.success('Destination set! Click on a parking lot to see cost prediction.');
    } else {
      setDestination(null);
      setCostPrediction(null);
      toast.info('Destination cleared.');
    }
  };

  const handleLotSelect = (lot) => {
    setSelectedLot(lot);
    if (destination) {
      predictCost(lot);
    }
  };

  const predictCost = async (lot) => {
    if (!destination) {
      toast.error('Please set a destination first');
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        user_id: 'user_001',
        current_location: currentLocation,
        destination: destination,
        arrival_time: new Date().toISOString(),
        duration: 120
      };

      const response = await fetch(`${API_BASE_URL}/predict-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      setCostPrediction(data);
      toast.success(`Cost prediction: $${data.costs[lot.lot_id]?.total_cost?.toFixed(2) || 'N/A'}`);
    } catch (error) {
      console.error('Error predicting cost:', error);
      toast.error('Failed to predict parking cost');
    } finally {
      setLoading(false);
    }
  };

  const makeReservation = async (lot) => {
    if (!destination) {
      toast.error('Please set a destination first');
      return;
    }

    try {
      const requestData = {
        user_id: 'user_001',
        current_location: currentLocation,
        destination: destination,
        arrival_time: new Date().toISOString(),
        duration: 120
      };

      const response = await fetch(`${API_BASE_URL}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        if (onReservation) {
          onReservation(data.reservation);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error making reservation:', error);
      toast.error('Failed to make reservation');
    }
  };

  const getLotStatus = (lot) => {
    const utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots;
    if (utilization > 0.8) return { status: 'Full', color: 'text-red-600', bg: 'bg-red-100' };
    if (utilization > 0.5) return { status: 'Busy', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { status: 'Available', color: 'text-green-600', bg: 'bg-green-100' };
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="gradient-bg text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <MapPin className="h-6 w-6 mr-2" />
              Interactive Parking Map
            </h1>
            <p className="text-blue-100">Real-time parking availability with live updates</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">
                {liveUpdates ? 'Live Updates' : 'Offline Mode'}
              </span>
            </div>
            
            <button
              onClick={() => setLiveUpdates(!liveUpdates)}
              className="glass-effect px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition-colors"
            >
              {liveUpdates ? 'Live ON' : 'Live OFF'}
            </button>
            
            <button
              onClick={() => setMapView(mapView === 'full' ? 'split' : 'full')}
              className="glass-effect px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition-colors"
            >
              {mapView === 'full' ? 'Split View' : 'Full Map'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Map Container */}
        <div className={`${mapView === 'full' ? 'w-full' : 'w-2/3'} relative`}>
          <InteractiveParkingMap
            parkingLots={parkingLots}
            currentLocation={currentLocation}
            destination={destination}
            onLotSelect={handleLotSelect}
            onLocationSelect={handleLocationSelect}
            selectedLot={selectedLot}
            liveUpdates={liveUpdates}
            connectionStatus={connectionStatus}
          />
          
          {/* Map Instructions */}
          <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg p-3 max-w-xs">
            <h3 className="font-semibold text-sm mb-2">Map Instructions</h3>
            <div className="text-xs space-y-1 text-gray-600">
              <div className="flex items-center space-x-2">
                <MapPin className="h-3 w-3 text-blue-500" />
                <span>Click map to set destination</span>
              </div>
              <div className="flex items-center space-x-2">
                <Car className="h-3 w-3 text-green-500" />
                <span>Click parking lots for details</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="h-3 w-3 text-purple-500" />
                <span>View cost predictions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {mapView === 'split' && (
          <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col">
            {/* Location Info */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold mb-3 flex items-center">
                <Navigation className="h-4 w-4 mr-2" />
                Location Details
              </h3>
              
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800">Current Location</div>
                  <div className="text-xs text-blue-600">
                    {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                  </div>
                </div>
                
                {destination && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-purple-800">Destination</div>
                    <div className="text-xs text-purple-600">
                      {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
                    </div>
                    <button
                      onClick={() => {
                        setDestination(null);
                        setCostPrediction(null);
                        setSelectedLot(null);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 mt-1"
                    >
                      Clear destination
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Lot Details */}
            {selectedLot && (
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Car className="h-4 w-4 mr-2" />
                  Selected Parking Lot
                </h3>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="font-medium text-gray-900">{selectedLot.name}</div>
                    <div className="text-sm text-gray-600">{selectedLot.location.lat.toFixed(4)}, {selectedLot.location.lng.toFixed(4)}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-green-50 rounded p-2 text-center">
                      <div className="font-semibold text-green-800">{selectedLot.competitive_slots}</div>
                      <div className="text-xs text-green-600">Available</div>
                    </div>
                    <div className="bg-yellow-50 rounded p-2 text-center">
                      <div className="font-semibold text-yellow-800">{selectedLot.reserved_slots}</div>
                      <div className="text-xs text-yellow-600">Reserved</div>
                    </div>
                    <div className="bg-red-50 rounded p-2 text-center">
                      <div className="font-semibold text-red-800">{selectedLot.occupied_slots}</div>
                      <div className="text-xs text-red-600">Occupied</div>
                    </div>
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <div className="font-semibold text-blue-800">{selectedLot.total_slots}</div>
                      <div className="text-xs text-blue-600">Total</div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Utilization</span>
                      <span className="text-sm font-semibold">
                        {Math.round((selectedLot.occupied_slots + selectedLot.reserved_slots) / selectedLot.total_slots * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (selectedLot.occupied_slots + selectedLot.reserved_slots) / selectedLot.total_slots > 0.8 ? 'bg-red-500' : 
                          (selectedLot.occupied_slots + selectedLot.reserved_slots) / selectedLot.total_slots > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${(selectedLot.occupied_slots + selectedLot.reserved_slots) / selectedLot.total_slots * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {costPrediction && costPrediction.costs[selectedLot.lot_id] && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-green-800 mb-2">Cost Prediction</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Driving: {costPrediction.costs[selectedLot.lot_id].driving_time.toFixed(1)}min</div>
                        <div>Walking: {costPrediction.costs[selectedLot.lot_id].walking_time.toFixed(1)}min</div>
                        <div>Waiting: {costPrediction.costs[selectedLot.lot_id].waiting_time.toFixed(1)}min</div>
                        <div className="font-semibold">
                          Total: ${costPrediction.costs[selectedLot.lot_id].total_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => makeReservation(selectedLot)}
                    disabled={loading || selectedLot.competitive_slots === 0}
                    className="w-full btn-primary text-sm flex items-center justify-center"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Car className="h-4 w-4 mr-2" />
                    )}
                    Reserve Slot
                  </button>
                </div>
              </div>
            )}

            {/* All Parking Lots */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                All Parking Lots
              </h3>
              
              <div className="space-y-2">
                {parkingLots.map((lot) => {
                  const lotStatus = getLotStatus(lot);
                  return (
                    <div
                      key={lot.lot_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedLot?.lot_id === lot.lot_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => handleLotSelect(lot)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{lot.name}</div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${lotStatus.bg} ${lotStatus.color}`}>
                          {lotStatus.status}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{lot.competitive_slots}</div>
                          <div>Available</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-yellow-600">{lot.reserved_slots}</div>
                          <div>Reserved</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">{lot.occupied_slots}</div>
                          <div>Occupied</div>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className={`h-1 rounded-full transition-all duration-500 ${
                              (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.8 ? 'bg-red-500' : 
                              (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ 
                              width: `${(lot.occupied_slots + lot.reserved_slots) / lot.total_slots * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
