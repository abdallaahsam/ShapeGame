/**
 * Three Shapes Challenge - AI Solver (ai.js)
 * Implements the mathematical Nim solver under Misère rules for the AI opponent.
 */

class ShapeGameAI {
  /**
   * Calculates the AI's move based on current heap sizes and difficulty.
   * Heaps are represented as [triangles, circles, squares].
   * 
   * @param {Array<number>} heaps - Current shape counts in each heap (e.g., [1, 4, 6])
   * @param {string} difficulty - 'easy' or 'hard'
   * @returns {Object|null} { heapIndex: number, amountToRemove: number } or null if no moves
   */
  getNimMove(heaps, difficulty) {
    // Find all non-empty heaps
    const activeHeaps = [];
    for (let i = 0; i < heaps.length; i++) {
      if (heaps[i] > 0) {
        activeHeaps.push({ index: i, size: heaps[i] });
      }
    }

    if (activeHeaps.length === 0) return null; // No shapes left

    // --- EASY DIFFICULTY ---
    // Plays a completely random legal move
    if (difficulty === 'easy') {
      const randomHeap = activeHeaps[Math.floor(Math.random() * activeHeaps.length)];
      const amount = Math.floor(Math.random() * randomHeap.size) + 1;
      return { heapIndex: randomHeap.index, amountToRemove: amount };
    }

    // --- HARD DIFFICULTY ---
    // Plays mathematically perfect Misère Nim (optimal play)
    
    // 1. Calculate the Nim-sum (XOR sum) of all heaps
    let nimSum = 0;
    for (let i = 0; i < heaps.length; i++) {
      nimSum ^= heaps[i];
    }

    // 2. Check for Misère special case:
    // If a move would leave ONLY heaps of size 1 (or 0), we must ensure we leave
    // an ODD number of heaps of size 1. This happens when exactly one heap has size > 1.
    let heapsGreaterThanOne = 0;
    let heapGreaterThanOneIndex = -1;
    let heapsOfSizeOne = 0;

    for (let i = 0; i < heaps.length; i++) {
      if (heaps[i] > 1) {
        heapsGreaterThanOne++;
        heapGreaterThanOneIndex = i;
      } else if (heaps[i] === 1) {
        heapsOfSizeOne++;
      }
    }

    if (heapsGreaterThanOne === 1) {
      // We must reduce the single heap of size > 1 to either 1 or 0
      // If the count of other heaps of size 1 is even: reduce our heap to 1 (making total 1s odd)
      // If the count of other heaps of size 1 is odd: reduce our heap to 0 (making total 1s odd)
      const targetSize = (heapsOfSizeOne % 2 === 0) ? 1 : 0;
      const amount = heaps[heapGreaterThanOneIndex] - targetSize;
      return { heapIndex: heapGreaterThanOneIndex, amountToRemove: amount };
    }

    // 3. Normal Nim strategy: Find a heap to reduce such that the Nim-sum becomes 0
    if (nimSum !== 0) {
      for (let i = 0; i < heaps.length; i++) {
        const targetSize = heaps[i] ^ nimSum;
        if (targetSize < heaps[i]) {
          return { heapIndex: i, amountToRemove: heaps[i] - targetSize };
        }
      }
    }

    // 4. Fallback (Nim-sum is already 0, meaning the player is in a winning position):
    // The AI cannot force a win, so it makes a minimal move (remove 1 shape) to stall.
    const randomHeap = activeHeaps[Math.floor(Math.random() * activeHeaps.length)];
    return { heapIndex: randomHeap.index, amountToRemove: 1 };
  }
}

// Export AI class to window scope
window.ShapeGameAI = ShapeGameAI;