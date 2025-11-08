import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Clock, CreditCard } from "lucide-react";

const ReservationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ✅ Read last reservation details safely
  const reservation = JSON.parse(localStorage.getItem("last_reservation") || "{}");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="card max-w-md w-full p-6 shadow-lg bg-white rounded-xl">
        
        {/* ✅ React Router back navigation (keeps dashboard state) */}
        <button
          onClick={() => {
            sessionStorage.setItem("from_internal_nav", "true"); // mark it as internal navigation
            navigate(-1);
          }}
          className="flex items-center text-blue-600 mb-4 hover:underline"
        >
          ← Back to Dashboard
        </button>

        <h2 className="text-2xl font-bold mb-4 text-gray-900">
          Reservation Details
        </h2>

        <div className="space-y-3 text-gray-700">
          <p>
            <MapPin className="inline h-4 w-4 mr-1" /> 
            <strong>Lot:</strong> {reservation.lot_name || "Unknown Lot"}
          </p>

          <p>
            <Clock className="inline h-4 w-4 mr-1" /> 
            <strong>Slot:</strong> {reservation.slot_id || "Auto-assigned"}
          </p>

          <p>
            <CreditCard className="inline h-4 w-4 mr-1" /> 
            <strong>Cost:</strong> ₹{(reservation.cost || 30).toFixed(2)}
          </p>

          <p><strong>Status:</strong> Active</p>

          <div className="mt-4 border-t pt-3 text-sm text-gray-500">
            Reservation ID: {id}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetails;
