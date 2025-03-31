import React from 'react';

const Graph: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-900">Graph View</h2>
      <p className="text-sm text-gray-600">Explore your data relationships</p>
      <div className="mt-4">
        <div className="h-64 bg-gray-200 rounded-lg">
          {/* Graph will be rendered here */}
        </div>
      </div>
    </div>
  );
};

export default Graph; 