const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
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

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
      if (decoded.role !== "staff") {
        return {
          statusCode: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Unauthorized: Staff role required" }),
        };
      }
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

    const email = decoded.email;

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

    const { availability } = JSON.parse(event.body);
    if (!availability || !availability.startDate || !availability.endDate) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({
          message: "Availability must include startDate and endDate",
        }),
      };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(availability.startDate) ||
      !dateRegex.test(availability.endDate)
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "Invalid date format. Use YYYY-MM-DD" }),
      };
    }
    const startDate = new Date(availability.startDate);
    const endDate = new Date(availability.endDate);
    if (endDate < startDate) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ message: "endDate must be on or after startDate" }),
      };
    }
    const params = {
      TableName: "Mediphore-Staff",
      Key: marshall({ email }),
      UpdateExpression: "SET availability = :availability",
      ExpressionAttributeValues: marshall({
        ":availability": {
          startDate: availability.startDate,
          endDate: availability.endDate,
        },
      }),
      ConditionExpression: "attribute_exists(email)",
      ReturnValues: "NONE",
    };

    try {
      await ddbClient.send(new UpdateItemCommand(params));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({ message: "Staff not found" }),
        };
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: "Availability updated successfully" }),
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