const axios = require('axios');

async function testBrowserlessToken() {
  const token = '2Sle6gSgBXrCM649873d8bd5de9795d7c056202868be003a9';
  
  console.log('🔍 Testing Browserless token...');
  
  try {
    const response = await axios.post(
      `https://production-sfo.browserless.io/content?token=${token}`,
      {
        code: 'console.log("Hello World"); return "Test successful";'
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Token is valid!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Token test failed');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.status === 403) {
        console.log('\n🔧 Possible solutions:');
        console.log('1. Check if your Browserless account is active');
        console.log('2. Verify the token is correct');
        console.log('3. Check if you have remaining credits');
        console.log('4. Visit https://browserless.io to check your account');
      }
    } else {
      console.log('Network error:', error.message);
    }
  }
}

testBrowserlessToken(); 