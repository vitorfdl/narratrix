import { execSync } from 'node:child_process';

// Read JSON data from stdin
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(inputData);
    const filePath = hookData.tool_input?.file_path || hookData.tool_response?.filePath;
    const success = hookData.tool_response?.success;

    if (!success || !filePath) {
      process.exit(0);
    }

    // Run type checking on TypeScript files
    if (filePath.match(/\.(ts|tsx)$/)) {
      let hasErrors = false;

      try {
        execSync(`npx tsc --noEmit --skipLibCheck "${filePath}"`, { stdio: 'pipe' });
      } catch (e) {
        console.log('⚠️  TypeScript errors detected - please review');
        hasErrors = true;
      }

      // Run Biome format fix
      try {
        execSync(`npx @biomejs/biome format --write "${filePath}"`, { stdio: 'pipe' });
        console.log('Biome formatting applied to file');
      } catch (e) {
        console.log('⚠️  Biome formatting failed - please review');
      }

      // Run Biome check fix
      try {
        execSync(`npx @biomejs/biome check --write "${filePath}"`, { stdio: 'pipe' });
        console.log('Biome check applied to file');
      } catch (e) {
        console.log('⚠️  Biome check failed - please review');
      }

      // Return structured JSON response
      const response = {
        continue: true,
        suppressOutput: false
      };

      if (hasErrors) {
        response.decision = "warn";
        response.reason = "TypeScript errors detected";
      }

      console.log(JSON.stringify(response));
    }
  } catch (error) {
    console.error('Error processing hook data:', error);
    process.exit(1);
  }
});