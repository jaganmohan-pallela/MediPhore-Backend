const { DynamoDBClient, ScanCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const jwt = require("jsonwebtoken");

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const SECRET_KEY = process.env.JWT_SECRET;

exports.handler = async (event) => {
  try {
    const token = event.headers?.Authorization?.replace("Bearer ", "");
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Missing authorization token" }),
      };
    }

    try {
      jwt.verify(token, SECRET_KEY);
    } catch (error) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }
    const requestParams = {
      TableName: "Mediphore-Requests",
    };

    const requestResult = await ddbClient.send(new ScanCommand(requestParams));
    const requests = requestResult.Items?.map((item) => unmarshall(item)) || [];
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const taskId = request.originalTaskId || request.taskId;
        const staffParams = {
          TableName: "Mediphore-Staff",
          Key: marshall({ email: request.email }),
        };
        const staffResult = await ddbClient.send(new GetItemCommand(staffParams));
        const staff = staffResult.Item ? unmarshall(staffResult.Item) : null;
        const taskParams = {
          TableName: "Mediphore-Tasks",
          Key: marshall({ taskId }),
        };
        const taskResult = await ddbClient.send(new GetItemCommand(taskParams));
        const task = taskResult.Item ? unmarshall(taskResult.Item) : null;

        return {
          taskId: taskId,
          email: request.email,
          status: request.status || "pending",
          createdAt: request.createdAt,
          staff: staff
            ? {
              name: staff.name,
              email: staff.email,
              skills: staff.skills || [],
            }
            : null,
          task: task
            ? {
              taskName: task.taskName,
              projectId: task.projectId,
              startDate: task.startDate,
              endDate: task.endDate,
              requiredSkills: task.requiredSkills || [],
            }
            : null,
        };
      })
    );
    const validRequests = enrichedRequests.filter(
      (req) => req.staff && req.task
    );

    validRequests.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({
        message: "Staff requests retrieved successfully",
        requests: validRequests,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: error.message || "Internal server error" }),
    };
  }
};