import React, { useEffect, useState } from "react";
import { Clock, MapPin, CreditCard, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MyReservations() {
  const [activeReservation, setActiveReservation] = useState(null);
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const active = JSON.parse(localStorage.getItem("active_reservation"));
    const hist = JSON.parse(localStorage.getItem("reservation_history")) || [];
    setActiveReservation(active);
    setHistory(hist.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const handleDelete = (id) => {
    const updated = history.filter((r) => r.reservation_id !== id);
    setHistory(updated);
    localStorage.setItem("reservation_history", JSON.stringify(updated));
  };

  const clearAll = () => {
    localStorage.removeItem("reservation_history");
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-xl p-6">
        <button
          onClick={() => navigate("/")}
          className="text-blue-600 hover:underline mb-4 text-sm"
        >
          ← Back to Dashboard
        </button>

        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          My Reservation History
        </h2>

        {/* ✅ Active Reservation */}
        {activeReservation ? (
          <div className="border border-green-300 bg-green-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">
              🟢 Active Reservation
            </h3>
            <p className="text-sm text-gray-800">
              <MapPin className="inline h-4 w-4 mr-1 text-blue-600" />
              Lot: {activeReservation.lot_name}
            </p>
            <p className="text-sm text-gray-600">
              <Clock className="inline h-4 w-4 mr-1 text-yellow-500" />
              Slot: {activeReservation.slot_id}
            </p>
            <p className="text-sm text-gray-600">
              <CreditCard className="inline h-4 w-4 mr-1 text-green-600" />
              Cost: ₹{activeReservation.cost.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              ID: {activeReservation.reservation_id}
            </p>
          </div>
        ) : (
          <p className="text-gray-600 italic mb-4 text-center">
            No active reservation.
          </p>
        )}

        {/* 🕓 Reservation History */}
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Past Reservations
        </h3>
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            😔 No past reservations found.
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((r) => (
              <div
                key={r.reservation_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-800 font-semibold">
                      <MapPin className="inline h-4 w-4 mr-1 text-blue-600" />
                      Lot: {r.lot_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <Clock className="inline h-3 w-3 mr-1 text-yellow-500" />
                      Slot: {r.slot_id}
                    </p>
                    <p className="text-sm text-gray-600">
                      <CreditCard className="inline h-3 w-3 mr-1 text-green-500" />
                      Cost: ₹{(r.cost || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Status:{" "}
                      <span className="font-medium text-gray-700">
                        {r.status?.toUpperCase() || "COMPLETED"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      ID: {r.reservation_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.reservation_id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete reservation"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md font-medium transition"
          >
            Clear All History
          </button>
        )}
      </div>
    </div>
  );
}
