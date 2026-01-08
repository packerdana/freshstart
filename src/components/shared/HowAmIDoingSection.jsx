import { useEffect, useMemo, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
import Card from './Card';
import Input from './Input';
import useRouteStore from '../../stores/routeStore';
import { predictWaypointTimes, calculateProgressStatus } from '../../services/waypointPredictionService';
import { estimatePackageSplit, getPackageEstimationMessage } from '../../services/packageEstimationService';

export default function HowAmIDoingSection() {
  const { todayInputs, updateTodayInputs, waypoints, getCurrentRouteConfig, history, currentRouteId } = useRouteStore();
  const [progressStatus, setProgressStatus] = useState(null);

  const scannerTotal = todayInputs.scannerTotal || 0;
  const parcels = todayInputs.parcels || 0;
  const sprs = todayInputs.sprs || 0;
  const packagesManuallyUpdated = todayInputs.packagesManuallyUpdated || false;
  const routeConfig = getCurrentRouteConfig();

  const estimation = useMemo(() => {
    if (!scannerTotal) return null;
    return estimatePackageSplit(scannerTotal, history);
  }, [scannerTotal, history]);

  useEffect(() => {
    async function loadProgressStatus() {
      if (!waypoints || waypoints.length === 0 || !currentRouteId) {
        setProgressStatus(null);
        return;
      }

      const leaveOfficeTime = todayInputs.leaveOfficeTime || routeConfig?.startTime || '07:30';

      try {
        const predictions = await predictWaypointTimes(waypoints, leaveOfficeTime, currentRouteId);
        const status = calculateProgressStatus(waypoints, predictions, new Date().toISOString());
        setProgressStatus(status);
      } catch (error) {
        console.error('[HowAmIDoing] Error loading progress status:', error);
        setProgressStatus(null);
      }
    }

    loadProgressStatus();
  }, [waypoints, currentRouteId, todayInputs.leaveOfficeTime, routeConfig]);

  useEffect(() => {
    if (estimation && !packagesManuallyUpdated) {
      updateTodayInputs({
        parcels: estimation.parcels,
        sprs: estimation.sprs
      });
    }
  }, [estimation, packagesManuallyUpdated, updateTodayInputs]);

  const handleScannerTotalChange = (e) => {
    const value = e.target.value;
    const numValue = value === '' ? 0 : parseInt(value);

    if (!isNaN(numValue) && numValue >= 0) {
      updateTodayInputs({
        scannerTotal: numValue,
        packagesManuallyUpdated: false
      });
    }
  };

  const handleParcelsChange = (e) => {
    const value = e.target.value;
    const numValue = value === '' ? 0 : parseInt(value);

    if (!isNaN(numValue) && numValue >= 0) {
      const newSprs = Math.max(0, scannerTotal - numValue);
      updateTodayInputs({
        parcels: numValue,
        sprs: newSprs,
        packagesManuallyUpdated: true
      });
    }
  };

  const handleSprsChange = (e) => {
    const value = e.target.value;
    const numValue = value === '' ? 0 : parseInt(value);

    if (!isNaN(numValue) && numValue >= 0) {
      const newParcels = Math.max(0, scannerTotal - numValue);
      updateTodayInputs({
        sprs: numValue,
        parcels: newParcels,
        packagesManuallyUpdated: true
      });
    }
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Package Tracking</h3>
        <Package className="text-green-600" size={24} />
      </div>

      {progressStatus && (
        <div className={`mb-4 rounded-lg p-4 border-2 ${
          progressStatus.status === 'ahead'
            ? 'bg-blue-50 border-blue-300'
            : progressStatus.status === 'behind'
            ? 'bg-amber-50 border-amber-300'
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {progressStatus.status === 'ahead' && <TrendingUp className="text-blue-600" size={20} />}
              {progressStatus.status === 'behind' && <TrendingDown className="text-amber-600" size={20} />}
              {progressStatus.status === 'on-schedule' && <Minus className="text-gray-600" size={20} />}
              <span className={`font-semibold ${
                progressStatus.status === 'ahead'
                  ? 'text-blue-700'
                  : progressStatus.status === 'behind'
                  ? 'text-amber-700'
                  : 'text-gray-700'
              }`}>
                {progressStatus.message}
              </span>
            </div>
            <Clock className="text-gray-500" size={18} />
          </div>
          {progressStatus.lastWaypoint && (
            <p className="text-xs text-gray-600 mt-2">
              Last waypoint: {progressStatus.lastWaypoint}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Input
            label='📱 Scanner Total ("How Am I Doing" → Pkgs Remaining)'
            type="number"
            value={scannerTotal || ''}
            onChange={handleScannerTotalChange}
            placeholder="103"
            min="0"
            inputMode="numeric"
            className="text-lg font-semibold"
          />
          <p className="text-xs text-gray-500 mt-1">
            Check your scanner for total packages
          </p>
        </div>

        {estimation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium">
              {getPackageEstimationMessage(estimation)}
            </p>
          </div>
        )}

        {scannerTotal > 0 && (
          <div className="bg-white/70 rounded-lg p-4 border-2 border-gray-300 space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Package Breakdown {packagesManuallyUpdated && '(Manual)'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Parcels
                </label>
                <input
                  type="number"
                  value={parcels || ''}
                  onChange={handleParcelsChange}
                  placeholder="43"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  SPRs
                </label>
                <input
                  type="number"
                  value={sprs || ''}
                  onChange={handleSprsChange}
                  placeholder="60"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              💡 Adjust these counts when loading truck for accuracy
            </p>

            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-lg font-bold text-gray-900">{scannerTotal}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Parcels</p>
                <p className="text-lg font-bold text-blue-600">{parcels}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">SPRs</p>
                <p className="text-lg font-bold text-green-600">{sprs}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
