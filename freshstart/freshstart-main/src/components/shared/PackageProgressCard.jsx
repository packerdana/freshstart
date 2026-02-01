import { Package } from 'lucide-react';
import Card from './Card';
import Input from './Input';
import useRouteStore from '../../stores/routeStore';

export default function PackageProgressCard() {
  const { todayInputs, updateTodayInputs } = useRouteStore();

  const scannerTotal = todayInputs.scannerTotal || 0;
  const parcels = todayInputs.parcels || 0;
  const sprs = todayInputs.sprs || 0;
  const totalPackages = parcels + sprs;

  const packagesRemaining = scannerTotal;
  const packagesDelivered = Math.max(0, totalPackages - packagesRemaining);
  const percentageDelivered = totalPackages > 0 ? (packagesDelivered / totalPackages) * 100 : 0;

  const handlePackagesRemainingUpdate = (e) => {
    const value = e.target.value;
    const numValue = value === '' ? 0 : parseInt(value);

    if (!isNaN(numValue) && numValue >= 0) {
      updateTodayInputs({ scannerTotal: numValue });
    }
  };

  if (totalPackages === 0) {
    return null;
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-600">
          Package Progress
        </span>
        <Package className="text-blue-600" size={20} />
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold text-blue-600 font-mono">
          {packagesRemaining}
        </span>
        <span className="text-gray-500 text-lg">/ {totalPackages}</span>
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${percentageDelivered}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>{packagesDelivered} delivered</span>
        <span>{Math.round(percentageDelivered)}%</span>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Update Remaining Count
        </label>
        <Input
          type="number"
          value={packagesRemaining || ''}
          onChange={handlePackagesRemainingUpdate}
          placeholder="Check scanner"
          min="0"
          inputMode="numeric"
          className="text-center font-semibold"
        />
        <p className="text-xs text-gray-500 mt-1 text-center">
          Check "How Am I Doing" on scanner
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-center bg-gray-50 rounded-lg p-2">
        <div>
          <p className="text-xs text-gray-600">Parcels</p>
          <p className="text-sm font-bold text-blue-600">{parcels}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">SPRs</p>
          <p className="text-sm font-bold text-green-600">{sprs}</p>
        </div>
      </div>
    </Card>
  );
}
