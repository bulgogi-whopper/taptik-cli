#!/bin/bash

echo "Fixing TypeScript errors in push module..."

# Fix 'phase' to 'stage' in all test files
find src/modules/push -name "*.spec.ts" -type f -exec sed -i '' "s/\\.phase/\\.stage/g" {} \;
find src/modules/push -name "*.spec.ts" -type f -exec sed -i '' "s/phase:/stage:/g" {} \;

# Fix 'public: true' to 'visibility: PackageVisibility.Public' in test files
find src/modules/push -name "*.spec.ts" -type f -exec sed -i '' "s/public: true/visibility: PackageVisibility.Public/g" {} \;
find src/modules/push -name "*.spec.ts" -type f -exec sed -i '' "s/private: true/visibility: PackageVisibility.Private/g" {} \;
find src/modules/push -name "*.spec.ts" -type f -exec sed -i '' "s/public: false/visibility: PackageVisibility.Private/g" {} \;

# Fix remaining phase references in service files
find src/modules/push -name "*.ts" ! -name "*.spec.ts" -type f -exec sed -i '' "s/\\.phase/\\.stage/g" {} \;
find src/modules/push -name "*.ts" ! -name "*.spec.ts" -type f -exec sed -i '' "s/phase:/stage:/g" {} \;

echo "Fixes applied. Running typecheck..."
pnpm run typecheck