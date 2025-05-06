const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const jwt = require('jsonwebtoken');

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const SECRET_KEY = process.env.JWT_SECRET;

exports.handler = async (event) => {
  try {
    if (!event.body) {
      throw new Error('Request body is missing');
    }

    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Email and password are required' }),
      };
    }

    const params = {
      TableName: 'Mediphore-Staff',
      Key: marshall({ email }),
    };

    const result = await ddbClient.send(new GetItemCommand(params));

    if (!result.Item) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Invalid email, password, or unverified account' }),
      };
    }

    const staff = unmarshall(result.Item);

    if (staff.password !== password || !staff.isVerified) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Invalid email, password, or unverified account' }),
      };
    }

    const token = jwt.sign({ email, role: 'staff' }, SECRET_KEY, { expiresIn: '1h' });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        message: 'Login successful',
        token,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ message: error.message || 'Internal server error' }),
    };
  }
};