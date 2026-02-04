import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from './Card';
import { formatMinutesAsTime, parseTime, addMinutes } from '../../utils/time';

export default function HowAmIDoingSection({ prediction, startTime = '07:30' }) {
  if (!prediction) {
    return null;
  }

  // Validate prediction has required properties
  if (!prediction.leaveOfficeTime || !prediction.clockOutTime) {
    console.error('[HowAmIDoingSection] Prediction missing required time properties');
    return null;
  }

  // Calculate variance from evaluation (8.5 hours = 510 minutes)
  const evaluationMinutes = 510;
  const predictedWorkMinutes = (prediction.officeTime || 0) + (prediction.streetTime || 0);
  const predictedPmOfficeMinutes = Number(prediction.pmOfficeTime || 0) || 0;
  // "Tour" here means total day time (722 + 721 + 744)
  const predictedTourMinutes = predictedWorkMinutes + predictedPmOfficeMinutes;
  const varianceMinutes = predictedTourMinutes - evaluationMinutes;
  const isOvertime = varianceMinutes > 0;
  const isUndertime = varianceMinutes < -15; // More than 15 min under

  // Format times - use leaveOfficeTime instead of leaveTime
  const leaveTime = prediction.leaveOfficeTime
    ? new Date(prediction.leaveOfficeTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A';

  // Predicted return to PO (end of street): leaveOfficeTime + streetTime
  const returnToPoTime = prediction.leaveOfficeTime
    ? new Date(new Date(prediction.leaveOfficeTime).getTime() + ((prediction.streetTime || 0) * 60000)).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'N/A';

  // End of tour (clock out) = scheduled start time + predicted tour minutes (includes PM office).
  // This should NOT jump around based on when the carrier hits the 721 button.
  let endOfTourTime = 'N/A';
  try {
    const start = parseTime(startTime);
    endOfTourTime = addMinutes(start, predictedTourMinutes).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    endOfTourTime = 'N/A';
  }

  // Keep this available as a "return estimate" debug value (can be influenced by waypoint model).
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
              Predicted tour: {formatMinutesAsTime(predictedTourMinutes)}
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
            <span className="text-sm font-semibold text-gray-700">🚚 Street Time (721)</span>
            <span className="text-lg font-bold text-green-600">{formatMinutesAsTime(prediction.streetTime)}</span>
          </div>
          <div className="text-xs text-gray-600">
            Return to PO: {returnToPoTime}
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-3 border border-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">🕐 End of Tour</span>
            <span className="text-lg font-bold text-purple-600">{endOfTourTime}</span>
          </div>
          {prediction.pmOfficeTime && prediction.pmOfficeTime > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              PM Office (744): {formatMinutesAsTime(prediction.pmOfficeTime)}
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
