// @ts-check

/** @type {import('lint-staged').Config} */
const config = {
  "{src,components,lib}/**/*.{ts,tsx}": (filenames) => {
    const maxFilesPerChunk = 5; // Reduced chunk size for better stability
    const chunks = [];
    
    // Split files into smaller chunks
    for (let i = 0; i < filenames.length; i += maxFilesPerChunk) {
      const chunk = filenames.slice(i, i + maxFilesPerChunk);
      chunks.push(chunk);
    }

    // Process each chunk with both ESLint and Prettier
    return chunks.map(chunk => {
      const files = chunk.join(' ');
      return [
        // Run ESLint with caching and no warnings
        `eslint --fix --max-warnings=0 --cache ${files}`,
        // Run Prettier with a timeout and error handling
        `prettier --write --loglevel error --cache ${files}`
      ];
    }).flat();
  }
};

module.exports = config; 