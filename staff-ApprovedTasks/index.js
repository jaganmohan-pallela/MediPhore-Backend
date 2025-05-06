const { DynamoDBClient, ScanCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
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

        const requestParams = {
            TableName: "Mediphore-Requests",
            FilterExpression: "email = :email AND #status = :status",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: marshall({
                ":email": email,
                ":status": "approved",
            }),
        };

        const requestResult = await ddbClient.send(new ScanCommand(requestParams));
        const requests = requestResult.Items?.map((item) => unmarshall(item)) || [];

        const enrichedTasks = await Promise.all(
            requests.map(async (request) => {
                const taskId = request.originalTaskId || request.taskId;
                const taskParams = {
                    TableName: "Mediphore-Tasks",
                    Key: marshall({ taskId }),
                };
                const taskResult = await ddbClient.send(new GetItemCommand(taskParams));
                const task = taskResult.Item ? unmarshall(taskResult.Item) : null;

                return {
                    taskId: taskId,
                    taskName: task?.taskName || "Unknown Task",
                    projectId: task?.projectId || "N/A",
                    startDate: task?.startDate || "N/A",
                    endDate: task?.endDate || "N/A",
                    requiredSkills: task?.requiredSkills || [],
                    status: request.status,
                    requestedAt: request.createdAt,
                };
            })
        );

        enrichedTasks.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
            body: JSON.stringify({
                message: "Approved tasks retrieved successfully",
                tasks: enrichedTasks,
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