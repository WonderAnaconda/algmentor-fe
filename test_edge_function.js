// Test script for the process-excel Edge Function
const SUPABASE_URL = 'https://ypmulzxgzalqxlvwazvc.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with your actual anon key

// Sample CSV data for testing
const sampleCSV = `Open time,PnL,Open volume
2025-01-05 15:30:00,10,1
2025-01-05 15:35:00,-5,1
2025-01-05 15:40:00,15,2
2025-01-05 15:45:00,8,1
2025-01-05 16:00:00,-3,1
2025-01-05 16:15:00,12,2
2025-01-06 15:30:00,7,1
2025-01-06 15:45:00,-8,1
2025-01-06 16:00:00,20,3
2025-01-06 16:30:00,5,1`;

async function testEdgeFunction() {
  try {
    console.log('🧪 Testing Edge Function...');
    
    // Test the Edge Function directly with sample data
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        file_url: 'test-data.csv', // This will be ignored in our test
        user_id: 'test-user-id',
        csv_data: sampleCSV // We'll pass the data directly for testing
      })
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge Function failed:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Edge Function test successful!');
    console.log('📊 Analysis results:');
    console.log(JSON.stringify(result, null, 2));
    
    // Validate the response structure
    if (result.data && result.analysis) {
      console.log('✅ Response structure is correct');
      console.log('📈 Data keys:', Object.keys(result.data));
      console.log('💡 Analysis keys:', Object.keys(result.analysis));
    } else {
      console.log('⚠️ Response structure is missing expected keys');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Browser-friendly test function
function runTest() {
  console.log('🚀 Starting Edge Function test...');
  testEdgeFunction();
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testEdgeFunction, runTest };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('🌐 Browser environment detected. Run runTest() to test the Edge Function.');
} 