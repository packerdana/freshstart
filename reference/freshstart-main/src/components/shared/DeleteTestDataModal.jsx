import { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import Button from './Button';
import { getDataCounts, deleteAllTestData } from '../../services/dataManagementService';

export default function DeleteTestDataModal({ isOpen, onClose, onSuccess }) {
  const [dataCounts, setDataCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDataCounts();
      setConfirmText('');
      setError(null);
    }
  }, [isOpen]);

  const loadDataCounts = async () => {
    setLoading(true);
    try {
      const counts = await getDataCounts();
      setDataCounts(counts);
    } catch (err) {
      console.error('Error loading data counts:', err);
      setError('Failed to load data counts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== 'delete') {
      setError('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const results = await deleteAllTestData();
      console.log('Test data deleted:', results);

      if (onSuccess) {
        onSuccess(results);
      }

      onClose();
    } catch (err) {
      console.error('Error deleting test data:', err);
      setError(err.message || 'Failed to delete test data');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = dataCounts
    ? dataCounts.routeHistory + dataCounts.waypoints + dataCounts.pmOfficeSessions
    : 0;

  const isConfirmed = confirmText.toLowerCase() === 'delete';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900">
              Delete Test Data
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors"
            disabled={deleting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent mb-4"></div>
              <p className="text-gray-600">Loading data...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Warning: This action cannot be undone!
                    </p>
                    <p className="text-xs text-red-700">
                      This will permanently delete all your route history, waypoints, and PM office sessions.
                      Your route configurations will NOT be deleted.
                    </p>
                  </div>
                </div>

                {dataCounts && (
                  <div className="space-y-2 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Data to be deleted:
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">Route History Entries</span>
                        <span className="text-sm font-bold text-gray-900">{dataCounts.routeHistory}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">Waypoints</span>
                        <span className="text-sm font-bold text-gray-900">{dataCounts.waypoints}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">PM Office Sessions</span>
                        <span className="text-sm font-bold text-gray-900">{dataCounts.pmOfficeSessions}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 border-2 border-red-200 rounded font-bold">
                        <span className="text-sm text-red-900">Total Items</span>
                        <span className="text-lg text-red-600">{totalItems}</span>
                      </div>
                    </div>
                  </div>
                )}

                {totalItems === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600">No data to delete</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type DELETE to confirm:
                      </label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          isConfirmed
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        placeholder="DELETE"
                        disabled={deleting}
                      />
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1"
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={handleDelete}
                        className="flex-1"
                        disabled={!isConfirmed || deleting}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleting ? 'Deleting...' : 'Delete All Data'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
