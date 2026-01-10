
// TMASolver.worker.ts

interface WorkerInput {
    t1: number;
    t2: number;
    b1: number; // True Bearing at T1
    b2: number; // True Bearing at T2
    bearingHistory: { time: number; bearing: number }[]; // Relative bearings
    ownShipHistory: { time: number; x: number; y: number; heading: number }[];
    config: {
        r1Start: number;
        r1End: number;
        r1Step: number;
        r2Start: number;
        r2End: number;
        r2Step: number;
    };
}

const FEET_PER_KNOT_SEC = 1.68;
const YARDS_TO_FEET = 3.0;
const MAX_SPEED = 40.0; // Increased margin slightly

const normalizeAngle = (angle: number) => (angle % 360 + 360) % 360;

const getShortestAngle = (target: number, source: number) => {
    const diff = (target - source + 540) % 360 - 180;
    return diff;
};

const interpolateOwnShip = (history: any[], time: number) => {
    // Assuming history is sorted by time ASCENDING (we will sort it once received)
    // Binary search for efficiency? Or linear scan since it's a worker.
    // Let's use binary search for speed.

    let left = 0;
    let right = history.length - 1;

    if (time <= history[0].time) return history[0];
    if (time >= history[right].time) return history[right];

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (history[mid].time < time) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    // history[right] < time < history[left]
    // wait, if loop finishes, 'left' is the index of first element > time. 'right' is left-1.
    // So we want 'right' and 'left' (which is right+1).

    const p0 = history[right];
    const p1 = history[left];

    if (!p0) return p1;
    if (!p1) return p0;

    const ratio = (time - p0.time) / (p1.time - p0.time);

    // Linear Interpolation
    return {
        x: p0.x + (p1.x - p0.x) * ratio,
        y: p0.y + (p1.y - p0.y) * ratio,
        heading: p0.heading // Heading interpolation is tricky with wrap, just use nearest or simple lerp if no wrap
    };
};

onmessage = (e: MessageEvent<WorkerInput>) => {
    const { t1, t2, b1, b2, bearingHistory, ownShipHistory, config } = e.data;

    // 1. Sort History Arrays
    const sortedOS = ownShipHistory.slice().sort((a, b) => a.time - b.time);
    const sortedBearings = bearingHistory.slice().sort((a, b) => a.time - b.time);

    // 2. Setup Grid
    const width = Math.floor((config.r1End - config.r1Start) / config.r1Step) + 1;
    const height = Math.floor((config.r2End - config.r2Start) / config.r2Step) + 1;
    const grid = new Float32Array(width * height);

    // 3. Pre-calculate Anchor Points (OwnShip at T1 and T2)
    const os1 = interpolateOwnShip(sortedOS, t1);
    const os2 = interpolateOwnShip(sortedOS, t2);

    // Re-structuring loop for optimization
    const relevantHistory = sortedBearings.filter(h => h.time >= t1 && h.time <= t2);

    // Pre-calculate OwnShip for each history point
    const historyWithOS = relevantHistory.map(h => ({
        ...h,
        os: interpolateOwnShip(sortedOS, h.time)
    }));

    for (let y = 0; y < height; y++) {
        const r2 = config.r2Start + y * config.r2Step;
        const rad2 = (b2 * Math.PI) / 180;
        const p2x = os2.x + r2 * YARDS_TO_FEET * Math.sin(rad2);
        const p2y = os2.y + r2 * YARDS_TO_FEET * Math.cos(rad2);

        for (let x = 0; x < width; x++) {
            const r1 = config.r1Start + x * config.r1Step;
            const rad1 = (b1 * Math.PI) / 180;
            const p1x = os1.x + r1 * YARDS_TO_FEET * Math.sin(rad1);
            const p1y = os1.y + r1 * YARDS_TO_FEET * Math.cos(rad1);

            const dt = t2 - t1;
            if (dt <= 0.1) {
                grid[y * width + x] = -1; continue;
            }

            const vx = (p2x - p1x) / dt;
            const vy = (p2y - p1y) / dt;
            const speedKts = Math.sqrt(vx * vx + vy * vy) / FEET_PER_KNOT_SEC;

            if (speedKts > MAX_SPEED) {
                grid[y * width + x] = -1;
                continue;
            }

            let sumSqErr = 0;
            let count = 0;

            for (let k = 0; k < historyWithOS.length; k++) {
                const h = historyWithOS[k];
                const tCurrent = h.time - t1;
                const tx = p1x + vx * tCurrent;
                const ty = p1y + vy * tCurrent;

                const dx = tx - h.os.x;
                const dy = ty - h.os.y;

                const trueBrg = normalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI);
                const computedRel = normalizeAngle(trueBrg - h.os.heading);
                const diff = getShortestAngle(computedRel, h.bearing);

                sumSqErr += diff * diff;
                count++;
            }

            if (count > 0) {
                grid[y * width + x] = Math.sqrt(sumSqErr / count);
            } else {
                grid[y * width + x] = 0;
            }
        }
    }

    postMessage({ grid, width, height });
};
