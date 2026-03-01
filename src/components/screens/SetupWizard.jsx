import { useState } from 'react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Input from '../shared/Input';

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [formData, setFormData] = useState({
    name: '',
    station: '',
    carrierType: '',
    seniorityDate: '',
    stops: '',
    baseParcels: '',
  });
  const [stationSearch, setStationSearch] = useState('');
  const [stationResults, setStationResults] = useState([]);

  const stations = [
    { id: 'downtown', name: 'Downtown Station', zipcode: '90210', fullName: 'Downtown Station (90210)' },
    { id: 'north', name: 'North Station', zipcode: '90211', fullName: 'North Station (90211)' },
    { id: 'south', name: 'South Station', zipcode: '90212', fullName: 'South Station (90212)' },
    { id: 'east', name: 'East Station', zipcode: '90213', fullName: 'East Station (90213)' },
    { id: 'west', name: 'West Station', zipcode: '90214', fullName: 'West Station (90214)' },
    { id: 'central', name: 'Central Station', zipcode: '90215', fullName: 'Central Station (90215)' },
    { id: 'airport', name: 'Airport Station', zipcode: '90216', fullName: 'Airport Station (90216)' },
  ];

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

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const searchStations = (query) => {
    setStationSearch(query);
    if (!query || query.length < 1) {
      setStationResults([]);
      return;
    }

    const filtered = stations.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.zipcode.includes(query)
    );

    setStationResults(filtered);
  };

  const selectStation = (stationName) => {
    handleFieldChange('station', stationName);
    setStationSearch(stationName);
    setStationResults([]);
  };

  const carrierTypeMap = {
    'regular': 'Regular Carrier',
    't6-swing': 'T-6 or Swing',
    'cca': 'CCA (City Carrier Assistant)',
    'unassigned': 'Unassigned Regular'
  };

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
              <div className="text-5xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to RouteWise</h1>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Let's set up your account so we can start tracking your route accurately and protect your workload data.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-8">
                <p className="text-xs text-blue-900">
                  ℹ️ This usually takes 5-10 minutes. You can come back later if needed.
                </p>
              </div>
            </div>
          )}

          {/* Screen 2: Name */}
          {currentStep === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your name?</h2>
              <p className="text-sm text-gray-600 mb-6">
                We use this to identify your routes in the app.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Full Name</label>
                <input
                  type="text"
                  placeholder="Dana Olson"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-600 mt-1">First and last name</p>
              </div>
            </div>
          )}

          {/* Screen 3: Station */}
          {currentStep === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Which station?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Search by zipcode or office name.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Station / Office</label>
                <input
                  type="text"
                  placeholder="Enter zipcode or station name (e.g., 90210 or Downtown)"
                  value={stationSearch}
                  onChange={(e) => searchStations(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                {stationResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {stationResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => selectStation(s.fullName)}
                        className="p-2 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 text-sm"
                      >
                        {s.fullName}
                      </div>
                    ))}
                  </div>
                )}
                {stationSearch && stationResults.length === 0 && (
                  <div className="mt-2 text-xs text-gray-600">No stations found. Try a different zipcode.</div>
                )}
                <p className="text-xs text-gray-600 mt-2">Searches USPS delivery stations. Can't find yours? Contact support.</p>
              </div>
            </div>
          )}

          {/* Screen 4: Carrier Type */}
          {currentStep === 4 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your carrier type?</h2>
              <p className="text-sm text-gray-600 mb-6">
                This tells us how many routes you'll be setting up.
              </p>
              <div className="space-y-2">
                {[
                  { value: 'regular', label: 'Regular Carrier', sub: '1 route (you\'re assigned to one primary route)' },
                  { value: 't6-swing', label: 'T-6 or Swing', sub: 'Up to 5 routes (you rotate across several)' },
                  { value: 'cca', label: 'CCA (City Carrier Assistant)', sub: 'Many routes (you\'re assigned as needed)' },
                  { value: 'unassigned', label: 'Unassigned Regular', sub: 'Many routes (regular without permanent assignment)' },
                ].map(option => (
                  <label key={option.value} className="flex items-start p-3 border-2 border-gray-200 rounded-md cursor-pointer hover:border-blue-600 hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="carrierType"
                      value={option.value}
                      checked={formData.carrierType === option.value}
                      onChange={(e) => handleFieldChange('carrierType', e.target.value)}
                      className="mt-1 accent-blue-600"
                    />
                    <div className="ml-3">
                      <div className="font-semibold text-gray-900 text-sm">{option.label}</div>
                      <div className="text-xs text-gray-600">{option.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Screen 5: Seniority Date */}
          {currentStep === 5 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">When did you start? <span className="inline-block bg-blue-100 text-blue-900 text-xs font-semibold px-2 py-0.5 rounded ml-2">Optional</span></h2>
              <p className="text-sm text-gray-600 mb-6">
                Your seniority date helps us understand your career stage (not required).
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.seniorityDate}
                  onChange={(e) => handleFieldChange('seniorityDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-600 mt-2">Leave blank if you'd rather not share.</p>
              </div>
            </div>
          )}

          {/* Screen 6: Route Details */}
          {currentStep === 6 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Route Details <span className="inline-block bg-blue-100 text-blue-900 text-xs font-semibold px-2 py-0.5 rounded ml-2">Optional</span></h2>
              <p className="text-sm text-gray-600 mb-4">
                Fill these in now, or come back later when you have the info.
              </p>

              <div className="bg-gray-100 p-3 rounded-md mb-6 text-sm">
                <div className="font-semibold text-gray-900 mb-2">📊 Your Recent History</div>
                <div className="text-gray-600 text-xs">Last 10 routes averaged: <strong>115 stops</strong></div>
                <div className="text-gray-600 text-xs">Last 10 routes averaged: <strong>24 parcels</strong></div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">How many stops on your route? <span className="font-normal text-gray-500">(optional)</span></label>
                <input
                  type="text"
                  placeholder="115"
                  value={formData.stops}
                  onChange={(e) => handleFieldChange('stops', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-600 mt-1">Total delivery addresses. Find this in your <strong>edit book</strong>. <strong>Why?</strong> This determines cased boxholder credit calculations.</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Base parcels (normal day) <span className="font-normal text-gray-500">(optional)</span></label>
                <input
                  type="text"
                  placeholder="24"
                  value={formData.baseParcels}
                  onChange={(e) => handleFieldChange('baseParcels', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-600 mt-1">Average parcels you start with. Ask your <strong>supervisor</strong> for this number. <strong>Why?</strong> You'll use this on your 3996 form. Anything over base = grievance evidence.</p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-xs text-blue-900">
                  💡 Once set, these become your baseline for 3996 claims. You can update them anytime, but each change starts a new period.
                </p>
              </div>
            </div>
          )}

          {/* Screen 7: Review */}
          {currentStep === 7 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Setup</h2>
              <p className="text-sm text-gray-600 mb-6">
                Make sure everything looks right before we start tracking.
              </p>

              <div className="space-y-3 mb-6">
                <div className="bg-gray-100 p-3 rounded-md">
                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Name</div>
                  <div className="text-lg font-bold text-gray-900">{formData.name || 'Not set'}</div>
                  <a href="#" onClick={() => goToStep(2)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">Change</a>
                </div>

                <div className="bg-gray-100 p-3 rounded-md">
                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Station</div>
                  <div className="text-lg font-bold text-gray-900">{formData.station || 'Not set'}</div>
                  <a href="#" onClick={() => goToStep(3)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">Change</a>
                </div>

                <div className="bg-gray-100 p-3 rounded-md">
                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Carrier Type</div>
                  <div className="text-lg font-bold text-gray-900">{carrierTypeMap[formData.carrierType] || 'Not set'}</div>
                  <a href="#" onClick={() => goToStep(4)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">Change</a>
                </div>

                <div className="bg-gray-100 p-3 rounded-md">
                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Stops / Base Parcels</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formData.stops && formData.baseParcels
                      ? `${formData.stops} stops • ${formData.baseParcels} parcels`
                      : formData.stops
                      ? `${formData.stops} stops • (parcels pending)`
                      : formData.baseParcels
                      ? `(stops pending) • ${formData.baseParcels} parcels`
                      : '(pending)'}
                  </div>
                  <a href="#" onClick={() => goToStep(6)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">Fill in / Change</a>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-xs text-blue-900">
                  ✅ You're all set! RouteWise will now start tracking your delivery times, predict your end-of-tour, and help you document workload on form 3996. You can fill in route details anytime from your profile settings.
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
          {currentStep < 7 && (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 2 && !formData.name) ||
                (currentStep === 3 && !formData.station) ||
                (currentStep === 4 && !formData.carrierType)
              }
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-semibold text-sm hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          )}
          {currentStep === 7 && (
            <button
              onClick={() => alert(`Setup complete! You're ready to start.\n\nName: ${formData.name}\nStation: ${formData.station}\nCarrier Type: ${carrierTypeMap[formData.carrierType]}\nRoute: ${formData.stops ? formData.stops + ' stops, ' : ''}${formData.baseParcels ? formData.baseParcels + ' parcels' : '(Fill in later from settings)'}`)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition"
            >
              Start Using RouteWise →
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
