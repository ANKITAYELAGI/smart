import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Zap,
  Settings,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Activity,
  Database,
  Cpu,
  Wifi,
  WifiOff,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Gauge,
  Thermometer,
  Battery,
  Signal
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  RadialBarChart,
  RadialBar
} from 'recharts';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState({});
  const [parkingLots, setParkingLots] = useState([]);
  const [optimizationStatus, setOptimizationStatus] = useState('idle');
  const [systemHealth, setSystemHealth] = useState('healthy');
  const [realTimeData, setRealTimeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [iotDevices, setIotDevices] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    cpu: 0,
    memory: 0,
    network: 0,
    temperature: 0
  });

  const wsRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const performanceIntervalRef = useRef(null);

  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    fetchAnalytics();
    fetchParkingLots();
    fetchIotDevices();
    connectWebSocket();
    startRealTimeUpdates();
    startPerformanceMonitoring();
    
    // Set up periodic updates
    updateIntervalRef.current = setInterval(() => {
      if (liveUpdates) {
        fetchAnalytics();
        fetchParkingLots();
        updatePerformanceMetrics();
      }
    }, 5000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
    };
  }, [liveUpdates]);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const fetchParkingLots = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/parking-lots`);
      setParkingLots(response.data);
    } catch (error) {
      console.error('Error fetching parking lots:', error);
      toast.error('Failed to load parking lots');
    }
  };

  const fetchIotDevices = async () => {
    try {
      // Simulate IoT device data
      const devices = [
        { id: 'device_001', name: 'Downtown Plaza Sensors', status: 'online', signal: 85, battery: 92, temperature: 24 },
        { id: 'device_002', name: 'Central Station Sensors', status: 'online', signal: 78, battery: 88, temperature: 26 },
        { id: 'device_003', name: 'Shopping Mall Sensors', status: 'warning', signal: 45, battery: 15, temperature: 32 }
      ];
      setIotDevices(devices);
    } catch (error) {
      console.error('Error fetching IoT devices:', error);
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        toast.success('Admin dashboard connected to live updates');
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
        addNotification('Sensor Update', `Lot ${data.lot_id} updated`, 'info');
        break;
      case 'reservation_update':
        updateReservationStatus(data);
        addNotification('Reservation Update', `New reservation in ${data.lot_id}`, 'success');
        break;
      case 'optimization_update':
        handleOptimizationUpdate(data);
        addNotification('Optimization Complete', 'SA-VNS algorithm finished', 'success');
        break;
      case 'alert':
        addAlert(data.message, data.severity);
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

  const handleOptimizationUpdate = (data) => {
    setOptimizationStatus('completed');
    fetchAnalytics();
    fetchParkingLots();
  };

  const addNotification = (title, message, type) => {
    const notification = {
      id: Date.now(),
      title,
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
  };

  const addAlert = (message, severity) => {
    const alert = {
      id: Date.now(),
      message,
      severity,
      timestamp: new Date()
    };
    setAlerts(prev => [alert, ...prev.slice(0, 4)]);
  };

  const startPerformanceMonitoring = () => {
    performanceIntervalRef.current = setInterval(() => {
      setPerformanceMetrics(prev => ({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 100,
        temperature: 20 + Math.random() * 15
      }));
    }, 2000);
  };

  const updatePerformanceMetrics = () => {
    // Simulate performance updates
    setPerformanceMetrics(prev => ({
      cpu: Math.min(100, prev.cpu + (Math.random() - 0.5) * 10),
      memory: Math.min(100, prev.memory + (Math.random() - 0.5) * 5),
      network: Math.min(100, prev.network + (Math.random() - 0.5) * 15),
      temperature: Math.max(15, Math.min(40, prev.temperature + (Math.random() - 0.5) * 2))
    }));
  };

  const startRealTimeUpdates = () => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setRealTimeData(prev => {
        const newData = {
          timestamp: new Date().toLocaleTimeString(),
          utilization: Math.random() * 100,
          reservations: Math.floor(Math.random() * 10),
          revenue: Math.random() * 1000
        };
        return [...prev.slice(-19), newData];
      });
    }, 2000);

    return () => clearInterval(interval);
  };

  const triggerOptimization = async () => {
    setOptimizationStatus('running');
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/optimize`);
      
      if (response.data.success) {
        toast.success('Optimization completed successfully!');
        setOptimizationStatus('completed');
        fetchAnalytics();
        fetchParkingLots();
      } else {
        throw new Error('Optimization failed');
      }
    } catch (error) {
      console.error('Error triggering optimization:', error);
      toast.error('Failed to trigger optimization');
      setOptimizationStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const retrainModel = async () => {
    setLoading(true);
    try {
      // Simulate model retraining
      await new Promise(resolve => setTimeout(resolve, 3000));
      toast.success('GMM model retrained successfully!');
    } catch (error) {
      toast.error('Failed to retrain model');
    } finally {
      setLoading(false);
    }
  };

  const getSystemHealthColor = (health) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getOptimizationStatusColor = (status) => {
    switch (status) {
      case 'idle': return 'text-gray-600';
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Sample data for charts
  const utilizationData = Object.values(analytics).map(lot => ({
    name: lot.name,
    utilization: Math.round(lot.utilization * 100),
    efficiency: Math.round(lot.efficiency * 100),
    pa_i: Math.round(lot.pa_i * 100),
    rs_i: Math.round(lot.rs_i * 100)
  }));

  const timeSeriesData = realTimeData.length > 0 ? realTimeData : [
    { timestamp: '10:00', utilization: 65, reservations: 8, revenue: 450 },
    { timestamp: '10:30', utilization: 72, reservations: 12, revenue: 520 },
    { timestamp: '11:00', utilization: 68, reservations: 10, revenue: 480 },
    { timestamp: '11:30', utilization: 75, reservations: 15, revenue: 580 },
    { timestamp: '12:00', utilization: 80, reservations: 18, revenue: 620 }
  ];

  const pieData = [
    { name: 'Available', value: parkingLots.reduce((sum, lot) => sum + lot.competitive_slots, 0), color: '#10B981' },
    { name: 'Reserved', value: parkingLots.reduce((sum, lot) => sum + lot.reserved_slots, 0), color: '#F59E0B' },
    { name: 'Occupied', value: parkingLots.reduce((sum, lot) => sum + lot.occupied_slots, 0), color: '#EF4444' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-bg text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Admin Dashboard
              </h1>
              <p className="text-blue-100">
                Smart Parking System Management & Analytics
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="glass-effect rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span className="text-sm">System Health</span>
                </div>
                <div className={`text-lg font-bold ${getSystemHealthColor(systemHealth)}`}>
                  {systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1)}
                </div>
              </div>
              
              <div className="glass-effect rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <span className="text-sm">Optimization</span>
                </div>
                <div className={`text-lg font-bold ${getOptimizationStatusColor(optimizationStatus)}`}>
                  {optimizationStatus.charAt(0).toUpperCase() + optimizationStatus.slice(1)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              <Settings className="h-5 w-5 mr-2 text-blue-600" />
              System Control Panel
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={fetchAnalytics}
                className="btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </button>
              <button
                onClick={retrainModel}
                disabled={loading}
                className="btn-primary flex items-center"
              >
                <Database className="h-4 w-4 mr-2" />
                Retrain GMM Model
              </button>
              <button
                onClick={triggerOptimization}
                disabled={loading || optimizationStatus === 'running'}
                className="btn-success flex items-center"
              >
                {optimizationStatus === 'running' ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {optimizationStatus === 'running' ? 'Running...' : 'Start Optimization'}
              </button>
            </div>
          </div>

          {/* System Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="metric-card metric-card-blue">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">IoT Sensors</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {parkingLots.reduce((sum, lot) => sum + lot.total_slots, 0)}
                  </p>
                </div>
                <Wifi className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2">
                <span className="text-green-600 text-sm font-medium">All Online</span>
              </div>
            </div>

            <div className="metric-card metric-card-green">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Reservations</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {parkingLots.reduce((sum, lot) => sum + lot.reserved_slots, 0)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2">
                <span className="text-green-600 text-sm font-medium">+12% from yesterday</span>
              </div>
            </div>

            <div className="metric-card metric-card-yellow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Utilization</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(analytics).length > 0 
                      ? Math.round(Object.values(analytics).reduce((sum, lot) => sum + lot.utilization, 0) / Object.values(analytics).length * 100)
                      : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="mt-2">
                <span className="text-green-600 text-sm font-medium">+5% from last week</span>
              </div>
            </div>

            <div className="metric-card metric-card-red">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Revenue Today</p>
                  <p className="text-2xl font-bold text-gray-900">$2,450</p>
                </div>
                <Target className="h-8 w-8 text-red-500" />
              </div>
              <div className="mt-2">
                <span className="text-green-600 text-sm font-medium">+18% from yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Real-time Utilization */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              Real-time Utilization
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="utilization" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Parking Distribution */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
              Parking Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Parking Lots Management */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-6 flex items-center">
            <Car className="h-5 w-5 mr-2 text-purple-600" />
            Parking Lots Management
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parking Lot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pa_i
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rs_i
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(analytics).map(([lotId, lot]) => (
                  <tr key={lotId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {lot.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lot.total_slots} slots
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${lot.utilization * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">
                          {Math.round(lot.utilization * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${lot.efficiency * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">
                          {Math.round(lot.efficiency * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.pa_i.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.rs_i.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-indicator ${
                        lot.utilization > 0.8 ? 'status-occupied' :
                        lot.utilization > 0.5 ? 'status-reserved' : 'status-free'
                      }`}>
                        {lot.utilization > 0.8 ? 'High Load' :
                         lot.utilization > 0.5 ? 'Moderate' : 'Available'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        Configure
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        Optimize
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Lot Performance Comparison */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
              Lot Performance
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="utilization" fill="#6366F1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Optimization Parameters */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-yellow-600" />
              Optimization Parameters
            </h3>
            <div className="space-y-4">
              {utilizationData.map((lot) => (
                <div key={lot.name} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    {lot.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Pa_i:</span>
                      <span className="ml-1 font-semibold">{lot.pa_i}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Rs_i:</span>
                      <span className="ml-1 font-semibold">{lot.rs_i}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Alerts */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
              System Alerts
            </h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-yellow-800">
                    High Utilization Warning
                  </div>
                  <div className="text-xs text-yellow-700">
                    Downtown Plaza is at 85% capacity
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-green-800">
                    Optimization Complete
                  </div>
                  <div className="text-xs text-green-700">
                    SA-VNS algorithm finished successfully
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-blue-800">
                    Model Retrained
                  </div>
                  <div className="text-xs text-blue-700">
                    GMM model updated with latest data
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
