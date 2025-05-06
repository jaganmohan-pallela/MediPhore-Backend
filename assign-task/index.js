const { DynamoDBClient, ScanCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

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
          "Access-Control-Allow-Methods": "GET,POST",
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
          "Access-Control-Allow-Methods": "GET,POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }

    if (event.httpMethod === "GET") {
      const taskId = event.queryStringParameters?.taskId;
      if (!taskId) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "taskId is required" }),
        };
      }

      const taskParams = {
        TableName: "Mediphore-Tasks",
        Key: marshall({ taskId }),
      };
      const taskResult = await ddbClient.send(new GetItemCommand(taskParams));
      if (!taskResult.Item) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Task not found" }),
        };
      }
      const task = unmarshall(taskResult.Item);
      const requiredSkills = (task.requiredSkills || []).map((skill) =>
        skill.toLowerCase()
      );
      const taskStartDate = new Date(task.startDate);
      const taskEndDate = new Date(task.endDate);

      const staffParams = {
        TableName: "Mediphore-Staff",
      };
      const staffResult = await ddbClient.send(new ScanCommand(staffParams));
      const staffList = staffResult.Items?.map((item) => unmarshall(item)) || [];

      const matchedStaff = staffList
        .filter((staff) => {
          if (!staff.availability || !staff.availability.startDate || !staff.availability.endDate) {
            return true;
          }

          const staffStartDate = new Date(staff.availability.startDate);
          const staffEndDate = new Date(staff.availability.endDate);

          return taskStartDate <= staffEndDate && taskEndDate >= staffStartDate;
        })
        .map((staff) => {
          const staffSkills = (staff.skills || []).map((skill) => skill.toLowerCase());
          const matchingSkills = requiredSkills.filter((skill) =>
            staffSkills.includes(skill)
          );
          const percentageMatch =
            requiredSkills.length > 0
              ? (matchingSkills.length / requiredSkills.length) * 100
              : 0;

          return {
            email: staff.email,
            name: staff.name,
            skills: staff.skills || [],
            percentageMatch: Number(percentageMatch.toFixed(2)),
          };
        });

      matchedStaff.sort((a, b) => b.percentageMatch - a.percentageMatch);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({
          message: "Staff retrieved successfully",
          staff: matchedStaff,
        }),
      };
    } else if (event.httpMethod === "POST") {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Request body is missing" }),
        };
      }

      const { taskId, email } = JSON.parse(event.body);
      if (!taskId || !email) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "taskId and email are required" }),
        };
      }

      const taskParams = {
        TableName: "Mediphore-Tasks",
        Key: marshall({ taskId }),
      };
      const taskResult = await ddbClient.send(new GetItemCommand(taskParams));
      if (!taskResult.Item) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Task not found" }),
        };
      }
      const task = unmarshall(taskResult.Item);
      if (task.status !== "Open") {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Task is not open for assignment" }),
        };
      }
      const staffParams = {
        TableName: "Mediphore-Staff",
        Key: marshall({ email }),
      };
      const staffResult = await ddbClient.send(new GetItemCommand(staffParams));
      if (!staffResult.Item) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Staff not found" }),
        };
      }

      const scanParams = {
        TableName: "Mediphore-Requests",
        FilterExpression: "taskId = :taskId AND email = :email",
        ExpressionAttributeValues: marshall({
          ":taskId": taskId,
          ":email": email,
        }),
      };
      const scanResult = await ddbClient.send(new ScanCommand(scanParams));
      const existingRequests = scanResult.Items?.map((item) => unmarshall(item)) || [];

      if (existingRequests.length > 0) {
        const updateParams = {
          TableName: "Mediphore-Requests",
          Key: marshall({ taskId: existingRequests[0].taskId }),
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: marshall({ ":status": "assigned" }),
        };
        await ddbClient.send(new UpdateItemCommand(updateParams));
      } else {
        const newTaskId = `${taskId}-${uuidv4()}`;
        const putParams = {
          TableName: "Mediphore-Requests",
          Item: marshall({
            taskId: newTaskId,
            originalTaskId: taskId,
            email,
            status: "assigned",
            createdAt: new Date().toISOString(),
          }),
        };
        await ddbClient.send(new PutItemCommand(putParams));
      }

      const updateTaskParams = {
        TableName: "Mediphore-Tasks",
        Key: marshall({ taskId }),
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({ ":status": "Assigned" }),
      };
      await ddbClient.send(new UpdateItemCommand(updateTaskParams));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Task assigned successfully" }),
      };
    } else {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: error.message || "Internal server error" }),
    };
  }
};