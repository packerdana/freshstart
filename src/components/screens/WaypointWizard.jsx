import { useState } from 'react';

export default function WaypointWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [waypointCount, setWaypointCount] = useState(0);
  const [waypoints, setWaypoints] = useState([]);

  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const handleWaypointCount = (count) => {
    setWaypointCount(count);
    setWaypoints(
      Array.from({ length: count }, (_, i) => ({
        name: '',
        num: i + 2,
      }))
    );
  };

  const updateWaypointName = (idx, name) => {
    const updated = [...waypoints];
    updated[idx].name = name;
    setWaypoints(updated);
  };

  const allWaypointsFilled = waypoints.every(wp => wp.name.trim());

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Progress Text */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-600">Step {currentStep} of {totalSteps}</p>
        </div>

        {/* Content */}
        <div className="p-8">

          {/* Screen 1: Welcome */}
          {currentStep === 1 && (
            <div className="animate-fade-in">
              <div className="text-5xl mb-4">📍</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Waypoints</h1>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Waypoints mark the key stops on your route where you want to log time.
              </p>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded mb-6">
                <p className="text-xs text-yellow-900 font-semibold mb-2">💡 Pro tip:</p>
                <p className="text-xs text-yellow-900">
                  Keep waypoints easy to reach—like when you're in your truck stopped at a parkpoint. Don't set waypoints where you'll be juggling mail in the sun with your hands full!
                </p>
              </div>

              <div className="bg-gray-100 p-4 rounded-md mb-6 text-xs">
                <div className="font-semibold text-gray-900 mb-3">Your Timeline Will Look Like:</div>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#0</div>
                    <div className="text-gray-900">Start Street Time <span className="text-gray-500 text-xs">(automatic on 721)</span></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#1</div>
                    <div className="text-gray-900">Leaving Post Office <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#2+</div>
                    <div className="text-green-700 font-semibold">Your Custom Waypoints</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#98</div>
                    <div className="text-gray-900">Return to Post Office <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#99</div>
                    <div className="text-gray-900">End Street Time 744 or End Tour <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Screen 2: How Many Waypoints */}
          {currentStep === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">How Many Waypoints?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Think about your route. How many key stops make sense to track?
              </p>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded mb-6">
                <p className="text-xs text-yellow-900 font-semibold mb-2">💡 Examples:</p>
                <ul className="text-xs text-yellow-900 ml-4 space-y-1">
                  <li>• Simple route: 1-2 waypoints (first loop, second loop)</li>
                  <li>• Medium route: 2-3 waypoints (park point 1, park point 2, final area)</li>
                  <li>• Complex route: 3-5 waypoints (different neighborhoods, park points, boundaries)</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">How many custom waypoints do you want?</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => handleWaypointCount(num)}
                      className={`py-2 px-3 rounded-md font-semibold text-sm transition ${
                        waypointCount === num
                          ? 'bg-blue-600 text-white'
                          : 'border-2 border-gray-300 bg-white text-gray-900 hover:border-blue-600'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleWaypointCount(5)}
                  className={`mt-2 w-full py-2 px-3 rounded-md font-semibold text-sm transition ${
                    waypointCount > 5
                      ? 'bg-blue-600 text-white'
                      : 'border-2 border-gray-300 bg-white text-gray-900 hover:border-blue-600'
                  }`}
                >
                  5+
                </button>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-xs text-blue-900">
                  ℹ️ You can add or remove waypoints anytime. Start with what makes sense for today.
                </p>
              </div>
            </div>
          )}

          {/* Screen 3: Name Your Waypoints */}
          {currentStep === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Name Your Waypoints</h2>
              <p className="text-sm text-gray-600 mb-4">
                Give them simple, memorable names. (e.g., "Park Point 1", "Downtown Loop", "Second Delivery Area")
              </p>

              <div className="space-y-3 mb-6">
                {waypoints.map((wp, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Waypoint #{wp.num}</label>
                    <input
                      type="text"
                      placeholder="e.g., Park Point 1, Downtown Loop, Second Delivery Area"
                      value={wp.name}
                      onChange={(e) => updateWaypointName(idx, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="text-xs text-gray-600 mt-1">Make it easy to recognize when you're on the street.</p>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                <p className="text-xs text-yellow-900 font-semibold mb-1">💡 Naming tips:</p>
                <p className="text-xs text-yellow-900">
                  Use names YOU recognize instantly. Avoid vague names like "Stop A" or "Area 1". "Oak Park Loop" is better than "Loop 3".
                </p>
              </div>
            </div>
          )}

          {/* Screen 4: Review & Confirm */}
          {currentStep === 4 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Waypoint Timeline</h2>
              <p className="text-sm text-gray-600 mb-4">
                This is what you'll see on your Street Time screen.
              </p>

              <div className="bg-gray-100 p-4 rounded-md mb-6 text-xs">
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#0</div>
                    <div className="text-gray-900">Start Street Time <span className="text-gray-500 text-xs">(automatic on 721)</span></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#1</div>
                    <div className="text-gray-900">Leaving Post Office <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                  {waypoints.map(wp => (
                    <div key={wp.num} className="flex gap-3">
                      <div className="font-bold text-blue-600 min-w-[30px]">#{wp.num}</div>
                      <div className="text-green-700 font-semibold">{wp.name}</div>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#98</div>
                    <div className="text-gray-900">Return to Post Office <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="font-bold text-blue-600 min-w-[30px]">#99</div>
                    <div className="text-gray-900">End Street Time 744 or End Tour <span className="text-gray-500 text-xs">(fixed)</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-6">
                <p className="text-xs text-blue-900">
                  ✅ When you hit the "721" button tomorrow, waypoint #0 will auto-log. Then you'll tap waypoints #1, #2, etc. as you reach them. Your phone will show you which one to tap next.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-8 pb-8 flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={handlePrev}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md font-semibold text-sm hover:bg-gray-200 transition"
            >
              ← Back
            </button>
          )}
          {currentStep < 4 && (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1) ||
                (currentStep === 2 && waypointCount === 0) ||
                (currentStep === 3 && !allWaypointsFilled)
              }
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-semibold text-sm hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          )}
          {currentStep === 4 && (
            <button
              onClick={() => {
                const waypointList = waypoints.map(wp => `#${wp.num} ${wp.name}`).join('\n');
                alert(`Waypoints saved!\n\nYour timeline:\n#0 Start Street Time (auto)\n#1 Leaving Post Office\n${waypointList}\n#98 Return to Post Office\n#99 End Street Time 744 or End Tour\n\nYou're all set for tomorrow!`);
              }}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition"
            >
              Save Waypoints →
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease;
        }
      `}</style>
    </div>
  );
}
