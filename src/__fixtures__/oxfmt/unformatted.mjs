export async function load(url,{retries=3,signal}={}){
  for(let attempt=0;attempt<retries;attempt++){try{const response=await fetch(url,{signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json()}catch(error){if(attempt===retries-1)throw error}}
}
const veryLongFunctionNameForTesting = (firstArgument, secondArgument, thirdArgument) => firstArgument + secondArgument + thirdArgument
export default {load,veryLongFunctionNameForTesting}
