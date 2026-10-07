/**
 * # Task
 *
 * Provide 3 unique implementations of the following function in TypeScript.
 *
 * - Comment on the complexity or efficiency of each function.
 *
 * **Input**: `n` - any integer
 *
 * *Assuming this input will always produce a result lesser than `Number.MAX_SAFE_INTEGER`*.
 *
 * **Output**: `return` - summation to `n`, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.
 */

function sum_to_n_a(n) {
    if (n < 1) return 0;
    // Using the formula for the sum of the first n natural numbers
    // O(1) time complexity, O(1) space complexity
    return n * (n + 1) / 2;
}

function sum_to_n_b(n) {
    if (n < 1) return 0;
    // Using a loop to sum the first n natural numbers
    // O(n) time complexity, O(1) space complexity
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
}

function sum_to_n_c(n) {
    if (n < 1) return 0;
    // Using recursion to sum the first n natural numbers
    // O(n) time complexity, O(n) space complexity (due to call stack)
    return n + sum_to_n_c(n - 1);
}