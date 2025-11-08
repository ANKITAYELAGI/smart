#!/bin/bash

# Smart Parking System Setup Script
# This script sets up the complete Smart Parking System

echo "🚗 Smart Parking System Setup"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.8+"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    
    # Check MongoDB
    if ! command -v mongod &> /dev/null; then
        print_warning "MongoDB is not installed. Please install MongoDB 4.4+"
        print_warning "You can use MongoDB Atlas as an alternative"
    fi
    
    print_success "System requirements check completed"
}

# Setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    cd backend
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install requirements
    print_status "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Setup environment file
    if [ ! -f ".env" ]; then
        print_status "Creating environment configuration..."
        cp env.example .env
        print_warning "Please edit backend/.env with your configuration"
    fi
    
    cd ..
    print_success "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    cd frontend
    
    # Install dependencies
    print_status "Installing Node.js dependencies..."
    npm install
    
    # Install Tailwind CSS dependencies
    print_status "Installing Tailwind CSS..."
    npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
    npm install @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
    
    cd ..
    print_success "Frontend setup completed"
}

# Setup IoT simulation
setup_iot() {
    print_status "Setting up IoT simulation..."
    
    cd iot_simulation
    
    # Install requirements
    print_status "Installing IoT simulation dependencies..."
    pip install -r requirements.txt
    
    cd ..
    print_success "IoT simulation setup completed"
}

# Initialize database
init_database() {
    print_status "Initializing database..."
    
    cd backend
    source venv/bin/activate
    
    # Run database initialization
    python database_init.py
    
    cd ..
    print_success "Database initialization completed"
}

# Create startup scripts
create_startup_scripts() {
    print_status "Creating startup scripts..."
    
    # Backend startup script
    cat > start_backend.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Smart Parking Backend..."
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
EOF
    
    # Frontend startup script
    cat > start_frontend.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Smart Parking Frontend..."
cd frontend
npm start
EOF
    
    # IoT simulation startup script
    cat > start_iot.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting IoT Sensor Simulation..."
cd iot_simulation
python sensor_simulator.py
EOF
    
    # Make scripts executable
    chmod +x start_backend.sh start_frontend.sh start_iot.sh
    
    print_success "Startup scripts created"
}

# Create development script
create_dev_script() {
    print_status "Creating development script..."
    
    cat > dev.sh << 'EOF'
#!/bin/bash
echo "🚗 Starting Smart Parking System Development Environment"
echo "========================================================"

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down development environment..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "🚀 Starting backend server..."
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🚀 Starting frontend server..."
cd ../frontend
npm start &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Start IoT simulation (optional)
echo "🚀 Starting IoT simulation..."
cd ../iot_simulation
python sensor_simulator.py &
IOT_PID=$!

echo ""
echo "✅ Smart Parking System is running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "👤 Admin Panel: http://localhost:3000/admin"
echo ""
echo "Demo Credentials:"
echo "  Admin: admin@parking.com / admin123"
echo "  User: user@parking.com / user123"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
EOF
    
    chmod +x dev.sh
    print_success "Development script created"
}

# Main setup function
main() {
    print_status "Starting Smart Parking System setup..."
    
    # Check requirements
    check_requirements
    
    # Setup components
    setup_backend
    setup_frontend
    setup_iot
    
    # Initialize database (optional)
    read -p "Do you want to initialize the database now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        init_database
    else
        print_warning "Skipping database initialization. Run 'python backend/database_init.py' later."
    fi
    
    # Create startup scripts
    create_startup_scripts
    create_dev_script
    
    echo ""
    print_success "🎉 Smart Parking System setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Edit backend/.env with your configuration"
    echo "2. Start MongoDB (if using local instance)"
    echo "3. Run './dev.sh' to start the development environment"
    echo ""
    echo "Or start components individually:"
    echo "  Backend: ./start_backend.sh"
    echo "  Frontend: ./start_frontend.sh"
    echo "  IoT Sim: ./start_iot.sh"
    echo ""
    echo "Access points:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
}

# Run main function
main "$@"
