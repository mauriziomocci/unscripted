import { describeCharacterStore } from '../../testing/characterStoreSuite';
import { createMemoryCharacterStore } from '../../testing/memoryCharacterStore';

describeCharacterStore('the in-memory store', () => createMemoryCharacterStore());
