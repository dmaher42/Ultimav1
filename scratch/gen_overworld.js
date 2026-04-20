
const width = 60;
const height = 60;
const layout = [];

const castleGapStart = 15;
const castleGapEnd = 45;
const villageGapStart = 15;
const villageGapEnd = 45;
const lycaeumGapStart = 20;
const lycaeumGapEnd = 42;

for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
        // North Gap
        if (y === 0 && x >= castleGapStart && x < castleGapEnd) {
            row += " ";
            continue;
        }
        // South Gap
        if (y === height - 1 && x >= villageGapStart && x < villageGapEnd) {
            row += " ";
            continue;
        }
        // West Gap
        if (x === 0 && y >= lycaeumGapStart && y < lycaeumGapEnd) {
            row += " ";
            continue;
        }
        // East Border
        if (x === width - 1) {
            row += "T";
            continue;
        }
        // North/South Border (non-gap)
        if ((y === 0 || y === height - 1) && (x < castleGapStart || x >= castleGapEnd)) {
            row += "T";
            continue;
        }

        // Random trees for flavor
        if (Math.random() < 0.1) {
            row += "T";
        } else {
            row += ".";
        }
    }
    layout.push(row);
}

// Add paths?
// Path from North Gap to South Gap
for (let y = 0; y < height; y++) {
    let rowChars = layout[y].split("");
    for (let x = 29; x <= 31; x++) {
        rowChars[x] = " "; // Path char
    }
    layout[y] = rowChars.join("");
}

// Path to Lycaeum
for (let x = 0; x < 30; x++) {
     let rowChars = layout[30].split("");
     rowChars[x] = " ";
     layout[30] = rowChars.join("");
}

console.log(JSON.stringify(layout, null, 2));
