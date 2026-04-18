// Simple pseudo-random noise generator to avoid heavy dependencies.
// Based on simple sin/cos fractal noise for deterministic results.

export function roadNoise(t, seed = 0) {
    // 1D noise for road curvature/width
    // Combining multiple sines for irregularity
    const f1 = 12.0;
    const f2 = 27.0;
    const f3 = 56.0;
    return (Math.sin(t * f1 + seed) * 0.5 +
            Math.sin(t * f2 + seed * 1.5) * 0.3 +
            Math.sin(t * f3 + seed * 2.5) * 0.2);
}
