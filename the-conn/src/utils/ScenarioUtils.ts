
export const getPolarPosition = (origin: { x: number; y: number }, range: number, bearing: number): { x: number; y: number } => {
    // Bearing is in degrees (0 = North, 90 = East)
    const rad = (bearing * Math.PI) / 180;
    return {
        x: origin.x + range * Math.sin(rad),
        y: origin.y + range * Math.cos(rad),
    };
};

export const getRandomRange = (min: number, max: number): number => {
    return min + Math.random() * (max - min);
};

export const rotatePoint = (x: number, y: number, angleDegrees: number): { x: number; y: number } => {
    const rad = (angleDegrees * Math.PI) / 180;
    // Rotation logic (Clockwise)
    // x (East/Cross) rotated
    // y (North/Along) rotated
    // Formula derived from standard navigation rotation:
    // x' = x cos(theta) + y sin(theta)
    // y' = -x sin(theta) + y cos(theta)
    // Wait, let's double check the task requirements context again.
    // Merchant logic says: rotatePoint(cross, along, laneHeading)
    // If laneHeading is 0 (North): Result should be (cross, along).
    // cos(0)=1, sin(0)=0.
    // x' = x*1 + y*0 = x.
    // y' = -x*0 + y*1 = y.
    // Result (x, y). Matches.

    // If laneHeading is 90 (East): Result should be along X-axis for "Along" (y) component?
    // "Along" (y) is usually the forward direction. If Heading 90, Forward is East (+X).
    // So y input should map to +x output.
    // "Cross" (x) is usually Right. If Heading 90, Right is South (-Y).
    // So x input should map to -y output.

    // Using formula:
    // x' = x*0 + y*1 = y. (Correct, Along maps to X)
    // y' = -x*1 + y*0 = -x. (Correct, Cross maps to -Y)

    return {
        x: x * Math.cos(rad) + y * Math.sin(rad),
        y: -x * Math.sin(rad) + y * Math.cos(rad),
    };
};
