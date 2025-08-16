// src/utils/priceCalculations.js

/**
 * Calculates the target price based on initial price and percentage.
 * @param {number} initialPrice
 * @param {number} percentage
 * @returns {number}
 */
export function calculateTargetPrice(initialPrice, percentage) {
    // TODO: Implement actual target price calculation logic
    if (typeof initialPrice !== 'number' || typeof percentage !== 'number') {
        console.error("Invalid input for calculateTargetPrice: expected numbers.");
        return 0; // Or throw an error
    }
    return initialPrice * (1 + percentage / 100);
}

/**
 * Calculates the stop loss price based on initial price and percentage.
 * @param {number} initialPrice
 * @param {number} percentage
 * @returns {number}
 */
export function calculateStopLoss(initialPrice, percentage) {
    // TODO: Implement actual stop loss calculation logic
    if (typeof initialPrice !== 'number' || typeof percentage !== 'number') {
        console.error("Invalid input for calculateStopLoss: expected numbers.");
        return 0; // Or throw an error
    }
    return initialPrice * (1 - percentage / 100);
}

/**
 * Calculates the percentage difference between two prices.
 * @param {number} price1
 * @param {number} price2
 * @returns {number}
 */
export function calculatePricePercentage(price1, price2) {
    // TODO: Implement actual price percentage calculation logic
    if (typeof price1 !== 'number' || typeof price2 !== 'number') {
        console.error("Invalid input for calculatePricePercentage: expected numbers.");
        return 0; // Or throw an error
    }
    if (price1 === 0) return 0; // Avoid division by zero
    return ((price2 - price1) / price1) * 100;
}
