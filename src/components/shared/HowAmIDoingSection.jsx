import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from './Card';
import { formatMinutesAsTime } from '../../utils/time';

export default function HowAmIDoingSection({ prediction }) {
  console.log('[HowAmIDoingSection] Component rendered with prediction:', prediction);
  
  if (!prediction) {
    console.log('[HowAmIDoingSection] No prediction provided, returning null');
    return null;
  }

  // Validate prediction has required properties
  if (!prediction.leaveTime || !prediction.returnTime || !prediction.clockOutTime) {
    console.error('[HowAmIDoingSection] Prediction missing required time properties:', {
      hasLeaveTime: !!prediction.leaveTime,
      hasReturnTime: !!prediction.returnTime,
      hasClockOutTime: !!prediction.clockOutTime
    });
  }

  console.log('[HowAmIDoingSection] Rendering prediction card');

  // Calculate variance from evaluation (8.5 hours = 510 minutes)
  const evaluationMinutes = 510;
  const predictedTotalMinutes = prediction.officeTime + prediction.streetTime;
  const varianceMinutes = predictedTotalMinutes - evaluationMinutes;
  const isOvertime = varianceMinutes > 0;
  const isUndertime = varianceMinutes < -15; // More than 15 min under

  // Format times
  const leaveTime = prediction.leaveTime
    ? new Date(prediction.leaveTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A';

  const returnTime = prediction.returnTime
    ? new Date(prediction.returnTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A';

  const clockOutTime = prediction.clockOutTime
    ? new Date(prediction.clockOutTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A';

  return (
    <Card className={`border-2 ${
      isOvertime
        ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
        : isUndertime
        ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300'
        : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">📊 Today's Prediction</h3>
        {isOvertime && <TrendingUp className="text-red-600" size={24} />}
        {isUndertime && <TrendingDown className="text-blue-600" size={24} />}
        {!isOvertime && !isUndertime && <Minus className="text-green-600" size={24} />}
      </div>

      {/* Status Banner */}
      <div className={`mb-4 rounded-lg p-3 border-2 ${
        isOvertime
          ? 'bg-red-100 border-red-400'
          : isUndertime
          ? 'bg-blue-100 border-blue-400'
          : 'bg-green-100 border-green-400'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-bold text-sm ${
              isOvertime
                ? 'text-red-900'
                : isUndertime
                ? 'text-blue-900'
                : 'text-green-900'
            }`}>
              {isOvertime && `⚠️ ${formatMinutesAsTime(Math.abs(varianceMinutes))} Over Evaluation`}
              {isUndertime && `✅ ${formatMinutesAsTime(Math.abs(varianceMinutes))} Under Evaluation`}
              {!isOvertime && !isUndertime && '✅ On Schedule'}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              Predicted tour: {formatMinutesAsTime(predictedTotalMinutes)}
            </p>
          </div>
          <Clock className="text-gray-600" size={20} />
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="space-y-3">
        <div className="bg-white/70 rounded-lg p-3 border border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">🏢 Leave Office</span>
            <span className="text-lg font-bold text-blue-600">{leaveTime}</span>
          </div>
          <div className="text-xs text-gray-600">
            Office time: {formatMinutesAsTime(prediction.officeTime)}
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-3 border border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">🚚 Street Time</span>
            <span className="text-lg font-bold text-green-600">{formatMinutesAsTime(prediction.streetTime)}</span>
          </div>
          <div className="text-xs text-gray-600">
            Predicted return: {returnTime}
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-3 border border-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">🕐 Clock Out</span>
            <span className="text-lg font-bold text-purple-600">{clockOutTime}</span>
          </div>
          {prediction.pmOfficeTime > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              PM Office: {formatMinutesAsTime(prediction.pmOfficeTime)}
            </div>
          )}
        </div>
      </div>

      {/* Overtime Warning */}
      {isOvertime && varianceMinutes > 30 && (
        <div className="mt-4 bg-amber-50 border border-amber-300 rounded-lg p-3">
          <p className="text-xs text-amber-800 font-semibold">
            ⚠️ Route may need inspection under Article 34
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Consistently exceeding 8 hours qualifies for special route inspection
          </p>
        </div>
      )}
    </Card>
  );
}
