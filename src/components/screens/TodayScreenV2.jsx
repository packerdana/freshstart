import { useState } from 'react';

export default function TodayScreenV2() {
  const [fullTubs, setFullTubs] = useState('2');
  const [partialTubs, setPartialTubs] = useState('0.75');
  const [hotCaseFlats, setHotCaseFlats] = useState('3');
  const [hotCaseLetters, setHotCaseLetters] = useState('1');
  const [dpsNumber, setDpsNumber] = useState('145');
  const [packages, setPackages] = useState('28');
  const [loadTruckMinutes, setLoadTruckMinutes] = useState('12');
  const [routeStarted, setRouteStarted] = useState(false);

  const totalFlatDepth = (parseFloat(fullTubs) || 0) + (parseFloat(partialTubs) || 0);

  if (!routeStarted) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-600 text-white py-4 px-6">
            <h1 className="text-xl font-bold">Today's Setup</h1>
            <p className="text-sm text-blue-100">Route 23 • March 1, 2026</p>
          </div>

          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Morning Inputs</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Full Tubs</label>
              <input
                type="number"
                value={fullTubs}
                onChange={(e) => setFullTubs(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Partial Tubs</label>
              <input
                type="number"
                step="0.25"
                value={partialTubs}
                onChange={(e) => setPartialTubs(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm font-semibold text-gray-900">Total Flat Depth: <strong>{totalFlatDepth.toFixed(2)}</strong> feet</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Hot Case Flats (inches)</label>
              <input
                type="number"
                value={hotCaseFlats}
                onChange={(e) => setHotCaseFlats(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Hot Case Letters (inches)</label>
              <input
                type="number"
                value={hotCaseLetters}
                onChange={(e) => setHotCaseLetters(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">DPS Number</label>
              <input
                type="number"
                value={dpsNumber}
                onChange={(e) => setDpsNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="bg-green-50 p-3 rounded-md">
              <p className="text-sm text-green-900"><strong>⏱️ Load Truck Timer</strong></p>
              <p className="text-sm text-green-700 mt-1">Measured: {loadTruckMinutes} min</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Total Packages</label>
              <input
                type="number"
                value={packages}
                onChange={(e) => setPackages(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            <button
              onClick={() => setRouteStarted(true)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md font-semibold text-sm hover:bg-blue-700 transition"
            >
              Start Route 📍
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <h1 className="text-xl font-bold">Route 23 • On Street</h1>
        <p className="text-sm text-blue-100">Started 7:35 AM • Predicted End: 6:15 PM</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-semibold text-gray-600">📊 Predictions</p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-xs text-gray-600">Return to PO</p>
              <p className="text-lg font-bold text-gray-900">5:45 PM</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">End of Tour</p>
              <p className="text-lg font-bold text-gray-900">6:15 PM</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-semibold text-gray-600">📍 Timeline</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Leaving PO</span>
              <span className="font-semibold text-gray-900">7:35 AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Park Point 1</span>
              <span className="font-semibold text-gray-900">8:15 AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Lunch Break</span>
              <span className="font-semibold text-gray-900">12:30 PM – 1:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Downtown Loop</span>
              <span className="font-semibold text-gray-900">1:45 PM</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-semibold text-gray-600">🍽️ Break Allocation</p>
          <div className="mt-3 space-y-2">
            <button className="w-full px-3 py-2 bg-blue-100 text-blue-900 rounded-md text-sm font-semibold">
              🍽️ Take Lunch
            </button>
            <button className="w-full px-3 py-2 bg-indigo-100 text-indigo-900 rounded-md text-sm font-semibold">
              ☕ Take Break #1
            </button>
            <button className="w-full px-3 py-2 bg-indigo-100 text-indigo-900 rounded-md text-sm font-semibold">
              ☕ Take Break #2
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="px-3 py-2 bg-yellow-100 text-yellow-900 rounded-md text-sm font-semibold">
            ⏸️ Pause Shift
          </button>
          <button
            onClick={() => setRouteStarted(false)}
            className="px-3 py-2 bg-red-100 text-red-900 rounded-md text-sm font-semibold"
          >
            🛑 End Route
          </button>
        </div>
      </div>
    </div>
  );
}
