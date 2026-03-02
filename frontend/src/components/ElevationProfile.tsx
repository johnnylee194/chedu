import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ElevationProfileProps {
  data: Array<{
    distance: number;
    elevation: number;
  }>;
  maxElevation: number;
  minElevation: number;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({ data, maxElevation, minElevation }) => {
  const formatElevation = (value: number) => `${value.toFixed(0)}m`;
  const formatDistance = (value: number) => `${value.toFixed(1)}km`;

  return (
    <div className="w-full h-64 bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">海拔剖面图</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="distance"
            tickFormatter={formatDistance}
            stroke="#6b7280"
            label={{ value: '距离 (km)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            tickFormatter={formatElevation}
            stroke="#6b7280"
            label={{ value: '海拔 (m)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number) => [
              formatElevation(value),
              '海拔'
            ]}
            labelFormatter={(value: number) => `距离: ${formatDistance(value)}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey="elevation"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        <span>最低海拔: {formatElevation(minElevation)}</span>
        <span>最高海拔: {formatElevation(maxElevation)}</span>
      </div>
    </div>
  );
};

export default ElevationProfile;
