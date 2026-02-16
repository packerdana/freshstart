import Card from '../shared/Card';

export default function RouteScreen() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Route Management</h2>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Route Settings</h3>
        <p className="text-gray-600">
          Configure your route details, start time, and tour length.
        </p>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-600">
          Route configuration features will be available here.
        </p>
      </Card>
    </div>
  );
}
