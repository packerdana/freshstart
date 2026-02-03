import { useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, RefreshCw, Bug, Copy } from 'lucide-react';
import Button from './Button';
import { runDiagnostics, testWaypointQuery } from '../../services/diagnosticService';
import useRouteStore from '../../stores/routeStore';
import { getLocalDateString } from '../../utils/time';

export default function DiagnosticsModal({ isOpen, onClose }) {
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const { currentRouteId } = useRouteStore();

  if (!isOpen) return null;

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    try {
      const diagnosticResults = await runDiagnostics();
      setResults(diagnosticResults);

      if (currentRouteId) {
        const today = getLocalDateString();
        const waypointTest = await testWaypointQuery(currentRouteId, today);
        setResults(prev => ({
          ...prev,
          waypointTest
        }));
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setResults({
        overallStatus: 'fail',
        error: error.message,
        tests: []
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyToClipboard = () => {
    const text = JSON.stringify(results, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      alert('Diagnostic results copied to clipboard');
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'fail':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bug className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">System Diagnostics</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            <div className="text-center py-12">
              <Bug className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Run Connection Diagnostics
              </h3>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                This will test your database connection, authentication, route access,
                and waypoint data retrieval to identify any issues.
              </p>
              <Button
                onClick={handleRunDiagnostics}
                disabled={isRunning}
                className="mx-auto"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4 mr-2" />
                    Run Diagnostics
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${getStatusColor(results.overallStatus)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(results.overallStatus)}
                  <h3 className="font-semibold">
                    Overall Status: {results.overallStatus.toUpperCase()}
                  </h3>
                </div>
                <p className="text-sm">
                  {results.overallStatus === 'pass' && 'All systems operational'}
                  {results.overallStatus === 'warning' && 'Some warnings detected'}
                  {results.overallStatus === 'fail' && 'Critical issues found'}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Test Results
                </h4>
                {results.tests.map((test, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getStatusColor(test.status)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(test.status)}
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-sm mb-1">{test.name}</h5>
                        {test.details && (
                          <p className="text-xs opacity-90 mb-1">{test.details}</p>
                        )}
                        {test.error && (
                          <p className="text-xs font-mono bg-white bg-opacity-50 p-2 rounded mt-2">
                            Error: {test.error}
                          </p>
                        )}
                        {test.recommendation && (
                          <p className="text-xs mt-2 font-medium">
                            → {test.recommendation}
                          </p>
                        )}
                        {test.routes && test.routes.length > 0 && (
                          <div className="mt-2 text-xs">
                            <p className="font-medium">Routes found:</p>
                            <ul className="list-disc list-inside ml-2">
                              {test.routes.map(route => (
                                <li key={route.id} className="font-mono">
                                  Route {route.route_number} ({route.id.substring(0, 8)}...)
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {test.waypoints && test.waypoints.length > 0 && (
                          <div className="mt-2 text-xs">
                            <p className="font-medium">Sample waypoints:</p>
                            <ul className="list-disc list-inside ml-2">
                              {test.waypoints.slice(0, 3).map(wp => (
                                <li key={wp.id}>
                                  {wp.address} ({wp.status})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {results.waypointTest && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                    Current Route Test
                  </h4>
                  <div
                    className={`p-4 rounded-lg border ${
                      results.waypointTest.success
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(results.waypointTest.success ? 'pass' : 'fail')}
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-sm mb-1">
                          Waypoint Query Test
                        </h5>
                        {results.waypointTest.success ? (
                          <div className="text-xs space-y-1">
                            <p>Route: {results.waypointTest.route?.route_number}</p>
                            <p>Waypoints found: {results.waypointTest.count}</p>
                            <p className="font-mono bg-white bg-opacity-50 p-2 rounded mt-2">
                              Route ID: {results.waypointTest.route?.id}
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs">
                            <p className="mb-1">Error: {results.waypointTest.error}</p>
                            {results.waypointTest.route && (
                              <p className="font-mono bg-white bg-opacity-50 p-2 rounded mt-2">
                                Route ID: {results.waypointTest.route.id}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {results.criticalIssues && results.criticalIssues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-red-600 text-sm uppercase tracking-wide">
                    Critical Issues
                  </h4>
                  {results.criticalIssues.map((issue, index) => (
                    <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="font-semibold text-sm text-red-900 mb-1">
                        {issue.test}
                      </p>
                      <p className="text-xs text-red-800 mb-2">{issue.issue}</p>
                      {issue.recommendation && (
                        <p className="text-xs text-red-900 font-medium">
                          → {issue.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {results.warnings && results.warnings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-amber-600 text-sm uppercase tracking-wide">
                    Warnings
                  </h4>
                  {results.warnings.map((warning, index) => (
                    <div key={index} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="font-semibold text-sm text-amber-900 mb-1">
                        {warning.test}
                      </p>
                      <p className="text-xs text-amber-800 mb-2">{warning.warning}</p>
                      {warning.recommendation && (
                        <p className="text-xs text-amber-900 font-medium">
                          → {warning.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          {results && (
            <Button
              variant="outline"
              onClick={handleCopyToClipboard}
              className="text-sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Results
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            {results && (
              <Button
                variant="outline"
                onClick={handleRunDiagnostics}
                disabled={isRunning}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
                Re-run
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
