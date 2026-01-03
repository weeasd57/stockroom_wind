const { execSync } = require('child_process');

try {
    console.log('Running ESLint to count errors... (this may take a moment)');
    // Execute eslint with json format. 
    // We ignore stderr because eslint prints some debug info there.
    // We expect it to throw if there are errors (exit code 1), but we catch it to read stdout.
    const output = execSync('npx eslint . --format=json', {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024, // Increase buffer for large projects
        stdio: ['ignore', 'pipe', 'ignore']
    });

    parseAndPrint(output);

} catch (error) {
    // ESLint throws an error when exit code is 1 (which means lint errors found)
    // The stdout contains the JSON output we need.
    if (error.stdout) {
        parseAndPrint(error.stdout.toString());
    } else {
        console.error('Failed to run ESLint:', error.message);
        process.exit(1);
    }
}

function parseAndPrint(jsonString) {
    try {
        const results = JSON.parse(jsonString);
        const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
        const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0);

        console.clear(); // Clear console for cleaner look
        console.log('\n📊 ESLint Check Results');
        console.log('=======================');
        console.log(`❌ Errors:   ${errorCount}`);
        console.log(`⚠️  Warnings: ${warningCount}`);
        console.log('=======================');

        if (errorCount === 0) {
            console.log('✅ Great job! No errors found.');
        } else {
            console.log(`💡 Run 'npm run lint' to see details.`);
        }

    } catch (e) {
        console.error('Error parsing ESLint output:', e.message);
    }
}
