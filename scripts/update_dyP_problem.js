const axios = require('axios');

async function updateProblem() {
  try {
    const response = await axios.put('http://localhost:1338/api/problems/t51sskwj93cuviwg11cpq8oo', {
      data: {
        examples: [
          { 
            input: 'str=["a", "b"], num=10, arr=[1, 2, 3]', 
            output: '2', 
            explanation: 'Because 10 / (1+2+3) is roughly 1.66, and we pick the first indices.' 
          },
          { 
            input: 'str=["x"], num=5, arr=[10]', 
            output: '0', 
            explanation: 'Input index out of bounds.' 
          }
        ],
        constraints: '1 <= str.length <= 100\n0 <= num <= 1000\n1 <= arr.length <= 100'
      }
    });
    console.log('Problem updated successfully.');
  } catch (error) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

updateProblem();
