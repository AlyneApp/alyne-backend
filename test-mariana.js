const axios = require('axios');

async function testMarianaScraper() {
  try {
    const response = await axios.post('http://localhost:3000/api/scrape-mariana', {
      websiteUrl: 'https://slt.marianaiframes.com/iframe/schedule/daily/48541',
      date: '2025-01-29',
      studioAddress: 'Flatiron'
    });

    console.log('✅ Success:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMarianaScraper(); 