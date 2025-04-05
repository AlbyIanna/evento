export const handler = async () => {
  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message
      })
    };
  }
};
