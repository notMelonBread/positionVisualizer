# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**重要**: このリポジトリで作業する際は常に英語で思考し、日本語で回答してください (Always think in English but respond in Japanese when working in this repository).

## Project Overview

PedanticLeverController is a system for monitoring and controlling lever-based input devices. The project consists of two main components:

1. **LeverAPI**: A Backend For Frontend (BFF) API server that provides a unified interface for discovering, monitoring, and managing lever devices.

2. **LeverFirmware**: Embedded firmware for physical lever devices using potentiometers, providing value normalization, calibration, and communication capabilities.

## Build and Run Commands

### LeverAPI (Python)

```bash
# Install dependencies
cd LeverAPI
pip install -r requirements.txt

# Run API server
python app.py  # Server runs on http://0.0.0.0:5000

# Run test UI (separate terminal)
cd LeverAPI/test_ui
python test_app.py  # Test UI runs on http://0.0.0.0:5001
```

### LeverFirmware (C++/Arduino)

```bash
# Using PlatformIO (recommended)
cd LeverFirmware

# Build firmware
platformio run

# Upload firmware to device
platformio run --target upload

# Monitor serial output
platformio device monitor

# Run unit tests
platformio test -e native

# Generate test coverage report
platformio test -e test_coverage
```

```bash
# Using Arduino IDE
# 1. Open LeverFirmware/LeverFirmware.ino in Arduino IDE
# 2. Install required libraries: ArduinoJson
# 3. Select board and port
# 4. Click Upload
```

## Architecture Overview

### LeverAPI

- **Backend For Frontend (BFF)** architecture that provides a unified API for client applications
- UDP-based automatic device discovery
- RESTful API with JSON responses
- WebSocket support for real-time data updates
- Simulation mode for testing without physical devices

#### Key Components:
- `api/discovery.py`: Handles UDP device discovery
- `api/device_manager.py`: Manages device connections and state
- `app.py`: Main Flask application with API routes
- `test_ui/`: Simple web interface for testing

### LeverFirmware

- Non-blocking design for real-time response
- Modular architecture with clear separation of concerns
- Abstraction layers for hardware independence

#### Key Components:
- `src/core/`: Core functionality including calibration
- `src/display/`: Display output handling
- `src/communication/`: Serial communication and protocol implementation
- `src/error/`: Error detection and handling

### Communication Protocol

The system uses a standardized protocol for device discovery and data exchange:

1. **Device Discovery**:
   - UDP broadcast to port 4210 with message "DISCOVER_ENCODER"
   - Devices respond with JSON: `{"type":"encoder","id":"[device-id]","ip":"[ip-address]"}`

2. **Data Format**:
   ```json
   {
     "device_id": "lever1",
     "timestamp": 1646916712,
     "data": {
       "raw": 512,
       "smoothed": 500,
       "value": 50,
       "calibrated": true,
       "calib_min": 0,
       "calib_max": 1023
     },
     "status": {
       "error_code": 0
     }
   }
   ```

3. **API Endpoints**:
   - `GET /api/devices`: List detected devices
   - `GET /api/devices/{device_id}/value`: Get specific device value
   - `POST /api/scan`: Trigger device discovery scan
   - `POST /api/simulation/toggle`: Toggle simulation mode
   - `GET /api/values`: Get all device values

## Testing

### LeverAPI Testing

```bash
# No automated tests are currently documented
# Manual testing can be done using the test UI:
cd LeverAPI/test_ui
python test_app.py  # Access at http://0.0.0.0:5001
```

### LeverFirmware Testing

```bash
# Run all unit tests
cd LeverFirmware
platformio test -e native

# Run specific test
platformio test -e native -f test_calibration

# Generate coverage report
platformio test -e test_coverage
# View report at coverage_report/index.html
```

#### Serial Test Harness

```bash
# Interactive mode
python tools/serial_test_harness/serial_test_harness.py --port [PORT]

# Automated test mode
python tools/serial_test_harness/serial_test_harness.py --port [PORT] --auto
```

## Development Workflow

1. **Adding New API Endpoints**:
   - Add new routes in `LeverAPI/app.py`
   - Update API documentation in `LeverAPI/API_DOCUMENTATION.md`

2. **Modifying Firmware**:
   - Make changes to relevant components in `LeverFirmware/src/`
   - Add unit tests in `LeverFirmware/test/`
   - Verify with serial test harness
   - Update firmware version in source code

3. **Testing Coverage Requirements**:
   - Line coverage: 80% minimum
   - Branch coverage: 70% minimum
   - Function coverage: 90% minimum

## Hardware Requirements

- **Microcontroller**: ESP8266/ESP32/Arduino
- **Sensor**: Potentiometer (analog input)
- **Input**: Calibration button (digital input, internal pull-up)
- **Display**: LED display device

### Pin Configuration (ESP8266 Based)

| Function | Pin | Notes |
|----------|-----|-------|
| Potentiometer | A0 | Analog input |
| Calibration Button | D3 | Internal pull-up, pressed=LOW |
| LED Display | Varies by LED configuration | Depends on the specific LED used |