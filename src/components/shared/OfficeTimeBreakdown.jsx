import Card from './Card';
import { formatMinutesAsTime } from '../../utils/time';

export default function OfficeTimeBreakdown({ prediction }) {
  if (!prediction || !prediction.breakdown || !prediction.components) {
    return null;
  }

  const { breakdown, components, officeTime } = prediction;

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">⏱️ Office Time Breakdown</h3>
        <span className="text-2xl font-bold text-amber-700">
          {formatMinutesAsTime(officeTime)}
        </span>
      </div>

      <div className="space-y-3">
        {/* Fixed Office Time */}
        <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">🏢 Fixed Office Time</span>
            <span className="text-lg font-bold text-gray-900">
              {formatMinutesAsTime(components.fixedOfficeTime)}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Clock in, standup, get organized
          </p>
        </div>

        {/* Casing Time */}
        <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">📮 Casing Time</span>
            <span className="text-lg font-bold text-blue-600">
              {formatMinutesAsTime(components.caseTime)}
            </span>
          </div>
          
          <div className="space-y-2 pl-3 border-l-2 border-blue-200">
            {/* Flats */}
            {breakdown.flats && breakdown.flats.pieces > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Flats: <span className="font-semibold">{breakdown.flats.pieces} pcs</span>
                </span>
                <span className="font-semibold text-gray-900">
                  {formatMinutesAsTime(breakdown.flats.time)}
                </span>
              </div>
            )}
            
            {/* Letters */}
            {breakdown.letters && breakdown.letters.pieces > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Letters: <span className="font-semibold">{breakdown.letters.pieces} pcs</span>
                </span>
                <span className="font-semibold text-gray-900">
                  {formatMinutesAsTime(breakdown.letters.time)}
                </span>
              </div>
            )}
            
            {/* SPRs */}
            {breakdown.sprs && breakdown.sprs.pieces > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  SPRs: <span className="font-semibold">{breakdown.sprs.pieces} pcs</span>
                </span>
                <span className="font-semibold text-gray-900">
                  {formatMinutesAsTime(breakdown.sprs.time)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pull Down Time */}
        <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">📤 Pull Down</span>
            <span className="text-lg font-bold text-green-600">
              {formatMinutesAsTime(components.pullDownTime)}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {breakdown.casedMail.totalPieces} pieces total
          </p>
        </div>

        {/* Safety/Training Time (if any) */}
        {components.safetyTalk > 0 && (
          <div className="bg-white/70 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">🎓 Safety/Training</span>
              <span className="text-lg font-bold text-purple-600">
                {formatMinutesAsTime(components.safetyTalk)}
              </span>
            </div>
          </div>
        )}

        {/* DPS Notice */}
        {breakdown.dps && breakdown.dps.pieces > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-700 text-sm">
                ℹ️ <span className="font-semibold">{breakdown.dps.pieces} DPS pieces</span> (pre-sorted, no casing time)
              </span>
            </div>
          </div>
        )}

        {/* Load Truck Time */}
        {prediction.loadTruckTime > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-800">
                🚛 Load Truck: <span className="font-semibold">{breakdown.parcels.count} packages</span>
              </span>
              <span className="font-semibold text-orange-900">
                {formatMinutesAsTime(prediction.loadTruckTime)}
              </span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Included in street time (during 721)
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
