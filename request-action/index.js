const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
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
          "Access-Control-Allow-Methods": "POST",
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
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Method not allowed" }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Request body is missing" }),
      };
    }

    const { taskId, email, action } = JSON.parse(event.body);
    if (!taskId || !email || !action) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "taskId, email, and action are required" }),
      };
    }

    if (!["approve", "reject"].includes(action)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Invalid action. Use 'approve' or 'reject'" }),
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
    const requests = scanResult.Items?.map((item) => unmarshall(item)) || [];

    if (requests.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Request not found" }),
      };
    }

    const request = requests[0];

    const updateParams = {
      TableName: "Mediphore-Requests",
      Key: marshall({ taskId: request.taskId }),
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: marshall({
        ":status": action === "approve" ? "approved" : "rejected",
      }),
    };
    await ddbClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({
        message: `Request ${action}d successfully`,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      body: JSON.stringify({ message: error.message || "Internal server error" }),
    };
  }
};