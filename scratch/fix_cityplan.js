import fs from 'fs';
import path from 'path';

const filePath = 'src/world/cityPlan.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the 'rot' reference error
// Use a regex to match the line regardless of whitespace
content = content.replace(/districtAccent\.rotation\.y\s*=\s*rot;/g, 'districtAccent.rotation.y = cellRot;');

// 2. Fix the extra brace
// We are looking for the end of the building block that has one too many braces.
// Originally it was:
//         }
//      }
//   }
// }
//
// After my edit it became something like:
//             }
//         }
//      }
//    }
//
//   // Render footpaths

// I'll look for the comment '// Render footpaths' and remove the immediately preceding brace pattern.
const pattern = /\}\s*\}\s*\}\s*\n\n\s*\/\/ Render footpaths/m;
if (pattern.test(content)) {
    console.log('Found extra brace pattern, fixing...');
    content = content.replace(pattern, '}\n     }\n\n  // Render footpaths');
} else {
    console.log('Could not find extra brace pattern with regex. Trying alternative...');
    // Fallback: look for the return statement and count braces upwards? No.
    // Let's just look for the specific lines I saw in view_file.
    content = content.replace(/\n\s*\}\n\s*\}\n\s*\}\n\s*\n\s*\/\/ Render footpaths/, '\n        }\n     }\n\n  // Render footpaths');
}

fs.writeFileSync(filePath, content);
console.log('cityPlan.js fix applied.');
