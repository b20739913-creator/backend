import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { apiService, EnhancedDevice, HierarchyNode, AlarmStatistics } from '../services/api';
import { Activity, Wifi, Power, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon issue
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface DynamicMapProps {
  selectedHierarchy?: HierarchyNode | null;
  selectedDevice?: EnhancedDevice | null;
}

// Custom marker icons with status and alarm indicators
const createDeviceIcon = (status: 'Online' | 'Offline', hasAlarms: boolean, deviceType: string) => {
  const statusColor = status === 'Online' ? '#10B981' : '#EF4444';
  const alarmColor = '#F59E0B';
  
  const svgIcon = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${statusColor}" flood-opacity="0.6"/>
        </filter>
      </defs>
      <circle cx="16" cy="16" r="10" fill="${statusColor}" stroke="white" stroke-width="2" filter="url(#glow)"/>
      ${hasAlarms ? `<circle cx="24" cy="8" r="6" fill="${alarmColor}" stroke="white" stroke-width="1"/>` : ''}
      <text x="16" y="20" text-anchor="middle" fill="white" font-size="8" font-weight="bold">
        ${deviceType === 'MPFM' ? 'M' : deviceType === 'Pressure Sensor' ? 'P' : deviceType === 'Temperature Sensor' ? 'T' : deviceType === 'Flow Meter' ? 'F' : 'D'}
      </text>
    </svg>
  `;
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to fit map bounds to devices
const FitBounds: React.FC<{
  devices: EnhancedDevice[];
  padding?: number;
}> = ({ devices, padding = 50 }) => {
  const map = useMap();

  useEffect(() => {
    const validDevices = devices.filter(
      device => 
        device.location?.latitude && 
        device.location?.longitude &&
        !isNaN(device.location.latitude) &&
        !isNaN(device.location.longitude)
    );

    if (validDevices.length === 0) return;

    if (validDevices.length === 1) {
      // Single device - center on it
      const device = validDevices[0];
      map.setView([device.location.latitude!, device.location.longitude!], 12);
    } else {
      // Multiple devices - fit bounds
      const bounds = validDevices.map(device => [
        device.location.latitude!,
        device.location.longitude!
      ] as [number, number]);
      
      try {
        map.fitBounds(bounds, { padding: [padding, padding] });
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [map, devices, padding]);

  return null;
};

const DynamicMap: React.FC<DynamicMapProps> = ({ selectedHierarchy, selectedDevice }) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<EnhancedDevice[]>([]);
  const [alarmStats, setAlarmStats] = useState<AlarmStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  // Load devices based on selected hierarchy
  useEffect(() => {
    loadDevicesForMap();
  }, [selectedHierarchy, selectedDevice]);

  const loadDevicesForMap = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let devicesResponse;
      let alarmsResponse;

      if (selectedHierarchy) {
        // Load devices for specific hierarchy
        devicesResponse = await apiService.getDevicesByHierarchy(
          Number(selectedHierarchy.id),
          localStorage.getItem('token') || ''
        );
        
        // Load alarm statistics for this hierarchy
        alarmsResponse = await apiService.getAlarmDashboard(
          localStorage.getItem('token') || '',
          { hierarchy_id: Number(selectedHierarchy.id) }
        );
      } else {
        // Load all devices for user's company
        devicesResponse = await apiService.getAllDevicesEnhanced(
          localStorage.getItem('token') || ''
        );
        
        // Load alarm statistics for entire company
        alarmsResponse = await apiService.getAlarmDashboard(
          localStorage.getItem('token') || ''
        );
      }

      if (devicesResponse.success && devicesResponse.data) {
        setDevices(devicesResponse.data.devices);
      }

      if (alarmsResponse.success && alarmsResponse.data) {
        setAlarmStats(alarmsResponse.data.statistics);
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter devices with valid coordinates
  const validDevices = useMemo(() => {
    return devices.filter(device => 
      device.location?.latitude && 
      device.location?.longitude &&
      !isNaN(device.location.latitude) &&
      !isNaN(device.location.longitude)
    );
  }, [devices]);

  // Calculate map statistics
  const mapStats = useMemo(() => {
    const totalDevices = validDevices.length;
    const onlineDevices = validDevices.filter(d => d.status === 'Online').length;
    const offlineDevices = totalDevices - onlineDevices;
    const activeAlarms = alarmStats?.active || 0;

    return {
      totalDevices,
      onlineDevices,
      offlineDevices,
      activeAlarms
    };
  }, [validDevices, alarmStats]);

  // Default center (Saudi Arabia)
  const defaultCenter: [number, number] = [24.7136, 46.6753];

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedHierarchy ? `${selectedHierarchy.name} - Device Locations` : 'All Device Locations'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time device positions and status monitoring
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Alarms</span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Map */}
        <div className="flex-1 relative h-96">
          {validDevices.length > 0 ? (
            <MapContainer
              center={defaultCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              className="z-10"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              
              <FitBounds devices={validDevices} />

              {validDevices.map((device) => (
                <Marker
                  key={device.deviceId}
                  position={[device.location.latitude!, device.location.longitude!]}
                  icon={createDeviceIcon(device.status, false, device.deviceName)} // TODO: Add alarm check
                >
                  <Popup>
                    <div className="p-3 min-w-[250px]">
                      <div className="font-semibold text-lg mb-2 text-gray-900">
                        {device.deviceSerial}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{device.deviceName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-medium">{device.wellName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={`font-medium ${
                            device.status === 'Online' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {device.status}
                          </span>
                        </div>
                        {device.lastCommTime && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Comm:</span>
                            <span className="font-medium">
                              {new Date(device.lastCommTime).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {device.flowData && (
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Latest Readings:</div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div>GFR: {device.flowData.gfr.toFixed(1)}</div>
                              <div>OFR: {device.flowData.ofr.toFixed(1)}</div>
                              <div>WFR: {device.flowData.wfr.toFixed(1)}</div>
                              <div>P: {device.flowData.pressure.toFixed(1)} bar</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center">
                <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Device Locations</h3>
                <p className="text-gray-600">
                  {selectedHierarchy 
                    ? 'No devices with location data found for this hierarchy'
                    : 'No devices with location data found'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Panel */}
        <div className="w-80 bg-gray-50 p-6 border-l border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedHierarchy ? selectedHierarchy.name : 'Company Overview'}
          </h3>
          
          <div className="space-y-4">
            {/* Total Devices */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    {mapStats.totalDevices}
                  </div>
                  <div className="text-sm text-gray-600">Total Devices</div>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            {/* Online Devices */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {mapStats.onlineDevices}
                  </div>
                  <div className="text-sm text-gray-600">Online</div>
                </div>
                <Wifi className="h-6 w-6 text-green-500" />
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Online Rate</span>
                  <span>
                    {mapStats.totalDevices > 0 
                      ? Math.round((mapStats.onlineDevices / mapStats.totalDevices) * 100)
                      : 0
                    }%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div 
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${mapStats.totalDevices > 0 
                        ? (mapStats.onlineDevices / mapStats.totalDevices) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Offline Devices */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {mapStats.offlineDevices}
                  </div>
                  <div className="text-sm text-gray-600">Offline</div>
                </div>
                <Power className="h-6 w-6 text-red-500" />
              </div>
            </div>

            {/* Active Alarms */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {mapStats.activeAlarms}
                  </div>
                  <div className="text-sm text-gray-600">Active Alarms</div>
                </div>
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
            </div>

            {/* Device Types Breakdown */}
            {validDevices.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Device Types</h4>
                <div className="space-y-2">
                  {Object.entries(
                    validDevices.reduce((acc, device) => {
                      acc[device.deviceName] = (acc[device.deviceName] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-gray-600">{type}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location Info */}
            {selectedHierarchy && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Location</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Name:</span>
                    <span className="font-medium text-blue-900">{selectedHierarchy.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Level:</span>
                    <span className="font-medium text-blue-900">{selectedHierarchy.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Devices:</span>
                    <span className="font-medium text-blue-900">{validDevices.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicMap;