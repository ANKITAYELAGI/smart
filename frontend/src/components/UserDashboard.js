import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  MapPin, 
  Clock, 
  Car, 
  Navigation, 
  Zap, 
  Target,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
  TrendingDown,
  Map,
  Grid3X3,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import MapView from './MapView';

const UserDashboard = () => {
  const [currentLocation, setCurrentLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [destination, setDestination] = useState({ lat: 40.7589, lng: -73.9851 });
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [costPrediction, setCostPrediction] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'
  const [realTimeStats, setRealTimeStats] = useState({
    totalSlots: 0,
    occupiedSlots: 0,
    reservedSlots: 0,
    availableSlots: 0,
    utilizationRate: 0,
    averageCost: 0,
    lastUpdate: new Date()
  });

  const API_BASE_URL = 'http://localhost:8000';
  const wsRef = useRef(null);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    fetchParkingLots();
    fetchUserReservations();
    connectWebSocket();
    
    // Set up periodic updates
    updateIntervalRef.current = setInterval(() => {
      if (liveUpdates) {
        fetchParkingLots();
        updateRealTimeStats();
      }
    }, 5000); // Update every 5 seconds

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [liveUpdates]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        toast.success('Connected to live updates');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        toast.error('Lost connection to live updates');
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (liveUpdates) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('error');
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'sensor_update':
        updateParkingLotStatus(data);
        break;
      case 'reservation_update':
        updateReservationStatus(data);
        break;
      case 'cost_update':
        updateCostPrediction(data);
        break;
      case 'optimization_update':
        handleOptimizationUpdate(data);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const updateParkingLotStatus = (data) => {
    setParkingLots(prevLots => 
      prevLots.map(lot => 
        lot.lot_id === data.lot_id 
          ? {
              ...lot,
              occupied_slots: data.occupied_slots,
              competitive_slots: data.competitive_slots,
              lastUpdate: new Date()
            }
          : lot
      )
    );
    
    // Show live update notification
    toast.success(`Live update: ${data.lot_id} - ${data.occupied_slots} occupied slots`);
  };

  const updateReservationStatus = (data) => {
    setParkingLots(prevLots => 
      prevLots.map(lot => 
        lot.lot_id === data.lot_id 
          ? {
              ...lot,
              reserved_slots: data.reserved_slots,
              competitive_slots: data.competitive_slots
            }
          : lot
      )
    );
  };

  const updateCostPrediction = (data) => {
    setCostPrediction(prev => ({
      ...prev,
      costs: {
        ...prev?.costs,
        [data.lot_id]: data.newCost
      }
    }));
  };

  const handleOptimizationUpdate = (data) => {
    toast.success('System optimization completed!');
    fetchParkingLots();
  };

  const updateRealTimeStats = () => {
    const stats = parkingLots.reduce((acc, lot) => {
      acc.totalSlots += lot.total_slots;
      acc.occupiedSlots += lot.occupied_slots;
      acc.reservedSlots += lot.reserved_slots;
      acc.availableSlots += lot.competitive_slots;
      return acc;
    }, { totalSlots: 0, occupiedSlots: 0, reservedSlots: 0, availableSlots: 0 });

    const utilizationRate = stats.totalSlots > 0 ? 
      ((stats.occupiedSlots + stats.reservedSlots) / stats.totalSlots) * 100 : 0;

    setRealTimeStats({
      ...stats,
      utilizationRate: Math.round(utilizationRate),
      lastUpdate: new Date()
    });
  };

  const fetchParkingLots = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/parking-lots`);
      const data = await response.json();
      setParkingLots(data);
      updateRealTimeStats();
    } catch (error) {
      console.error('Error fetching parking lots:', error);
      toast.error('Failed to load parking lots');
    }
  };

  const fetchUserReservations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reservations/user_001`);
      const data = await response.json();
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const predictCost = async () => {
    if (!currentLocation || !destination) {
      toast.error('Please set both current location and destination');
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
      setSelectedLot(data.optimal_lot);
      toast.success('Cost prediction completed!');
    } catch (error) {
      console.error('Error predicting cost:', error);
      toast.error('Failed to predict parking cost');
    } finally {
      setLoading(false);
    }
  };

  const makeReservation = async (lotId) => {
    setReservationLoading(true);
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
        fetchUserReservations();
        fetchParkingLots();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error making reservation:', error);
      toast.error('Failed to make reservation');
    } finally {
      setReservationLoading(false);
    }
  };

  const getSlotStatusColor = (status) => {
    switch (status) {
      case 'free': return 'slot-free';
      case 'occupied': return 'slot-occupied';
      case 'reserved': return 'slot-reserved';
      default: return 'slot-free';
    }
  };

  const getSlotStatusIcon = (status) => {
    switch (status) {
      case 'free': return <CheckCircle className="h-3 w-3" />;
      case 'occupied': return <AlertCircle className="h-3 w-3" />;
      case 'reserved': return <Clock className="h-3 w-3" />;
      default: return <CheckCircle className="h-3 w-3" />;
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected': return <WifiOff className="h-4 w-4 text-red-500" />;
      default: return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  // Handle reservation from map
  const handleMapReservation = (reservation) => {
    toast.success('Reservation made successfully!');
    fetchUserReservations();
    fetchParkingLots();
  };

  // Handle lot selection from map
  const handleMapLotSelect = (lot) => {
    setSelectedLot(lot);
    if (destination) {
      predictCost();
    }
  };

  // Handle location selection from map
  const handleMapLocationSelect = (location) => {
    setDestination(location);
    toast.success('Destination set! Click on a parking lot to see cost prediction.');
  };

  // If map view is selected, render MapView component
  if (viewMode === 'map') {
    return (
      <MapView
        parkingLots={parkingLots}
        currentLocation={currentLocation}
        destination={destination}
        onLotSelect={handleMapLotSelect}
        onReservation={handleMapReservation}
        onLocationSelect={handleMapLocationSelect}
        selectedLot={selectedLot}
        liveUpdates={liveUpdates}
        connectionStatus={connectionStatus}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Live Stats */}
      <div className="gradient-bg text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              Smart Parking System
            </h1>
            <p className="text-xl text-blue-100 mb-6">
              AI-Powered Parking with Competition-Aware Reservation
            </p>
            
            {/* Live Connection Status */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div className="flex items-center space-x-2">
                {getConnectionStatusIcon()}
                <span className="text-sm">
                  {connectionStatus === 'connected' ? 'Live Updates' : 
                   connectionStatus === 'connecting' ? 'Connecting...' : 
                   'Offline Mode'}
                </span>
              </div>
              <button
                onClick={() => setLiveUpdates(!liveUpdates)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  liveUpdates 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-500 text-white'
                }`}
              >
                {liveUpdates ? 'Live ON' : 'Live OFF'}
              </button>
              
              {/* View Toggle Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-500 text-white'
                  }`}
                >
                  <Grid3X3 className="h-3 w-3 inline mr-1" />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    viewMode === 'map' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-500 text-white'
                  }`}
                >
                  <Map className="h-3 w-3 inline mr-1" />
                  Map
                </button>
              </div>
            </div>
            
            {/* Real-time Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold">{realTimeStats.totalSlots}</div>
                <div className="text-sm text-blue-200">Total Slots</div>
                <div className="text-xs text-blue-300">
                  Updated: {realTimeStats.lastUpdate.toLocaleTimeString()}
                </div>
              </div>
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{realTimeStats.availableSlots}</div>
                <div className="text-sm text-blue-200">Available</div>
                <div className="flex items-center text-xs text-green-300">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Live
                </div>
              </div>
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">{realTimeStats.reservedSlots}</div>
                <div className="text-sm text-blue-200">Reserved</div>
                <div className="flex items-center text-xs text-yellow-300">
                  <Activity className="h-3 w-3 mr-1" />
                  Active
                </div>
              </div>
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold text-red-400">{realTimeStats.utilizationRate}%</div>
                <div className="text-sm text-blue-200">Utilization</div>
                <div className="flex items-center text-xs text-red-300">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {realTimeStats.utilizationRate > 80 ? 'High' : 'Normal'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Location & Prediction */}
          <div className="lg:col-span-1 space-y-6">
            {/* Location Input */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                Set Locations
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Latitude"
                      className="input-field"
                      value={currentLocation.lat}
                      onChange={(e) => setCurrentLocation({...currentLocation, lat: parseFloat(e.target.value)})}
                    />
                    <input
                      type="number"
                      placeholder="Longitude"
                      className="input-field"
                      value={currentLocation.lng}
                      onChange={(e) => setCurrentLocation({...currentLocation, lng: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Latitude"
                      className="input-field"
                      value={destination.lat}
                      onChange={(e) => setDestination({...destination, lat: parseFloat(e.target.value)})}
                    />
                    <input
                      type="number"
                      placeholder="Longitude"
                      className="input-field"
                      value={destination.lng}
                      onChange={(e) => setDestination({...destination, lng: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <button
                  onClick={predictCost}
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Predict Optimal Parking
                </button>
              </div>
            </div>

            {/* Cost Prediction Results */}
            {costPrediction && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-green-600" />
                  Recommended Parking
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="font-semibold text-green-800 mb-2">
                      {parkingLots.find(lot => lot.lot_id === costPrediction.optimal_lot)?.name}
                    </div>
                    <div className="text-sm text-green-700">
                      Estimated Cost: ${costPrediction.recommendation.estimated_cost.toFixed(2)}
                    </div>
                    <div className="text-sm text-green-700">
                      Success Probability: {(costPrediction.recommendation.success_probability * 100).toFixed(1)}%
                    </div>
                  </div>

                  <button
                    onClick={() => makeReservation(costPrediction.optimal_lot)}
                    disabled={reservationLoading}
                    className="w-full btn-success flex items-center justify-center"
                  >
                    {reservationLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Car className="h-4 w-4 mr-2" />
                    )}
                    Reserve Now
                  </button>
                </div>
              </div>
            )}

            {/* Active Reservations */}
            {reservations.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-purple-600" />
                  Active Reservations
                </h3>
                
                <div className="space-y-3">
                  {reservations.filter(r => r.status === 'active').map((reservation) => (
                    <div key={reservation.reservation_id} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="font-medium text-purple-800">
                        {parkingLots.find(lot => lot.lot_id === reservation.lot_id)?.name}
                      </div>
                      <div className="text-sm text-purple-700">
                        Slot: {reservation.slot_id}
                      </div>
                      <div className="text-sm text-purple-700">
                        Cost: ${reservation.cost.toFixed(2)}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        QR: {reservation.qr_code}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Parking Lots */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Available Parking Lots
              </h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchParkingLots}
                  className="btn-secondary flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className={`w-2 h-2 rounded-full ${
                    liveUpdates ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span>{liveUpdates ? 'Live Updates' : 'Static Mode'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {parkingLots.map((lot) => (
                <div key={lot.lot_id} className="card hover:shadow-xl transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {lot.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {lot.location.lat.toFixed(4)}, {lot.location.lng.toFixed(4)}
                      </p>
                      {lot.lastUpdate && (
                        <p className="text-xs text-gray-500">
                          Updated: {new Date(lot.lastUpdate).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className={`status-indicator ${
                      (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.8 
                        ? 'status-occupied' 
                        : (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.5 
                        ? 'status-reserved' 
                        : 'status-free'
                    }`}>
                      {Math.round((lot.occupied_slots + lot.reserved_slots) / lot.total_slots * 100)}% Full
                    </div>
                  </div>

                  {/* Parking Slots Visualization */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Parking Slots ({lot.total_slots} total)
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: lot.total_slots }, (_, i) => {
                        let status = 'free';
                        if (i < lot.occupied_slots) status = 'occupied';
                        else if (i < lot.occupied_slots + lot.reserved_slots) status = 'reserved';
                        
                        return (
                          <div
                            key={i}
                            className={`parking-slot ${getSlotStatusColor(status)} ${
                              lot.lastUpdate ? 'animate-pulse' : ''
                            }`}
                            title={`Slot ${i + 1} - ${status}`}
                          >
                            {getSlotStatusIcon(status)}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lot Statistics */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {lot.competitive_slots}
                      </div>
                      <div className="text-xs text-gray-600">Available</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-600">
                        {lot.reserved_slots}
                      </div>
                      <div className="text-xs text-gray-600">Reserved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {lot.occupied_slots}
                      </div>
                      <div className="text-xs text-gray-600">Occupied</div>
                    </div>
                  </div>

                  {/* Cost Information */}
                  {costPrediction && costPrediction.costs[lot.lot_id] && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Estimated Cost Breakdown
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Driving: {costPrediction.costs[lot.lot_id].driving_time.toFixed(1)}min</div>
                        <div>Walking: {costPrediction.costs[lot.lot_id].walking_time.toFixed(1)}min</div>
                        <div>Waiting: {costPrediction.costs[lot.lot_id].waiting_time.toFixed(1)}min</div>
                        <div className="font-semibold">
                          Total: ${costPrediction.costs[lot.lot_id].total_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => makeReservation(lot.lot_id)}
                      disabled={reservationLoading || lot.competitive_slots === 0}
                      className="flex-1 btn-primary text-sm"
                    >
                      Reserve Slot
                    </button>
                    <button className="btn-secondary text-sm">
                      <Navigation className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;