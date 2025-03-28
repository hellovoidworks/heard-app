import { EventEmitter } from 'events';

// Create a singleton event emitter for cross-component communication
const eventEmitter = new EventEmitter();

// Event types
export const EVENTS = {
  STARS_UPDATED: 'STARS_UPDATED'
};

export default eventEmitter;
