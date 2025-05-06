const { DynamoDBClient, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const jwt = require("jsonwebtoken");

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const SECRET_KEY = process.env.JWT_SECRET;

exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization?.replace("Bearer ", "");
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

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
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

    const email = decoded.email;
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
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Staff not found" }),
      };
    }

    const staff = unmarshall(staffResult.Item);
    const staffSkills = (staff.skills || []).map((skill) => skill.toLowerCase());
    const availability = staff.availability;
    const tasksParams = {
      TableName: "Mediphore-Tasks",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: marshall({
        ":status": "Open",
      }),
    };

    const tasksResult = await ddbClient.send(new ScanCommand(tasksParams));
    let tasks = tasksResult.Items?.map((item) => unmarshall(item)) || [];

    if (availability && availability.startDate && availability.endDate) {
      tasks = tasks.filter((task) => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        const availStart = new Date(availability.startDate);
        const availEnd = new Date(availability.endDate);
        return taskStart <= availEnd && taskEnd >= availStart;
      });
    }
    const matchedTasks = await Promise.all(
      tasks.map(async (task) => {
        const requiredSkills = (task.requiredSkills || []).map((skill) =>
          skill.toLowerCase()
        );
        const matchingSkills = requiredSkills.filter((skill) =>
          staffSkills.includes(skill)
        );
        const percentageMatch =
          requiredSkills.length > 0
            ? (matchingSkills.length / requiredSkills.length) * 100
            : 0;
        const requestParams = {
          TableName: "Mediphore-Requests",
          FilterExpression: "originalTaskId = :taskId AND email = :email",
          ExpressionAttributeValues: marshall({
            ":taskId": task.taskId,
            ":email": email,
          }),
        };

        const requestResult = await ddbClient.send(new ScanCommand(requestParams));
        const requests = requestResult.Items?.map((item) => unmarshall(item)) || [];
        const request = requests[0];

        const hasRequested = !!request && ["pending", "approved"].includes(request.status);
        const isRejected = !!request && request.status === "rejected";

        return {
          taskId: task.taskId,
          taskName: task.taskName,
          projectId: task.projectId,
          requiredSkills: task.requiredSkills,
          startDate: task.startDate,
          endDate: task.endDate,
          percentageMatch: Number(percentageMatch.toFixed(2)),
          hasRequested,
          isRejected,
        };
      })
    );
    matchedTasks.sort((a, b) => b.percentageMatch - a.percentageMatch);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({
        message: "Tasks retrieved successfully",
        tasks: matchedTasks,
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