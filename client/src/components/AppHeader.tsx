import React from "react";
import { Button } from "./ui/button";
import { LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">R</span>
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
                RTO Reconciliation System
              </h1>
              <h1 className="text-lg font-bold text-gray-900 sm:hidden">
                RTO System
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <User className="h-4 w-4" />
              <span className="font-medium hidden sm:inline">{user.name}</span>
              <span className="text-gray-400 text-xs">({user.role})</span>
            </div>

            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="h-9 px-4 border border-gray-300 hover:border-red-300 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200 font-medium"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
