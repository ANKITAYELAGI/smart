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
import { useNavigate } from "react-router-dom";
import LogoutButton from "./LogoutButton";


// 🔁 Reverse geocoding helper (Google Maps API)
// 🔁 Reverse geocoding helper (OpenStreetMap - 100% Free)
async function getReadableAddress(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const data = await response.json();

    if (data && data.display_name) {
      return data.display_name; // ✅ return human-readable address
    } else {
      return "Unknown location";
    }
  } catch (error) {
    console.error("Error fetching address:", error);
    return "Unknown location";
  }
}

const UserDashboard = () => {
  const [currentLocation, setCurrentLocation] = useState({
    name: "Detecting...",
    lat: 12.9716,
    lng: 77.5946
  });
  const [destination, setDestination] = useState(null);
  // 🧹 Immediately clear destination and old dashboard data on full page reload
// ✅ Distinguish between reload and normal back navigation
// ✅ Distinguish between reload and normal back navigation
// Detect page reload vs internal navigation
useEffect(() => {
  const navEntry = performance.getEntriesByType("navigation")[0];
  const isReload = navEntry?.type === "reload";
  const fromInternal = sessionStorage.getItem("from_internal_nav");

  if (isReload && !fromInternal) {
    console.log("🔁 Hard reload detected — clearing dashboard state...");
    localStorage.removeItem("dashboard_state");
    localStorage.removeItem("reservations");
    setDestination(null);
    setSelectedLot(null);
    setCostPrediction(null);
    setHasActiveReservation(false);
  } else {
    console.log("↩️ Internal navigation detected — keeping dashboard state.");
  }

  // Reset session flag after using it
  sessionStorage.removeItem("from_internal_nav");
}, []);




// Always reset the flag after check
sessionStorage.removeItem("from_internal_nav");



  const [isDestinationLocked, setIsDestinationLocked] = useState(false); 
  const [parkingLots, setParkingLots] = useState([]);
  const isDestinationLockedRef = useRef(false);
  
  useEffect(() => {
    isDestinationLockedRef.current = isDestinationLocked;
  }, [isDestinationLocked]);

  const [loading, setLoading] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [costPrediction, setCostPrediction] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const destinationInputRef = useRef(null);
  const navigate = useNavigate();


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
  // ✅ Restore saved dashboard state (after redirect or reload)
useEffect(() => {
  const savedState = localStorage.getItem("dashboard_state");
  if (!savedState) return;

  try {
    const parsed = JSON.parse(savedState);
    const stateAge = Date.now() - (parsed.timestamp || 0);
    const isExpired = stateAge > 1000 * 60 * 30; // 30 minutes

    if (parsed.hasActiveReservation && !isExpired && parsed.destination) {
      console.log("✅ Restoring dashboard from localStorage...");
      if (parsed.currentLocation) setCurrentLocation(parsed.currentLocation);
      if (parsed.destination) setDestination(parsed.destination);
      if (parsed.costPrediction) setCostPrediction(parsed.costPrediction);
      if (parsed.selectedLot) setSelectedLot(parsed.selectedLot);
      setHasActiveReservation(true);
    } else {
      console.log("🧹 Clearing old dashboard data (no active reservation)");
      localStorage.removeItem("dashboard_state");
      setHasActiveReservation(false);
      setCostPrediction(null);
      setSelectedLot(null);
      setDestination(null);
    }
  } catch (err) {
    console.error("⚠️ Failed to restore dashboard state:", err);
    localStorage.removeItem("dashboard_state");
  }

  // 🧹 If no active reservation, always reset destination
  //if (!localStorage.getItem("dashboard_state")) {
    //setDestination(null);
  //}

}, []);



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

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => initAutocomplete();
      document.body.appendChild(script);
    } else {
      initAutocomplete();
    }

    function initAutocomplete() {
      if (!destinationInputRef.current) return;
      const autocomplete = new window.google.maps.places.Autocomplete(destinationInputRef.current);
      autocomplete.setFields(['geometry', 'formatted_address']);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const { lat, lng } = place.geometry.location;
          setDestination({ lat: lat(), lng: lng() });
          toast.success(`Destination set: ${place.formatted_address}`);
        } else {
          toast.error('No location details available');
        }
      });
    }
  }, []);

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
        const existing = reservations.some(r => r.reservation_id === data.reservation_id);
        setParkingLots(prev =>
          prev.map(l =>
            l.lot_id === data.lot_id
              ? {
                  ...l,
                  reserved_slots: data.accepted ? (l.reserved_slots || 0) + 1 : l.reserved_slots,
                  competitive_slots: Math.max((l.competitive_slots || 0) - (data.accepted ? 1 : 0), 0)
                }
              : l
          )
        );
       if (!existing && data.accepted) {
  const newRes = {
    reservation_id: data.reservation_id,
    lot_id: data.lot_id,
    slot_id: null,
    cost: costPrediction?.recommendation?.estimated_cost || 0,
    status: "active",
    qr_code: "QR-" + Math.floor(Math.random() * 999999),
     timestamp: new Date().toISOString(),
  };

  const allHistory = JSON.parse(localStorage.getItem("reservations_history") || "[]");
localStorage.setItem("reservations_history", JSON.stringify([...allHistory, newRes]));

  setReservations(prev => [...(Array.isArray(prev) ? prev : []), newRes]);
  // 🔕 No toast here (frontend already handled it)
  setHasActiveReservation(true);
}
 else if (!existing && !data.accepted) {
          // optional: toast.error(`Reservation attempt failed for ${data.lot_id}`);
        }
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

  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error("❌ Geolocation not supported in this browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("📡 GPS Update:", latitude, longitude);

        try {
          const address = await getReadableAddress(latitude, longitude);
          setCurrentLocation((prev) => {
            const distanceMoved =
              Math.abs(prev.lat - latitude) > 0.0001 ||
              Math.abs(prev.lng - longitude) > 0.0001;
            if (distanceMoved) {
              toast.dismiss();
              toast.success(`📍 Moved to ${address}`);
              return { lat: latitude, lng: longitude, name: address };
            }
            return prev;
          });
        } catch (error) {
          console.error("⚠️ Reverse geocoding failed:", error);
        }
      },
      (error) => {
        console.error("❌ Geolocation failed:", error);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
  };
    // ✅ Sync reservation updates with live grid
  const updateReservationStatus = (data) => {
    setParkingLots((prevLots) =>
      prevLots.map((lot) =>
        lot.lot_id === data.lot_id
          ? {
              ...lot,
              reserved_slots:
                data.status === "accepted"
                  ? (lot.reserved_slots || 0) + 1
                  : lot.reserved_slots,
              competitive_slots:
                data.status === "accepted"
                  ? Math.max((lot.competitive_slots || 0) - 1, 0)
                  : lot.competitive_slots,
            }
          : lot
      )
    );

    if (data.status === "accepted") {
      toast.success(`🅿️ Reservation confirmed at ${data.lot_id}`);
    } else {
      toast.error(`🚫 Reservation failed at ${data.lot_id}`);
    }
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
  if (!Array.isArray(parkingLots)) {
    console.warn("⚠️ parkingLots is not an array:", parkingLots);
    return;
  }

  const stats = parkingLots.reduce(
    (acc, lot) => {
      acc.totalSlots += lot.total_slots || 0;
      acc.occupiedSlots += lot.occupied_slots || 0;
      acc.reservedSlots += lot.reserved_slots || 0;
      acc.availableSlots += lot.competitive_slots || 0;
      return acc;
    },
    { totalSlots: 0, occupiedSlots: 0, reservedSlots: 0, availableSlots: 0 }
  );

  const utilizationRate =
    stats.totalSlots > 0
      ? ((stats.occupiedSlots + stats.reservedSlots) / stats.totalSlots) * 100
      : 0;

  setRealTimeStats({
    ...stats,
    utilizationRate: Math.round(utilizationRate),
    lastUpdate: new Date(),
  });
};


  const fetchParkingLots = async () => {
    try {
      const response = await fetch("http://localhost:8000/parking-lots");
      const data = await response.json();
   if (Array.isArray(data.lots)) {
  setParkingLots(data.lots);
  console.log("✅ Parking lots loaded:", data.lots);
} else {
  console.warn("⚠️ Invalid parking lot data format:", data);
  setParkingLots([]); // fallback
}

    } catch (error) {
      console.error("❌ Failed to fetch parking lots:", error);
    }
  };

  const fetchUserReservations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reservations/user_001`);
      const data = await response.json();
      setReservations(Array.isArray(data) ? data : []);
      const hasActive = Array.isArray(data) && data.some(r => r.status === "active");
      setHasActiveReservation(!!hasActive);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setReservations([]);
    }
  };

  const predictCost = async () => {
    if (!currentLocation || !destination) {
      toast.error("Please set both current location and destination before predicting.");
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        user_id: "user_001",
        current_location: currentLocation,
        destination: destination,
        arrival_time: new Date().toISOString(),
        duration: 120,
      };

      const response = await fetch(`${API_BASE_URL}/predict-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok && data?.optimal_lot) {
        setCostPrediction(data);
        setSelectedLot(parkingLots.find((l) => l.lot_id === data.optimal_lot) || null);

        toast.success(`🎯 Best parking: ${
          parkingLots.find((l) => l.lot_id === data.optimal_lot)?.name || "Found"
        }`);
        return;
      }

      console.warn("⚠️ Backend returned no suitable lot, using frontend fallback...");

      if (parkingLots.length > 0) {
        const R = 6371;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const distance = (lat1, lon1, lat2, lon2) => {
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const scoredLots = parkingLots.map((lot) => {
          const dist = distance(
            destination.lat,
            destination.lng,
            lot.location.lat,
            lot.location.lng
          );
          const utilization =
            (lot.occupied_slots + lot.reserved_slots) / lot.total_slots;
          const availabilityScore = 1 - utilization;
          const distanceScore = Math.max(0, 1 - dist / 5);
          const totalScore = 0.6 * availabilityScore + 0.4 * distanceScore;
          return { ...lot, dist, totalScore };
        });

        const optimalLot = scoredLots
          .filter((l) => l.dist < 6 && l.competitive_slots > 0)
          .sort((a, b) => b.totalScore - a.totalScore)[0];

        if (optimalLot) {
          const estimatedCost = 30 + optimalLot.dist * 4;
          const waitingTime = Math.round(
            Math.max(2, (optimalLot.utilization || 0.5) * 10)
          );

          const simulatedPrediction = {
            recommendation: {
              estimated_cost: estimatedCost,
              success_probability: 1 - (optimalLot.utilization || 0.5),
              waiting_time: waitingTime,
            },
            optimal_lot: optimalLot.lot_id,
          };

          setCostPrediction(simulatedPrediction);
          setSelectedLot(optimalLot);
          setIsDestinationLocked(true);
          isDestinationLockedRef.current = true;

          if (!isDestinationLockedRef.current) {
            setDestination({
              name: optimalLot.name,
              lat: optimalLot.location.lat,
              lng: optimalLot.location.lng,
            });
            console.log("📍 Destination auto-set to optimal lot");
          } else {
            console.log("🔒 Destination locked — not modifying user’s chosen destination");
          }

          toast.success(`✅ Closest available: ${optimalLot.name}`);
        } else {
          toast.error("🚫 No nearby lot available even in fallback check.");
        }
      } else {
        toast.error("No parking lot data loaded. Please refresh.");
      }
    } catch (error) {
      console.error("Error predicting cost:", error);
      toast.error("⚠️ Prediction failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Reservation flow (first attempt -> optional manual second attempt -> fallback)
  // -----------------------

  const makeReservation = async (lotId, slotNumber = null) => {
    if (!lotId) {
      toast.error("No parking lot selected for reservation.");
      return;
    }

    if (hasActiveReservation) {
      toast("You already have an active reservation.");
      return;
    }

    if (reservationLoading) {
      toast("Reservation already in progress...");
      return;
    }

    setReservationLoading(true);

    try {
      const lot = parkingLots.find((l) => l.lot_id === lotId);
      if (!lot) {
        toast.error("Selected parking lot not found.");
        setReservationLoading(false);
        return;
      }

      const firstResp = await fetch(`${API_BASE_URL}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parking_lot_id: lotId, first_request: true }),
      });
      const firstData = await firstResp.json();

      if (firstData.status === "accepted" || firstData.status === "pending") {
        finalizeReservation(lotId, slotNumber, lot, firstData.reservation_id);
        return;
      }

      // ❌ First failed — ask for retry manually
      toast.custom((t) => (
        <div className="p-4 bg-white border border-blue-300 rounded-lg shadow-md w-80">
          <p className="font-semibold text-gray-800 mb-2">Retry Reservation?</p>
          <p className="text-sm text-gray-600 mb-3">
            The first attempt failed. Would you like to try CRPark’s second-chance allocation?
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setReservationLoading(false);
                const alt = findBestAlternateLotsCRPark(1)[0];
                                if (alt) {
                  toast((t2) => (
                    <div className="p-3 bg-white border border-blue-400 rounded-md shadow-md w-64">
                      <p className="font-semibold text-gray-800 mb-1">Try nearby: {alt.name}</p>
                      <p className="text-xs text-gray-600 mb-2">Distance: {alt.dist.toFixed(2)} km</p>
                      <button
                        className="w-full bg-blue-600 text-white rounded-md py-1 text-xs hover:bg-blue-700"
                        onClick={() => {
                          toast.dismiss(t2.id);
                          makeReservation(alt.lot_id);
                        }}
                      >
                        Reserve in {alt.name}
                      </button>
                    </div>
                  ));
                } else {
                  toast.error("🚫 No nearby parking available right now.");
                }
              }}
              className="px-3 py-1 text-xs bg-gray-200 rounded"
            >
              No
            </button>

            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const retryToast = toast.loading("🔁 Retrying second chance...");
                try {
                  const retryResp = await fetch(`${API_BASE_URL}/api/reserve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ parking_lot_id: lotId, first_request: false }),
                  });
                  const retryData = await retryResp.json();
                  toast.dismiss(retryToast);

                  if (retryData.status === "accepted") {
                    finalizeReservation(lotId, slotNumber, lot);
                  } else {
                    toast.error("🚫 Second-chance failed. Searching for best alternate lots...");

                    // 🧠 Multi-factor CRPark-based alternate selection
                    const bestAlternates = findBestAlternateLotsCRPark(3);

                    if (bestAlternates.length > 0) {
                      const best = bestAlternates[0];

                      // ✅ Update recommendation card
                      setSelectedLot(best);
                      setCostPrediction({
                        optimal_lot: best.lot_id,
                        recommendation: {
                          estimated_cost: best.cost,
                          success_probability: best.availability,
                          waiting_time: best.waiting
                        }
                      });

                      toast.success(`🔄 Alternate suggested: ${best.name} (₹${best.cost.toFixed(2)})`);

                      // Auto-suggest and allow user to confirm
                      toast((t2) => (
                        <div className="p-3 bg-white border border-blue-400 rounded-md shadow-md w-64">
                          <p className="font-semibold text-gray-800 mb-1">Try {best.name}?</p>
                          <p className="text-xs text-gray-600 mb-2">
                            Distance: {best.dist.toFixed(2)} km<br />
                            Cost: ₹{best.cost.toFixed(2)}<br />
                            Success: {(best.availability * 100).toFixed(1)}%
                          </p>
                          <button
                            className="w-full bg-green-600 text-white rounded-md py-1 text-xs hover:bg-green-700"
                            onClick={() => {
                              toast.dismiss(t2.id);
                              makeReservation(best.lot_id);
                            }}
                          >
                            Reserve in {best.name}
                          </button>
                        </div>
                      ), { duration: 9000 });
                    } else {
                      toast.error("🚫 No suitable alternate lots available nearby.");
                    }
                  }
                } catch (err) {
                  toast.dismiss(retryToast);
                  toast.error("Retry failed. Please try again.");
                } finally {
                  setReservationLoading(false);
                }
              }}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
            >
              Yes
            </button>
          </div>
        </div>
      ));
    } catch (err) {
      console.error("Reservation flow error:", err);
      toast.error("Reservation failed. Please try again.");
      setReservationLoading(false);
    }
  };

  // ✅ Confirmed reservation finalization
  // ✅ Confirmed reservation finalization (single-toast + redirect)
const finalizeReservation = (lotId, slotNumber, lot, reservation_id = null) => {
  const resId = reservation_id || `resv-${Date.now()}`;

  // ✅ Create a clean reservation object
  const newRes = {
    reservation_id: resId,
    lot_id: lotId,
    lot_name: lot.name,
    slot_id: slotNumber || (lot.reserved_slots + 1),
    cost: costPrediction?.recommendation?.estimated_cost || 0,
    status: "active",
    qr_code: "QR-" + Math.floor(Math.random() * 999999),
    timestamp: Date.now(),
  };

  // ✅ Move previous active reservation (if any) into history
  const oldActive = JSON.parse(localStorage.getItem("active_reservation"));
  const history = JSON.parse(localStorage.getItem("reservation_history")) || [];

  if (oldActive) {
    oldActive.status = "completed"; // or “past”
    localStorage.setItem("reservation_history", JSON.stringify([...history, oldActive]));
  }

  // ✅ Save this new one as active
  localStorage.setItem("active_reservation", JSON.stringify(newRes));

  // ✅ Also keep unified all-history log
  const allHistory = [...history, newRes];
  localStorage.setItem("reservation_history", JSON.stringify(allHistory));

  // ✅ Update React state for immediate UI feedback
  setReservations(allHistory);
  setHasActiveReservation(true);
  setReservationLoading(false);

  // ✅ Update parking slots locally
  setParkingLots((prevLots) =>
    prevLots.map((l) =>
      l.lot_id === lotId
        ? {
            ...l,
            reserved_slots: (l.reserved_slots || 0) + 1,
            competitive_slots: Math.max((l.competitive_slots || 0) - 1, 0),
          }
        : l
    )
  );

  // ✅ Save for Reservation Details page
  localStorage.setItem("last_reservation", JSON.stringify(newRes));

  // ✅ Save dashboard snapshot
  localStorage.setItem(
    "dashboard_state",
    JSON.stringify({
      currentLocation,
      destination,
      costPrediction,
      selectedLot,
      hasActiveReservation: true,
      timestamp: Date.now(),
    })
  );

  toast.dismiss();
  toast.success(`🅿️ Reservation confirmed at ${lot.name}`);

  // ✅ Redirect after confirmation
  setTimeout(() => {
    sessionStorage.setItem("from_internal_nav", "true");
    navigate(`/reservation/${resId}`);
  }, 1500);
};

  // ✅ CRPark-inspired multi-factor scoring
  // only one instance defined safely
  const findBestAlternateLotsCRPark = (count = 3) => {
    if (!destination || parkingLots.length === 0) return [];

    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const distance = (lat1, lon1, lat2, lon2) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const weights = { distance: 0.25, availability: 0.3, cost: 0.2, waiting: 0.15, competition: 0.1 };

    return parkingLots
      .filter((l) => l.total_slots > (l.occupied_slots || 0) + (l.reserved_slots || 0))
      .map((l) => {
        const dist = distance(destination.lat, destination.lng, l.location.lat, l.location.lng);
        const utilization = (l.occupied_slots + l.reserved_slots) / l.total_slots;
        const availability = 1 - utilization;
        const waiting = Math.max(1, utilization * 10);
        const cost = 25 + dist * 3 + utilization * 10;
        const competition = l.competitive_slots > 0 ? 1 / l.competitive_slots : 1;

        const total_score =
          weights.distance * Math.max(0, 1 - dist / 5) +
          weights.availability * availability +
          weights.cost * Math.max(0, 1 - cost / 100) +
          weights.waiting * Math.max(0, 1 - waiting / 10) +
          weights.competition * Math.max(0, 1 - competition);

        return { ...l, dist, availability, cost, waiting, competition, total_score };
      })
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, count);
  };

  // ✅ Legacy compatibility wrapper
  const findNearestAvailableLot = (currentLotId) => {
    const currentLot = parkingLots.find((l) => l.lot_id === currentLotId);
    if (!currentLot || !destination) return null;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const distance = (lat1, lon1, lat2, lon2) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const nearby = parkingLots
      .filter(
        (l) =>
          l.lot_id !== currentLotId &&
          l.competitive_slots > 0 &&
          l.total_slots > (l.occupied_slots || 0) + (l.reserved_slots || 0)
      )
      .map((l) => ({
        ...l,
        dist: distance(
          currentLot.location.lat,
          currentLot.location.lng,
          l.location.lat,
          l.location.lng
        ),
      }))
      .sort((a, b) => a.dist - b.dist);

    return nearby.length > 0 ? nearby[0] : null;
  };

  // ✅ Slot and icon helpers
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

  const handleMapReservation = (reservation) => {
    toast.success('Reservation made successfully!');
    fetchUserReservations();
    fetchParkingLots();
  };
    // Handle lot selection from map (MapView -> parent)
  const handleMapLotSelect = (lot) => {
    setSelectedLot(lot);
    if (destination) {
      predictCost();
    }
    toast.success(`Selected parking lot: ${lot.name}`);
  };

  // Handle reservation event coming from MapView
  const handleReservation = (reservation) => {
    toast.success('Reservation confirmed!');
    fetchUserReservations();
  };

  // When user clicks on map to set current/destination location
  const handleMapLocationSelect = async (location, type) => {
    try {
      // if location doesn't have a name, reverse geocode
      let address = location.name;
      if (!address) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`
        );
        const data = await res.json();
        address = data?.display_name || 'Unknown location';
      }

      const fullLocation = { ...location, name: address };

      if (type === 'current') {
        setCurrentLocation(fullLocation);
        toast.success(`📍 Current Location updated: ${address}`);
      } else if (type === 'destination') {
        setDestination(fullLocation);
        setIsDestinationLocked(true);
        isDestinationLockedRef.current = true;
        toast.success(`🎯 Destination set: ${address}`);
      }
    } catch (err) {
      console.error('Location update error:', err);
      toast.error('⚠️ Could not set location');
    }
  };

  // If map view selected, render MapView (pass handlers down)
  if (viewMode === 'map') {
    return (
      <MapView
        parkingLots={parkingLots}
        currentLocation={currentLocation}
        destination={destination}
        onLotSelect={handleMapLotSelect}
        onReservation={handleReservation}
        onCurrentLocationSelect={(loc) => handleMapLocationSelect(loc, 'current')}
        onDestinationSelect={(loc) => handleMapLocationSelect(loc, 'destination')}
        liveUpdates={liveUpdates}
        connectionStatus={connectionStatus}
        onBack={() => setViewMode('grid')}
      />
    );
  }

  // ---------- UI: Grid view (main) ----------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Live Stats */}
      <div className="gradient-bg text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Smart Parking System</h1>
            

            {/* Live Connection Status */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div className="flex items-center space-x-2">
                {getConnectionStatusIcon()}
                <span className="text-sm">
                  {connectionStatus === 'connected'
                    ? 'Live Updates'
                    : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Offline Mode'}
                </span>
              </div>
              <button
                onClick={() => setLiveUpdates(!liveUpdates)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  liveUpdates ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                }`}
              >
                {liveUpdates ? 'Live ON' : 'Live OFF'}
              </button>

              {/* View toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                  }`}
                >
                  <Grid3X3 className="h-3 w-3 inline mr-1" /> Grid
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    viewMode === 'map' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                  }`}
                >
                  <Map className="h-3 w-3 inline mr-1" /> Map
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
                  <TrendingUp className="h-3 w-3 mr-1" /> Live
                </div>
              </div>
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">{realTimeStats.reservedSlots}</div>
                <div className="text-sm text-blue-200">Reserved</div>
                <div className="flex items-center text-xs text-yellow-300">
                  <Activity className="h-3 w-3 mr-1" /> Active
                </div>
              </div>
              <div className="glass-effect rounded-lg p-4">
                <div className="text-2xl font-bold text-red-400">{realTimeStats.utilizationRate}%</div>
                <div className="text-sm text-blue-200">Utilization</div>
                <div className="flex items-center text-xs text-red-300">
                  <TrendingDown className="h-3 w-3 mr-1" /> {realTimeStats.utilizationRate > 80 ? 'High' : 'Normal'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-blue-600" /> Set Locations
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Location (Auto-detected)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input type="text" className="input-field bg-gray-100" value={currentLocation?.name || 'Detecting...'} readOnly />
                    <button
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            async (pos) => {
                              const { latitude, longitude } = pos.coords;
                              try {
                                const response = await fetch(
                                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
                                );
                                const data = await response.json();
                                let address = 'Unknown location';
                                if (data.results && data.results[0]) {
                                  address = data.results[0].formatted_address;
                                }
                                setCurrentLocation({ lat: latitude, lng: longitude, name: address });
                                toast.success(`📍 Location updated: ${address}`);
                              } catch (err) {
                                console.error('Geocoding failed:', err);
                                toast.error('⚠️ Error fetching location name');
                              }
                            },
                            (err) => {
                              toast.error('❌ Unable to detect live location');
                              console.error(err);
                            }
                          );
                        } else {
                          toast.error('❌ Geolocation not supported in this browser');
                        }
                      }}
                      className="bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700 transition"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination (Click on Map to Set)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none cursor-pointer hover:border-blue-500 transition"
                    value={destination?.name || 'Click here to open map and set destination'}
                    readOnly
                    onClick={() => {
                      toast('🗺️ Redirecting to map — click to set destination');
                      setViewMode('map');
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Tip: Click above to open the map and select your destination</p>
                </div>

                <button
                  onClick={() => {
                    setDestination(null);
                    setIsDestinationLocked(false);
                    isDestinationLockedRef.current = false;
                    toast('🗺️ Destination cleared — you can set a new one');
                  }}
                  className="text-xs text-red-500 mt-1 hover:text-red-700"
                >
                  Clear Destination
                </button>

                <button onClick={predictCost} disabled={loading} className="w-full btn-primary flex items-center justify-center">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Predict Optimal Parking
                </button>
              </div>
            </div>

            {/* Cost prediction */}
            {costPrediction && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-green-600" /> Recommended Parking
                </h3>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="font-semibold text-green-800 mb-2">
                      {parkingLots.find((lot) => lot.lot_id === costPrediction.optimal_lot)?.name}
                    </div>
                    <div className="text-sm text-green-700">
                      Estimated Cost: ₹
                      {costPrediction?.recommendation?.estimated_cost ? costPrediction.recommendation.estimated_cost.toFixed(2) : 'N/A'}
                    </div>
                    <div className="text-sm text-green-700">
                      Success Probability:{' '}
                      {costPrediction?.recommendation?.success_probability
                        ? (costPrediction.recommendation.success_probability * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-green-700">
                      Estimated Waiting Time:{' '}
                      {costPrediction?.recommendation?.waiting_time ? `${costPrediction.recommendation.waiting_time} min` : 'N/A'}
                    </div>
                  </div>

                  <button
                    onClick={() => makeReservation(costPrediction.optimal_lot)}
                    disabled={reservationLoading || hasActiveReservation}
                    className="w-full btn-success flex items-center justify-center"
                  >
                    {hasActiveReservation ? 'Reservation Active' : reservationLoading ? 'Processing...' : 'Reserve Now'}
                  </button>
                </div>
              </div>
            )}

            {/* Active reservations */}
            {reservations.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-purple-600" /> Active Reservations
                </h3>

                <div className="space-y-3">
                  {reservations.filter((r) => r.status === 'active').map((reservation) => (
                    <div key={reservation.reservation_id} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="font-medium text-purple-800">
                        {parkingLots.find((lot) => lot.lot_id === reservation.lot_id)?.name}
                      </div>
                      <div className="text-sm text-purple-700">Slot: {reservation.slot_id}</div>
                      <div className="text-sm text-purple-700">Cost: ₹{(reservation.cost || 0).toFixed(2)}</div>
                      <div className="text-xs text-purple-600 mt-1">QR: {reservation.qr_code}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - grid/list + selected lot */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Available Parking Lots</h2>
              <div className="flex items-center space-x-3">
                <button onClick={fetchParkingLots} className="btn-secondary flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </button>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className={`w-2 h-2 rounded-full ${liveUpdates ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span>{liveUpdates ? 'Live Updates' : 'Static Mode'}</span>
                </div>
              </div>
            </div>

            {!selectedLot ? (
              <div className="space-y-4">
                {parkingLots.map((lot) => (
                  <div
                    key={lot.lot_id}
                    onClick={() => setSelectedLot(lot)}
                    className="cursor-pointer border border-gray-200 p-4 rounded-lg hover:bg-blue-50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{lot.name}</h3>
                        <p className="text-sm text-gray-500">
                          {lot.location.lat.toFixed(4)}, {lot.location.lng.toFixed(4)}
                        </p>
                      </div>
                      <div
                        className={`text-sm px-2 py-1 rounded-full ${
                          (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.8
                            ? 'bg-red-100 text-red-600'
                            : (lot.occupied_slots + lot.reserved_slots) / lot.total_slots > 0.5
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-green-100 text-green-600'
                        }`}
                      >
                        {Math.round(((lot.occupied_slots + lot.reserved_slots) / lot.total_slots) * 100)}% Full
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card">
                <button onClick={() => setSelectedLot(null)} className="text-blue-600 text-sm mb-4 hover:underline flex items-center">
                  ← Back to Locations
                </button>

                <h3 className="text-xl font-semibold text-gray-900 mb-2">{selectedLot.name}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {selectedLot.location.lat.toFixed(4)}, {selectedLot.location.lng.toFixed(4)}
                </p>

                <div className="grid grid-cols-10 gap-1 mb-4">
                  {Array.from({ length: selectedLot.total_slots }, (_, i) => {
                    let status = 'free';
                    if (i < selectedLot.occupied_slots) status = 'occupied';
                    else if (i < selectedLot.occupied_slots + selectedLot.reserved_slots) status = 'reserved';

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (hasActiveReservation) {
                            toast('You already have an active reservation.');
                            return;
                          }
                          if (status === 'free') {
                            makeReservation(selectedLot.lot_id, i + 1);
                          } else {
                            toast.error(`Slot ${i + 1} is ${status}`);
                          }
                        }}
                        className={`parking-slot ${getSlotStatusColor(status)} ${
                          status === 'free' ? 'cursor-pointer hover:scale-105 transition' : 'opacity-60 cursor-not-allowed'
                        }`}
                        title={`Slot ${i + 1} - ${status}`}
                      >
                        {getSlotStatusIcon(status)}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{selectedLot.competitive_slots}</div>
                    <div className="text-xs text-gray-600">Available</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-600">{selectedLot.reserved_slots}</div>
                    <div className="text-xs text-gray-600">Reserved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{selectedLot.occupied_slots}</div>
                    <div className="text-xs text-gray-600">Occupied</div>
                  </div>
                </div>

                <button
                  onClick={() => makeReservation(selectedLot.lot_id)}
                  disabled={reservationLoading || selectedLot.competitive_slots === 0}
                  className="w-full btn-primary text-sm"
                >
                  Reserve Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;



