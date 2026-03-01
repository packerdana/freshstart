import { useState } from 'react';
import SetupWizard from './SetupWizard';
import WaypointWizard from './WaypointWizard';

export default function TestHub() {
  const [activeTest, setActiveTest] = useState('menu');

  if (activeTest === 'setup-wizard') {
    return (
      <div>
        <button
          onClick={() => setActiveTest('menu')}
          className="fixed top-4 left-4 px-4 py-2 bg-gray-600 text-white rounded-md text-sm z-50"
        >
          ← Back to Menu
        </button>
        <SetupWizard />
      </div>
    );
  }

  if (activeTest === 'waypoint-wizard') {
    return (
      <div>
        <button
          onClick={() => setActiveTest('menu')}
          className="fixed top-4 left-4 px-4 py-2 bg-gray-600 text-white rounded-md text-sm z-50"
        >
          ← Back to Menu
        </button>
        <WaypointWizard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RouteWise Test Hub</h1>
        <p className="text-gray-600 mb-8">Private testing for wizards & new UI components (Feb 28, 2026)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTest('setup-wizard')}
            className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:shadow-md transition text-left"
          >
            <div className="text-2xl mb-2">🎉</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Setup Wizard</h2>
            <p className="text-sm text-gray-600">7-screen onboarding wizard for first-time users. Tests name, station search, carrier type, seniority, route details.</p>
          </button>

          <button
            onClick={() => setActiveTest('waypoint-wizard')}
            className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:shadow-md transition text-left"
          >
            <div className="text-2xl mb-2">📍</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Waypoint Wizard</h2>
            <p className="text-sm text-gray-600">4-screen wizard for route waypoint configuration. Tests custom waypoints, naming, and timeline preview.</p>
          </button>
        </div>

        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-gray-900 mb-3">Testing Notes</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✅ Both wizards are fully interactive</li>
            <li>✅ Form validation is working</li>
            <li>✅ Station search filters by zipcode or name</li>
            <li>✅ Route Details are optional</li>
            <li>✅ Waypoint count and naming validation in place</li>
            <li>💡 To test with your own data, provide feedback and we'll integrate with Supabase</li>
          </ul>
        </div>

        <div className="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-bold text-gray-900 mb-2">Branch Info</h3>
          <p className="text-sm text-gray-700">
            This is a preview deployment of <code className="bg-yellow-100 px-2 py-1 rounded">feature/wizards-testing</code>.
            <br />
            Once you approve these wizards, we'll build the remaining UI facelift screens and merge to main.
          </p>
        </div>
      </div>
    </div>
  );
}
