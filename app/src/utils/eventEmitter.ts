/**
 * Simple event emitter implementation for React Native
 */
class EventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(listener => listener !== callback);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

// Create a singleton event emitter for cross-component communication
const eventEmitter = new EventEmitter();

// Event types
export const EVENTS = {
  STARS_UPDATED: 'STARS_UPDATED',
  STAR_REWARD_EARNED: 'STAR_REWARD_EARNED',
  // Badge count events
  UNREAD_LETTERS_COUNT_CHANGED: 'UNREAD_LETTERS_COUNT_CHANGED',
  UNREAD_REACTIONS_COUNT_CHANGED: 'UNREAD_REACTIONS_COUNT_CHANGED',
  // Global events
  MAILBOX_DATA_PRELOADED: 'MAILBOX_DATA_PRELOADED'
};

export default eventEmitter;
