const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });

exports.handler = async (event) => {
  try {
    if (!event.body) {
      throw new Error('Request body is missing');
    }

    const { email, otp } = JSON.parse(event.body);

    if (!email || !otp) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Email and OTP are required' }),
      };
    }

    const params = {
      TableName: 'Mediphore-Staff',
      Key: marshall({ email }),
    };

    const result = await ddbClient.send(new GetItemCommand(params));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Staff not found' }),
      };
    }

    const staff = unmarshall(result.Item);

    if (staff.isVerified) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Account already verified' }),
      };
    }

    if (staff.otp !== otp) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Invalid OTP' }),
      };
    }

    const updateParams = {
      TableName: 'Mediphore-Staff',
      Key: marshall({ email }),
      UpdateExpression: 'SET isVerified = :verified, otp = :null',
      ExpressionAttributeValues: marshall({
        ':verified': true,
        ':null': null,
      }),
    };

    await ddbClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ message: 'OTP verified successfully' }),
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