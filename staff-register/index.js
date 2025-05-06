const { DynamoDBClient, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { v4: uuidv4 } = require('uuid');

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const sesClient = new SESClient({ region: "ap-south-1" });

exports.handler = async (event) => {
  try {
    if (!event.body) {
      throw new Error('Request body is missing');
    }

    const { name, email, password, skills } = JSON.parse(event.body);

    if (!name || !email || !password || !skills) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'All fields are required' }),
      };
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Skills must be a non-empty array' }),
      };
    }

    const checkParams = {
      TableName: 'Mediphore-Staff',
      Key: marshall({ email }),
    };

    const existingStaff = await ddbClient.send(new GetItemCommand(checkParams));
    if (existingStaff.Item) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ message: 'Email already registered' }),
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expirationTime = Date.now() + 600000;

    const userData = {
      email,
      name,
      password,
      skills,
      otp,
      isVerified: false,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      ddbClient.send(new PutItemCommand({
        TableName: 'Mediphore-Staff',
        Item: marshall(userData),
      })),
      sendEmailOTP(email, otp),
    ]);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ message: 'Registration successful, OTP sent to email' }),
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

async function sendEmailOTP(email, otp) {
  try {
    const params = {
      Source: 'noreply@bytehearts.com',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Mediphore Task Registration OTP',
        },
        Body: {
          Text: {
            Data: `Your OTP for Mediphore task registration is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nMediphore`,
          },
        },
      },
    };

    console.log('Sending email:', JSON.stringify(params, null, 2));
    await sesClient.send(new SendEmailCommand(params));
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}