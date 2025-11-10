import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trash2, Database, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface UploadedData {
  id: number;
  date: string;
  uploadInfo: {
    totalRecords?: number;
    originalFileName?: string;
    uploadDate?: string;
  };
  createdAt: string;
}

interface DataManagementProps {
  onDataDeleted: () => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  onDataDeleted,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [uploadedData, setUploadedData] = useState<UploadedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadUploadedData = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.RTO.UPLOADS);
      if (response.ok) {
        const data = await response.json();
        setUploadedData(data);
      } else {
        toast.error('Failed to load uploaded data');
      }
    } catch (error) {
      console.error('Error loading uploaded data:', error);
      toast.error('Failed to load uploaded data');
    } finally {
      setLoading(false);
    }
  };

  const deleteDataByDate = async (date: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete data for ${formatDate(date)}?`,
      )
    ) {
      return;
    }

    setDeleting(date);
    try {
      const response = await fetch(API_ENDPOINTS.RTO.DELETE_UPLOAD(date), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success(`Successfully deleted data for ${date}`);
        await loadUploadedData();
        onDataDeleted();
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          toast.error('Access denied: Admin privileges required');
        } else {
          toast.error(errorData.error || 'Failed to delete data');
        }
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Failed to delete data');
    } finally {
      setDeleting(null);
    }
  };

  const deleteAllData = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete ALL data? This cannot be undone.',
      )
    ) {
      return;
    }

    setDeleting('all');
    try {
      const response = await fetch(API_ENDPOINTS.RTO.DELETE_ALL_UPLOADS, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Successfully deleted all data');
        await loadUploadedData();
        onDataDeleted();
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          toast.error('Access denied: Admin privileges required');
        } else {
          toast.error(errorData.error || 'Failed to delete all data');
        }
      }
    } catch (error) {
      console.error('Error deleting all data:', error);
      toast.error('Failed to delete all data');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    loadUploadedData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
          <div className="p-3 bg-gradient-to-r from-red-100 to-orange-100 rounded-xl">
            <Database className="h-6 w-6 text-red-600" />
          </div>
          Data Management
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Manage your uploaded RTO data. Delete specific date entries or clear
          all data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
            <span className="ml-3 text-gray-600">Loading data...</span>
          </div>
        ) : uploadedData.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Database className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Data Found
            </h3>
            <p className="text-gray-500">
              No uploaded data available to manage.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Delete All Button - Admin only */}
            {isAdmin && (
              <div className="flex justify-end mb-6">
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  disabled={deleting === 'all'}
                  onClick={deleteAllData}
                >
                  {deleting === 'all' ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Deleting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete All Data
                    </div>
                  )}
                </Button>
              </div>
            )}

            {/* Data List */}
            <div className="space-y-3">
              {uploadedData.map((data) => (
                <div
                  key={data.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {formatDate(data.date)}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          Records: {data.uploadInfo?.totalRecords || 'N/A'}
                        </span>
                        <span>Uploaded: {formatDateTime(data.createdAt)}</span>
                        {data.uploadInfo?.originalFileName && (
                          <span className="text-blue-600">
                            {data.uploadInfo.originalFileName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      Active
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        disabled={deleting === data.date}
                        onClick={() => deleteDataByDate(data.date)}
                      >
                        {deleting === data.date ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                            Deleting...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </div>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
