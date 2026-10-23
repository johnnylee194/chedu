import { List, CheckCircle2 } from 'lucide-react';

interface RouteListProps {
  routes: any[];
  selectedRoute: any;
  onSelectRoute: (id: number) => void;
}

export default function RouteList({ routes, selectedRoute, onSelectRoute }: RouteListProps) {
  return (
    <div className="flex-1 overflow-y-auto border-b">
        <div className="p-2 bg-gray-100 font-semibold text-sm text-gray-600 flex items-center">
            <List size={16} className="mr-1" /> 已保存路线
        </div>
        <ul>
            {routes.map(r => (
                <li
                    key={r.id}
                    onClick={() => onSelectRoute(r.id)}
                    className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${selectedRoute?.id === r.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
                >
                    <div className="font-medium text-gray-800 truncate">{r.title}</div>
                    <div className="text-xs text-gray-500 mt-1 flex justify-between">
                        <span>{r.total_distance} km</span>
                        {r.tile_status === 'completed' && <span className="text-green-600 flex items-center"><CheckCircle2 size={12} className="mr-1" /> 就绪</span>}
                        {r.tile_status === 'downloading' && <span className="text-yellow-600">构建中...</span>}
                    </div>
                </li>
            ))}
            {routes.length === 0 && <div className="p-4 text-gray-400 text-sm text-center">暂无路线</div>}
        </ul>
    </div>
  );
}
