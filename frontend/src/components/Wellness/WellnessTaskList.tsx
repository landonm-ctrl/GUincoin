import { useState } from 'react';
import { WellnessTask } from '../../services/api';
import WellnessTaskModal from './WellnessTaskModal';

interface WellnessTaskListProps {
  tasks: WellnessTask[];
  onSubmission: () => void;
}

export default function WellnessTaskList({ tasks, onSubmission }: WellnessTaskListProps) {
  const [selectedTask, setSelectedTask] = useState<WellnessTask | null>(null);

  return (
    <>
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No wellness tasks available</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{task.name}</h3>
                  {task.description && (
                    <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                  )}
                  <div className="mt-2 flex items-center space-x-4">
                    <span className="text-sm font-medium text-green-600">
                      {task.coinValue.toFixed(2)} coins
                    </span>
                    <span className="text-xs text-gray-500">
                      {task.frequencyRule === 'one_time'
                        ? 'One-time'
                        : task.frequencyRule === 'annual'
                        ? 'Annual'
                        : 'Quarterly'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTask(task)}
                  className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Submit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTask && (
        <WellnessTaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubmission={onSubmission}
        />
      )}
    </>
  );
}
