"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import AddTaskForm from "../components/AddTaskForm";

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("openTasks");


  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const response = await fetch(
        "https://o7lxjiq842.execute-api.ap-south-1.amazonaws.com/prod/getManagerTasks",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const response = await fetch(
        "https://o7lxjiq842.execute-api.ap-south-1.amazonaws.com/prod/staff-requests",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTaskAdded = async () => {
    await fetchTasks();
  };


  useEffect(() => {
    setLoading(true);
    setError(null);

    if (activeTab === "openTasks") {
      fetchTasks().finally(() => setLoading(false));
    } else if (activeTab === "staffRequests") {
      fetchRequests().finally(() => setLoading(false));
    } else if (activeTab === "assignedTasks") {
      setLoading(false); 
    }
  }, [activeTab]);

  const handleAddTask = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 dark:bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Tabs and Add Task Button */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("openTasks")}
                className={`py-2 px-4 font-medium rounded-md transition duration-200 ${
                  activeTab === "openTasks"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Open Tasks
              </button>
              <button
                onClick={() => setActiveTab("staffRequests")}
                className={`py-2 px-4 font-medium rounded-md transition duration-200 ${
                  activeTab === "staffRequests"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Staff Requests
              </button>
              <button
                onClick={() => setActiveTab("assignedTasks")}
                className={`py-2 px-4 font-medium rounded-md transition duration-200 ${
                  activeTab === "assignedTasks"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Assigned Tasks
              </button>
            </div>
            <button
              onClick={handleAddTask}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
            >
              Add Task
            </button>
          </div>

          {/* Loading and Error States */}
          {loading && (
            <p className="text-gray-600 dark:text-gray-400">
              Loading {activeTab === "openTasks" ? "tasks" : activeTab === "staffRequests" ? "requests" : "assigned tasks"}...
            </p>
          )}
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

          {/* Open Tasks Tab */}
          {activeTab === "openTasks" && !loading && !error && tasks.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">No tasks found.</p>
          )}
          {activeTab === "openTasks" && !loading && !error && tasks.length > 0 && (
            <div className="grid gap-6">
              {tasks.map((task) => (
                <div
                  key={task.taskId}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {task.taskName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Project ID:</strong> {task.projectId}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Schedule:</strong> {task.startDate} to {task.endDate}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Skills:</strong> {task.requiredSkills.join(", ")}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Status:</strong> {task.status}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Created:</strong>{" "}
                    {new Date(task.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Staff Requests Tab */}
          {activeTab === "staffRequests" && !loading && !error && requests.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">No staff requests found.</p>
          )}
          {activeTab === "staffRequests" && !loading && !error && requests.length > 0 && (
            <div className="grid gap-6">
              {requests.map((request) => (
                <div
                  key={`${request.taskId}-${request.email}`}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Task: {request.task.taskName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Task ID:</strong> {request.taskId}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Project ID:</strong> {request.task.projectId}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Task Schedule:</strong> {request.task.startDate} to{" "}
                    {request.task.endDate}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Task Skills:</strong>{" "}
                    {request.task.requiredSkills.join(", ")}
                  </p>
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Staff Details
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      <strong>Name:</strong> {request.staff.name}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <strong>Email:</strong> {request.email}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <strong>Skills:</strong>{" "}
                      {request.staff.skills?.join(", ") || "None"}
                    </p>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    <strong>Requested At:</strong>{" "}
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Assigned Tasks Tab (Placeholder) */}
          {activeTab === "assignedTasks" && !loading && (
            <p className="text-gray-600 dark:text-gray-400">
              Assigned tasks will be displayed here.
            </p>
          )}

          {/* Add Task Modal */}
          {isModalOpen && (
            <AddTaskForm onClose={closeModal} onTaskAdded={handleTaskAdded} />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}