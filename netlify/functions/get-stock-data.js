// netlify/functions/get-stock-data.js
// Serverless function to securely fetch stock data without exposing API keys

// Cache object to reduce API calls
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get query parameters
    const { symbol, function: func = 'GLOBAL_QUOTE' } = event.queryStringParameters || {};

    // Validate input
    if (!symbol) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Stock symbol is required',
          message: 'Please provide a symbol parameter'
        })
      };
    }

    // Sanitize symbol (alphanumeric only, max 5 characters)
    const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5);
    
    // Check cache first
    const cacheKey = `${cleanSymbol}-${func}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log(`Cache hit for ${cacheKey}`);
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'X-Cache': 'HIT'
        },
        body: JSON.stringify(cachedData.data)
      };
    }

    // Get API key from environment variables
    const API_KEY = process.env.ALPHA_VANTAGE_KEY;
    
    if (!API_KEY) {
      console.error('Alpha Vantage API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server configuration error',
          message: 'API key not configured. Please contact support.'
        })
      };
    }

    // Construct API URL based on function type
    let apiUrl;
    
    switch(func) {
      case 'QUOTE':
      case 'GLOBAL_QUOTE':
        apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${API_KEY}`;
        break;
        
      case 'TIME_SERIES_DAILY':
        apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${cleanSymbol}&outputsize=compact&apikey=${API_KEY}`;
        break;
        
      case 'TIME_SERIES_INTRADAY':
        apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${cleanSymbol}&interval=5min&apikey=${API_KEY}`;
        break;
        
      case 'COMPANY_OVERVIEW':
        apiUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${cleanSymbol}&apikey=${API_KEY}`;
        break;
        
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid function',
            message: 'Supported functions: GLOBAL_QUOTE, TIME_SERIES_DAILY, TIME_SERIES_INTRADAY, COMPANY_OVERVIEW'
          })
        };
    }

    // Fetch data from Alpha Vantage
    console.log(`Fetching data for ${cleanSymbol} with function ${func}`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Symbol not found',
          message: data['Error Message']
        })
      };
    }

    if (data['Note']) {
      // API call frequency limit reached
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Please wait a minute and try again. API call frequency limit reached.'
        })
      };
    }

    // Transform data for easier frontend consumption
    let transformedData = {
      symbol: cleanSymbol,
      timestamp: new Date().toISOString(),
      data: {}
    };

    switch(func) {
      case 'QUOTE':
      case 'GLOBAL_QUOTE':
        if (data['Global Quote']) {
          const quote = data['Global Quote'];
          transformedData.data = {
            symbol: quote['01. symbol'],
            price: parseFloat(quote['05. price']),
            volume: parseInt(quote['06. volume']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            previousClose: parseFloat(quote['08. previous close']),
            open: parseFloat(quote['02. open']),
            latestTradingDay: quote['07. latest trading day']
          };
        }
        break;
        
      case 'TIME_SERIES_DAILY':
        if (data['Time Series (Daily)']) {
          const timeSeries = data['Time Series (Daily)'];
          transformedData.data = {
            timeSeries: Object.entries(timeSeries).slice(0, 30).map(([date, values]) => ({
              date,
              open: parseFloat(values['1. open']),
              high: parseFloat(values['2. high']),
              low: parseFloat(values['3. low']),
              close: parseFloat(values['4. close']),
              volume: parseInt(values['5. volume'])
            }))
          };
        }
        break;
        
      case 'COMPANY_OVERVIEW':
        transformedData.data = {
          name: data['Name'],
          description: data['Description'],
          sector: data['Sector'],
          industry: data['Industry'],
          marketCap: data['MarketCapitalization'],
          peRatio: data['PERatio'],
          dividentYield: data['DividendYield'],
          eps: data['EPS'],
          beta: data['Beta'],
          yearHigh: data['52WeekHigh'],
          yearLow: data['52WeekLow']
        };
        break;
        
      default:
        transformedData.data = data;
    }

    // Cache the successful response
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: transformedData
    });

    // Clear old cache entries if cache is getting large
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          cache.delete(key);
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=300' // Browser can cache for 5 minutes
      },
      body: JSON.stringify(transformedData)
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'An error occurred while fetching stock data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};