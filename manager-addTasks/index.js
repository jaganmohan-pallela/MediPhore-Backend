const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const SECRET_KEY = process.env.JWT_SECRET;

exports.handler = async (event) => {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'Missing or invalid token' }),
      };
    }

    const token = authHeader.split(' ')[1];
    try {
      jwt.verify(token, SECRET_KEY);
    } catch (error) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      };
    }
    const {
      taskId,
      projectId,
      taskName,
      startDate,
      endDate,
      requiredSkills,
      status
    } = JSON.parse(event.body);

    if (!taskId || !projectId || !taskName || !startDate || !endDate || !requiredSkills || !status) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'All fields are required' }),
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start >= end) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'Invalid date range' }),
      };
    }

    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'Required skills must be a non-empty array' }),
      };
    }

    const checkParams = {
      TableName: 'Mediphore-Tasks',
      Key: { taskId },
    };

    const existingTask = await dynamoDB.get(checkParams).promise();
    if (existingTask.Item) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        },
        body: JSON.stringify({ message: 'Task ID already exists' }),
      };
    }

    const params = {
      TableName: 'Mediphore-Tasks',
      Item: {
        taskId,
        projectId,
        taskName,
        startDate,
        endDate,
        requiredSkills,
        status,
        createdAt: new Date().toISOString(),
      },
    };

    await dynamoDB.put(params).promise();

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      },
      body: JSON.stringify({ message: 'Task created successfully' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};