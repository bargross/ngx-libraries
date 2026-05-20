const fs = require('fs');
const path = require('path');

const tag = process.env.GITHUB_REF_NAME;
const githubOutput = process.env.GITHUB_OUTPUT;

if (!tag) {
  console.error('No tag found');
  process.exit(1);
}

const atIndex = tag.lastIndexOf('@');
if (atIndex === -1) {
  console.error(`Invalid tag format: "${tag}". Expected "<library>@<version>"`);
  process.exit(1);
}

const libName = tag.substring(0, atIndex);
const tagVersion = tag.substring(atIndex + 1);

const pkgPath = path.join(__dirname, '../projects', libName, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error(`Library "${libName}" not found`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== tagVersion) {
  console.error(`Version mismatch: tag says ${tagVersion}, package.json says ${pkg.version}`);
  process.exit(1);
}

// Write outputs so later steps can use them
if (githubOutput) {
  fs.appendFileSync(githubOutput, `MATCHED_LIBRARY=${libName}\n`);
  fs.appendFileSync(githubOutput, `MATCHED_VERSION=${tagVersion}\n`);
} else {
  // Fallback for local testing
  console.log(`::set-output name=MATCHED_LIBRARY::${libName}`);
  console.log(`::set-output name=MATCHED_VERSION::${tagVersion}`);
}

console.log(`✅ Matched library: ${libName} @ ${tagVersion}`);
