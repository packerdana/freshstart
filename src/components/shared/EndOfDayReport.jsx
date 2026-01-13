import { CheckCircle, Package, Clock, Calendar, AlertCircle, FileText, TrendingUp, Target } from 'lucide-react';
import { formatMinutesAsTime } from '../../utils/time';
import { calculatePercentToStandard } from '../../utils/percentToStandard';
import Card from './Card';
import Button from './Button';

export default function EndOfDayReport({ reportData, onClose }) {
  const {
    date,
    routeNumber,
    mailVolumes,
    predictedOfficeTime,
    actualOfficeTime,
    officeTime722,
    officeTime744,
    predictedStreetTime,
    actualStreetTime,
    evaluatedStreetTime,
    predictedClockOut,
    actualClockOut,
    officeTime,
    pmOfficeTime,
    overtime,
    penaltyOvertime,
    workOffRouteTime,
    auxiliaryAssistance,
    mailNotDelivered,
    notes,
    weekTotal,
  } = reportData;

  // Calculate % to Standard for office performance
  let officePerformance = null;
  if (mailVolumes && officeTime722 > 0 && mailVolumes.letters > 0 && mailVolumes.flats > 0) {
    officePerformance = calculatePercentToStandard(
      mailVolumes.letters,
      mailVolumes.flats,
      officeTime722
    );
  }

  const formatDate = (dateString) => {
    const d = new Date(dateString + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateVariance = (predicted, actual) => {
    if (predicted === null || predicted === undefined || actual === null || actual === undefined) return null;
    const diff = actual - predicted;
    return diff;
  };

  const formatVariance = (varianceMinutes) => {
    if (varianceMinutes === null || varianceMinutes === undefined) return null;
    const sign = varianceMinutes > 0 ? '+' : '';
    return `${sign}${formatMinutesAsTime(Math.abs(varianceMinutes))}`;
  };

  const officeVariance = calculateVariance(predictedOfficeTime, actualOfficeTime);
  const streetVariance = calculateVariance(predictedStreetTime, actualStreetTime);
  const evaluatedVariance = evaluatedStreetTime ? calculateVariance(evaluatedStreetTime, actualStreetTime) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">End of Day Report</h2>
                <p className="text-sm text-gray-600">Route {routeNumber || 'N/A'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Date</div>
              <div className="text-sm font-semibold text-gray-900">{formatDate(date)}</div>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-gray-700" />
                <h3 className="font-bold text-gray-900">Mail Volumes</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600 mb-1">Parcels</div>
                  <div className="text-lg font-bold text-gray-900">{mailVolumes.parcels}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600 mb-1">Flats</div>
                  <div className="text-lg font-bold text-gray-900">{mailVolumes.flats}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600 mb-1">Letters</div>
                  <div className="text-lg font-bold text-gray-900">{mailVolumes.letters}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600 mb-1">SPRs</div>
                  <div className="text-lg font-bold text-gray-900">{mailVolumes.sprs}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-700" />
                <h3 className="font-bold text-gray-900">USPS Operation Time Summary</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-2 px-2 font-semibold text-gray-700">Operation Code</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-700">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officeTime722 > 0 && (
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">722 - Office Time (AM)</div>
                          <div className="text-xs text-gray-500">Casing, pull down, safety talk</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {formatMinutesAsTime(officeTime722)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200 bg-green-50">
                      <td className="py-2 px-2">
                        <div className="font-medium text-gray-900">721 - Street Time</div>
                        <div className="text-xs text-gray-500">Motorized delivery</div>
                      </td>
                      <td className="text-right py-2 px-2 font-semibold text-green-700 tabular-nums">
                        {actualStreetTime ? formatMinutesAsTime(actualStreetTime) : 'N/A'}
                      </td>
                    </tr>
                    {officeTime744 > 0 && (
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">744 - Office Time (PM)</div>
                          <div className="text-xs text-gray-500">Post-trip, vehicle inspection</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {formatMinutesAsTime(officeTime744)}
                        </td>
                      </tr>
                    )}
                    {workOffRouteTime > 0 && (
                      <tr className="border-b border-gray-200 bg-blue-50">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Work Off Route</div>
                          <div className="text-xs text-gray-500">Additional assignments</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-blue-700 tabular-nums">
                          {formatMinutesAsTime(workOffRouteTime)}
                        </td>
                      </tr>
                    )}
                    {penaltyOvertime > 0 && (
                      <tr className="border-b-2 border-amber-300 bg-amber-50">
                        <td className="py-2 px-2">
                          <div className="font-medium text-amber-900">Penalty Overtime</div>
                          <div className="text-xs text-amber-600">Over 10 hrs or 56 hrs/week</div>
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-amber-700 tabular-nums">
                          {formatMinutesAsTime(penaltyOvertime)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-gray-700" />
                <h3 className="font-bold text-gray-900">Time Comparisons</h3>
              </div>

              <div className="space-y-4">
                {(predictedOfficeTime !== null && predictedOfficeTime !== undefined) && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Office Time</span>
                      {officeVariance !== null && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          officeVariance > 0 ? 'bg-amber-100 text-amber-700' : officeVariance < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {formatVariance(officeVariance)}
                        </span>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 px-2 text-xs font-semibold text-gray-600">Type</th>
                          <th className="text-right py-1 px-2 text-xs font-semibold text-gray-600">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="py-2 px-2 text-gray-700">Predicted</td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-700 tabular-nums">
                            {formatMinutesAsTime(predictedOfficeTime)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 text-gray-700">Actual</td>
                          <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                            {actualOfficeTime ? formatMinutesAsTime(actualOfficeTime) : 'N/A'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Street Time</span>
                    {streetVariance !== null && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        streetVariance > 0 ? 'bg-amber-100 text-amber-700' : streetVariance < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {formatVariance(streetVariance)}
                      </span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1 px-2 text-xs font-semibold text-gray-600">Type</th>
                        <th className="text-right py-1 px-2 text-xs font-semibold text-gray-600">Time</th>
                        {evaluatedStreetTime && <th className="text-right py-1 px-2 text-xs font-semibold text-gray-600">Variance</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {predictedStreetTime && (
                        <tr className="border-b border-gray-200">
                          <td className="py-2 px-2 text-gray-700">Predicted</td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-700 tabular-nums">
                            {formatMinutesAsTime(predictedStreetTime)}
                          </td>
                          {evaluatedStreetTime && <td></td>}
                        </tr>
                      )}
                      <tr className={evaluatedStreetTime ? 'border-b border-gray-200' : ''}>
                        <td className="py-2 px-2 text-gray-700">Actual</td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {actualStreetTime ? formatMinutesAsTime(actualStreetTime) : 'N/A'}
                        </td>
                        {evaluatedStreetTime && (
                          <td className="text-right py-2 px-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              evaluatedVariance > 0 ? 'bg-amber-100 text-amber-700' : evaluatedVariance < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {formatVariance(evaluatedVariance)}
                            </span>
                          </td>
                        )}
                      </tr>
                      {evaluatedStreetTime && (
                        <tr className="bg-indigo-50">
                          <td className="py-2 px-2 text-indigo-900 font-medium">Evaluated</td>
                          <td className="text-right py-2 px-2 font-semibold text-indigo-700 tabular-nums">
                            {formatMinutesAsTime(evaluatedStreetTime)}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {officePerformance && (
              <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-900">Office Performance (% to Standard)</h3>
                </div>

                <div className="bg-white/70 rounded-lg p-4 text-center mb-3">
                  <p className="text-xs text-gray-600 mb-2">USPS DOIS 18/8 Standard</p>
                  <p className={`text-4xl font-bold ${
                    officePerformance.isFast ? 'text-green-600' :
                    officePerformance.isSlow ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {officePerformance.percentToStandard}% {officePerformance.arrow}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {officePerformance.isFast ? (
                      <span className="text-green-700 font-semibold">
                        {Math.abs(officePerformance.variance)} minutes faster than standard
                      </span>
                    ) : officePerformance.isSlow ? (
                      <span className="text-red-700 font-semibold">
                        {Math.abs(officePerformance.variance)} minutes slower than standard
                      </span>
                    ) : (
                      <span className="text-blue-700 font-semibold">
                        On standard
                      </span>
                    )}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 px-2 font-semibold text-gray-700">Component</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">Standard</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Letters</div>
                          <div className="text-xs text-gray-500">{officePerformance.letterPieces} pcs @ 18/min</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {officePerformance.letterMinutes} min
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Flats</div>
                          <div className="text-xs text-gray-500">{officePerformance.flatPieces} pcs @ 8/min</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {officePerformance.flatMinutes} min
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          -
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Pull-down</div>
                          <div className="text-xs text-gray-500">{officePerformance.totalPieces} pcs @ 70/min</div>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          {officePerformance.pullDownMinutes} min
                        </td>
                        <td className="text-right py-2 px-2 font-semibold text-gray-900 tabular-nums">
                          -
                        </td>
                      </tr>
                      <tr className="bg-indigo-50">
                        <td className="py-2 px-2">
                          <div className="font-bold text-indigo-900">Total</div>
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-indigo-700 tabular-nums">
                          {officePerformance.standardTotal} min
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-indigo-700 tabular-nums">
                          {officePerformance.actualMinutes} min
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 p-2 bg-blue-50 border border-blue-300 rounded text-xs">
                  <p className="text-blue-800">
                    <strong>Note:</strong> % to Standard is calculated using USPS DOIS formula. 
                    This is for carrier reference only and is not contractually binding.
                  </p>
                </div>
              </Card>
            )}

            {weekTotal > 0 && (
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-blue-900">Week Total Hours</span>
                  <span className="text-2xl font-bold text-blue-900">{formatMinutesAsTime(weekTotal)}</span>
                </div>
              </Card>
            )}

            {(auxiliaryAssistance || mailNotDelivered) && (
              <Card className="border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-700" />
                  <h3 className="font-bold text-amber-900">Special Conditions</h3>
                </div>
                <div className="space-y-2">
                  {auxiliaryAssistance && (
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                      <span>Received auxiliary assistance</span>
                    </div>
                  )}
                  {mailNotDelivered && (
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                      <span>Mail brought back to office</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {notes && (
              <Card className="bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-gray-700" />
                  <h3 className="font-bold text-gray-900">Notes</h3>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
              </Card>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
