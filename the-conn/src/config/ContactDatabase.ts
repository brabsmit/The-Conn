export const CONTACT_TYPES = {
    MERCHANT: {
        name: "Standard Merchant",
        acoustics: {
            baseSL: 165,       // Steady droning
            profile: "CLEAN",  // Consistent noise output
            transientRate: 0.00 // Rare random noise spikes
        },
        performance: {
            speedMin: 8,
            speedMax: 18,
            turnRate: 1.0      // Sluggish (deg/sec)
        }
    },
    TRAWLER: {
        name: "Fishing Trawler",
        acoustics: {
            baseSL: 160,
            profile: "DIRTY",  // Mechanical rattling
            transientRate: 0.03 // Frequent "clanks" (nets/chains)
        },
        performance: {
            speedMin: 3,
            speedMax: 9,
            turnRate: 3.0      // Agile
        }
    },
    ESCORT: {
        name: "Surface Escort",
        acoustics: {
            baseSL: 145,
            profile: "CLEAN",
            transientRate: 0.0
        },
        performance: {
            speedMin: 15,
            speedMax: 28,
            turnRate: 4.0
        }
    },
    SUB: {
        name: "Attack Submarine",
        acoustics: {
            baseSL: 130,
            profile: "CLEAN",
            transientRate: 0.00 // Very disciplined
        },
        performance: {
            speedMin: 5,
            speedMax: 30,
            turnRate: 5.0
        }
    },
    BIOLOGIC: {
        name: "Biologic",
        acoustics: {
            baseSL: 115,
            profile: "DIRTY", // Organic irregularity
            transientRate: 0.5 // Clicks/Whistles
        },
        performance: {
            speedMin: 0,
            speedMax: 5,
            turnRate: 10.0
        }
    },
    TORPEDO: {
        name: "Torpedo",
        acoustics: {
            baseSL: 180,
            profile: "CLEAN",
            transientRate: 0.0
        },
        performance: {
            speedMin: 45,
            speedMax: 55,
            turnRate: 15.0
        }
    }
} as const;

export type ContactTypeKey = keyof typeof CONTACT_TYPES;
