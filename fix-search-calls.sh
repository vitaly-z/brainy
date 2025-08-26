#!/bin/bash

# Fix old search() calls in BrainyChat.ts
sed -i 's/\.search(\([^,]*\), 1, {/\.search(\1, { limit: 1,/g' src/chat/BrainyChat.ts
sed -i 's/\.search(\([^,]*\), \([0-9]\+\), {/\.search(\1, { limit: \2,/g' src/chat/BrainyChat.ts
sed -i 's/\.search(\([^,]*\), \([0-9]\+\))/\.search(\1, { limit: \2 })/g' src/chat/BrainyChat.ts

# Fix in neuralImport.ts
sed -i 's/\.search(\([^,]*\), 1)/\.search(\1, { limit: 1 })/g' src/cortex/neuralImport.ts

# Fix searchWithCursor calls
sed -i 's/\.searchWithCursor(\([^,]*\), \([0-9]\+\), {/\.searchWithCursor(\1, \2, {/g' src/*.ts

# Fix in interactive.ts
sed -i "s/await brain.search('\*', 10, {/await brain.search('\*', { limit: 10,/g" src/cli/interactive.ts

echo "Fixed old search() call signatures"