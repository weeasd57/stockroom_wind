import React from 'react';

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-1">
      <div className="h-full bg-blue-500 animate-loading-bar"></div>
    </div>
  );
};