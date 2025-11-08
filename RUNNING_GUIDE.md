# 🚗 Smart Parking System - Complete Running Guide

## 📋 Prerequisites Check

Before running the project, ensure you have the following installed:

### Required Software
- **Python 3.8+** - [Download here](https://www.python.org/downloads/)
- **Node.js 16+** - [Download here](https://nodejs.org/)
- **MongoDB 4.4+** - [Download here](https://www.mongodb.com/try/download/community)
- **Git** - [Download here](https://git-scm.com/downloads)

### Verify Installation
```bash
# Check Python
python --version
# Should show Python 3.8 or higher

# Check Node.js
node --version
# Should show v16 or higher

# Check npm
npm --version
# Should show npm version

# Check MongoDB (if using local instance)
mongod --version
# Should show MongoDB version
```

## 🚀 Method 1: Automated Setup (Recommended)

### For Windows Users
```bash
# 1. Open Command Prompt or PowerShell in the project directory
cd C:\Users\gayat\OneDrive\Desktop\smart

# 2. Run the automated setup script
setup.bat

# 3. Follow the prompts and wait for installation to complete
```

### For Linux/Mac Users
```bash
# 1. Open terminal in the project directory
cd /path/to/smart-parking-system

# 2. Make the setup script executable
chmod +x setup.sh

# 3. Run the automated setup script
./setup.sh

# 4. Follow the prompts and wait for installation to complete
```

## 🛠️ Method 2: Manual Setup

### Step 1: Setup Backend
```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Setup environment configuration
copy env.example .env
# Edit .env file with your configuration (optional for development)

# Initialize database
python database_init.py

# Deactivate virtual environment
deactivate
```

### Step 2: Setup Frontend
```bash
# Navigate to frontend directory
cd ../frontend

# Install Node.js dependencies
npm install

# Install Tailwind CSS dependencies
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
npm install @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
```

### Step 3: Setup IoT Simulation (Optional)
```bash
# Navigate to iot_simulation directory
cd ../iot_simulation

# Install Python dependencies
pip install -r requirements.txt
```

## 🎯 Running the Complete System

### Option 1: Start All Services Together

#### Windows
```bash
# Run the development script
dev.bat
```

#### Linux/Mac
```bash
# Run the development script
./dev.sh
```

This will start:
- Backend server on port 8000
- Frontend server on port 3000
- IoT simulation (optional)

### Option 2: Start Services Individually

#### Terminal 1: Start Backend
```bash
cd backend

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Start FastAPI server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2: Start Frontend
```bash
cd frontend

# Start React development server
npm start
```

#### Terminal 3: Start IoT Simulation (Optional)
```bash
cd iot_simulation

# Start sensor simulation
python sensor_simulator.py
```

## 🌐 Access the Application

Once all services are running, you can access:

### Web Interfaces
- **Main Application**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Demo Credentials
- **Admin Login**: 
  - Email: `admin@parking.com`
  - Password: `admin123`
- **User Login**: 
  - Email: `user@parking.com`
  - Password: `user123`

## 🧪 Testing the System

### Run Integration Tests
```bash
cd tests

# Install test dependencies
pip install -r requirements.txt

# Run comprehensive integration tests
python integration_test.py
```

### Manual Testing Steps

1. **Test Backend API**:
   ```bash
   # Health check
   curl http://localhost:8000/health
   
   # Get parking lots
   curl http://localhost:8000/parking-lots
   ```

2. **Test Frontend**:
   - Open http://localhost:3000
   - Login with demo credentials
   - Try making a reservation
   - Check admin dashboard

3. **Test IoT Simulation**:
   - Monitor console output
   - Check sensor data in admin dashboard

## 🔧 Configuration Options

### Environment Variables (backend/.env)
```bash
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=smart_parking

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Optimization Parameters
SA_INITIAL_TEMPERATURE=100.0
SA_COOLING_RATE=0.95
VNS_MAX_ITERATIONS=100

# IoT Configuration
SENSOR_UPDATE_INTERVAL=3
HEARTBEAT_INTERVAL=30
```

### Frontend Configuration
- Modify `frontend/src/contexts/AuthContext.js` for authentication
- Update API endpoints in components if needed
- Customize Tailwind CSS in `tailwind.config.js`

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. Backend Not Starting
```bash
# Check if port 8000 is available
netstat -an | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# Check Python dependencies
pip list

# Check MongoDB connection
mongosh --eval "db.runCommand('ping')"
```

#### 2. Frontend Not Loading
```bash
# Check if port 3000 is available
netstat -an | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### 3. Database Connection Issues
```bash
# Start MongoDB service
# Windows:
net start MongoDB
# Linux/Mac:
sudo systemctl start mongod

# Check MongoDB status
mongosh --eval "db.runCommand('ping')"
```

#### 4. IoT Simulation Errors
```bash
# Check Python dependencies
pip install requests

# Verify backend is running
curl http://localhost:8000/health
```

### Log Locations
- **Backend Logs**: Console output or `logs/smart_parking.log`
- **Frontend Logs**: Browser console (F12)
- **IoT Logs**: Console output
- **Database Logs**: MongoDB log files

## 📊 System Monitoring

### Check System Status
```bash
# Backend health
curl http://localhost:8000/health

# API endpoints
curl http://localhost:8000/parking-lots
curl http://localhost:8000/analytics

# Frontend accessibility
curl http://localhost:3000
```

### Performance Monitoring
- **Backend**: Check response times in API docs
- **Frontend**: Use browser dev tools
- **Database**: Monitor MongoDB metrics
- **IoT**: Check sensor data frequency

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Production Setup
```bash
# Backend with Gunicorn
cd backend
source venv/bin/activate
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend build
cd frontend
npm run build
# Serve with nginx or similar web server
```

## 📱 Mobile Testing

### Responsive Design
- Test on different screen sizes
- Use browser dev tools device simulation
- Test touch interactions

### Mobile App Integration
- API endpoints are mobile-ready
- WebSocket support for real-time updates
- RESTful API design

## 🔄 Development Workflow

### Making Changes
1. **Backend Changes**: Server auto-reloads with `--reload` flag
2. **Frontend Changes**: Hot reload enabled by default
3. **Database Changes**: Restart backend after schema changes
4. **IoT Changes**: Restart simulation script

### Code Quality
```bash
# Backend linting
cd backend
flake8 .
black .

# Frontend linting
cd frontend
npm run lint
```

## 📞 Support

### Getting Help
- Check the console output for error messages
- Review the API documentation at http://localhost:8000/docs
- Check the README.md for detailed information
- Run integration tests to verify system health

### Common Commands Reference
```bash
# Start all services
./dev.sh                    # Linux/Mac
dev.bat                     # Windows

# Start individual services
cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm start
cd iot_simulation && python sensor_simulator.py

# Run tests
cd tests && python integration_test.py

# Database operations
cd backend && python database_init.py
```

---

**🎉 Your Smart Parking System is now ready to use!**

**Access Points:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Admin: http://localhost:3000/admin
